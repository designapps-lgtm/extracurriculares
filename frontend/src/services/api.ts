import { getAccessToken, getRefreshToken, saveTokens, clearTokens, roleForPath, AuthRole } from "./tokenStorage";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export interface ApiRequestOptions {
  retry?: boolean;
  [key: string]: unknown;
}

function isAuthPath(path: string): boolean {
  return path.startsWith("/api/admin/auth") || path.startsWith("/api/teacher/auth");
}

function resolveRefreshUrl(path: string): string | null {
  const role = roleForPath(path);
  if (!role) return null;
  return role === "admin" ? "/api/admin/auth/refresh" : "/api/teacher/auth/refresh";
}

let pendingRefresh: { url: string; role: AuthRole; promise: Promise<boolean> } | null = null;

function runRefresh(url: string, role: AuthRole): Promise<boolean> {
  if (pendingRefresh && pendingRefresh.url === url) {
    return pendingRefresh.promise;
  }

  const refreshToken = getRefreshToken(role);
  if (!refreshToken) {
    return Promise.resolve(false);
  }

  const promise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}${url}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (res.status !== 200) {
        clearTokens(role);
        return false;
      }
      const body = await res.json();
      const data = body?.data;
      if (!data?.accessToken || !data?.refreshToken) {
        clearTokens(role);
        return false;
      }
      saveTokens(role, { accessToken: data.accessToken, refreshToken: data.refreshToken });
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    pendingRefresh = null;
  });

  pendingRefresh = { url, role, promise };
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
    const role = roleForPath(path);
    const res = await send();
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const err = new ApiRequestError(res.status, body?.error?.code || "HTTP_ERROR", body?.error?.message || `Error ${res.status}`);

      if (retry && res.status === 401 && !isAuthPath(path) && role) {
        const refreshUrl = resolveRefreshUrl(path);
        if (refreshUrl) {
          const refreshed = await runRefresh(refreshUrl, role);
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
          clearTokens(role);
        }
      }
      throw err;
    }
    return res.json();
  }

  private buildHeaders(path: string, contentType?: string): HeadersInit {
    const headers: Record<string, string> = {};
    if (contentType) headers["Content-Type"] = contentType;
    const role = roleForPath(path);
    if (role) {
      const token = getAccessToken(role);
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    return this.attempt<T>(
      () => fetch(this.buildUrl(path, params), { headers: this.buildHeaders(path) }),
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
          headers: this.buildHeaders(path, "application/json"),
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
          headers: this.buildHeaders(path, "application/json"),
          body: data !== undefined ? JSON.stringify(data) : undefined,
        }),
      path,
      true
    );
  }

  async delete<T>(path: string): Promise<T> {
    return this.attempt<T>(
      () => fetch(this.buildUrl(path), { method: "DELETE", headers: this.buildHeaders(path) }),
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
