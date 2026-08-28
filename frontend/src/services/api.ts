// El backend se proxya via vercel.json (/api/* -> onrender.com) para que el
// navegador siempre hable con el MISMO dominio y las cookies sean first-party
// (SameSite=None no se bloquea). En producción usamos ruta relativa. En dev
// (docker o vite) apuntamos directo al backend local.
const BASE_URL = import.meta.env.PROD
  ? ""
  : import.meta.env.API_URL || import.meta.env.VITE_API_URL || "http://localhost:3000";

export interface ApiRequestOptions {
  retry?: boolean;
  [key: string]: unknown;
}

type AuthRole = "admin" | "teacher" | "supervisor";

function isAuthPath(path: string): boolean {
  return path.startsWith("/api/admin/auth") || path.startsWith("/api/teacher/auth") || path.startsWith("/api/supervisor/auth");
}

function roleForPath(path: string): AuthRole | null {
  if (path.startsWith("/api/admin/")) return "admin";
  if (path.startsWith("/api/teacher/")) return "teacher";
  if (path.startsWith("/api/supervisor/")) return "supervisor";
  return null;
}

function refreshUrlForRole(role: AuthRole): string {
  return role === "admin"
    ? "/api/admin/auth/refresh"
    : role === "teacher"
      ? "/api/teacher/auth/refresh"
      : "/api/supervisor/auth/refresh";
}

let pendingRefresh: { url: string; promise: Promise<boolean> } | null = null;

// El refresh token vive en una cookie httpOnly: el navegador lo envía solo.
function runRefresh(url: string): Promise<boolean> {
  if (pendingRefresh && pendingRefresh.url === url) {
    return pendingRefresh.promise;
  }

  const promise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}${url}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      return res.status === 200;
    } catch {
      return false;
    }
  })().finally(() => {
    pendingRefresh = null;
  });

  pendingRefresh = { url, promise };
  return promise;
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    const url = new URL(this.baseUrl ? `${this.baseUrl}${path}` : path, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== "") {
          url.searchParams.set(key, value);
        }
      });
    }
    return url.toString();
  }

  private async attempt<T>(send: () => Promise<Response>, path: string, retry: boolean): Promise<T> {
    const res = await send();
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const err = new ApiRequestError(res.status, body?.error?.code || "HTTP_ERROR", body?.error?.message || `Error ${res.status}`);

      if (retry && res.status === 401 && !isAuthPath(path)) {
        const role = roleForPath(path);
        if (role) {
          const refreshed = await runRefresh(refreshUrlForRole(role));
          if (refreshed) {
            const retryRes = await send();
            if (retryRes.ok) return retryRes.json();
            const retryBody = await retryRes.json().catch(() => null);
            throw new ApiRequestError(
              retryRes.status,
              retryBody?.error?.code || "HTTP_ERROR",
              retryBody?.error?.message || `Error ${retryRes.status}`
            );
          }
        }
      }
      throw err;
    }
    return res.json();
  }

  private buildHeaders(contentType?: string): HeadersInit {
    const headers: Record<string, string> = {};
    if (contentType) headers["Content-Type"] = contentType;
    return headers;
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    return this.attempt<T>(
      () => fetch(this.buildUrl(path, params), { headers: this.buildHeaders(), credentials: "include" }),
      path,
      true
    );
  }

  async post<T>(path: string, data?: unknown, options?: ApiRequestOptions): Promise<T> {
    const retry = options?.retry !== false;
    return this.attempt<T>(
      () =>
        fetch(this.buildUrl(path), {
          method: "POST",
          headers: this.buildHeaders("application/json"),
          credentials: "include",
          body: data !== undefined ? JSON.stringify(data) : undefined,
        }),
      path,
      retry
    );
  }

  async patch<T>(path: string, data?: unknown): Promise<T> {
    return this.attempt<T>(
      () =>
        fetch(this.buildUrl(path), {
          method: "PATCH",
          headers: this.buildHeaders("application/json"),
          credentials: "include",
          body: data !== undefined ? JSON.stringify(data) : undefined,
        }),
      path,
      true
    );
  }

  async delete<T>(path: string): Promise<T> {
    return this.attempt<T>(
      () => fetch(this.buildUrl(path), { method: "DELETE", headers: this.buildHeaders(), credentials: "include" }),
      path,
      true
    );
  }
}

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export const api = new ApiClient(BASE_URL);
