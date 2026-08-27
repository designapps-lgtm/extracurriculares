const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export interface ApiRequestOptions {
  credentials?: RequestCredentials;
  retry?: boolean;
  [key: string]: unknown;
}

function isAuthPath(path: string): boolean {
  return path.startsWith("/api/admin/auth") || path.startsWith("/api/teacher/auth");
}

function resolveRefreshUrl(path: string): string | null {
  if (path.startsWith("/api/admin/")) return "/api/admin/auth/refresh";
  if (path.startsWith("/api/teacher/")) return "/api/teacher/auth/refresh";
  return null;
}

let pendingRefresh: { url: string; promise: Promise<boolean> } | null = null;

function runRefresh(url: string): Promise<boolean> {
  if (pendingRefresh && pendingRefresh.url === url) {
    return pendingRefresh.promise;
  }

  const promise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}${url}`, {
        method: "POST",
        credentials: "include",
      });
      const ok = res.status === 200;
      return ok;
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
    const url = new URL(`${this.baseUrl}${path}`);
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
        const refreshUrl = resolveRefreshUrl(path);
        if (refreshUrl) {
          const refreshed = await runRefresh(refreshUrl);
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

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    return this.attempt<T>(() => fetch(this.buildUrl(path, params), { credentials: "include" }), path, true);
  }

  async post<T>(path: string, data?: unknown, options?: ApiRequestOptions): Promise<T> {
    const retry = options?.retry !== false;
    return this.attempt<T>(
      () =>
        fetch(this.buildUrl(path), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: data ? JSON.stringify(data) : undefined,
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
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: data ? JSON.stringify(data) : undefined,
        }),
      path,
      true
    );
  }

  async delete<T>(path: string): Promise<T> {
    return this.attempt<T>(
      () =>
        fetch(this.buildUrl(path), {
          method: "DELETE",
          credentials: "include",
        }),
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