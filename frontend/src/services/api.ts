// El backend se proxya via vercel.json (/api/* -> Cloudflare worker) para que el
// navegador siempre hable con el MISMO dominio y las cookies sean first-party
// (SameSite=None no se bloquea). En producción usamos ruta relativa. En dev
// (docker o vite) apuntamos directo al backend local.
const BASE_URL = import.meta.env.PROD
  ? ""
  : import.meta.env.API_URL || import.meta.env.VITE_API_URL || "http://localhost:3000";

export interface ApiRequestOptions {
  retry?: boolean;
  timeoutMs?: number;
  [key: string]: unknown;
}

// Timeout por defecto para cada request. En Cloudflare Workers (plan free, cold
// starts) una request puede tardar varios segundos, así que 30s es generoso.
// Sin este timeout, si el worker tarda muy poco (nunca resuelve ni rechaza), el
// fetch cuelga infinito y las pantallas quedan con un spinner dando vueltas
// (ej. "Llamar lista" / asistencia del supervisor).
const DEFAULT_TIMEOUT_MS = 30000;

function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const { signal, ...initRest } = init;
  return fetch(input, { ...initRest, signal: signal ?? controller.signal })
    .finally(() => clearTimeout(timer));
}

// Ejecuta un request: si el fetch interna lanza AbortError (timeout), lo
// convierte en un ApiRequestError con mensaje claro para que las pantallas
// muestren algo en vez de quedarse con un spinner infinito.
async function execute(send: () => Promise<Response>): Promise<Response> {
  try {
    return await send();
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new ApiRequestError(0, "REQUEST_TIMEOUT", "La solicitud tardó demasiado. Intentalo de nuevo.");
    }
    throw e;
  }
}

type AuthRole = "admin" | "teacher" | "supervisor" | "secretary";

function isAuthPath(path: string): boolean {
  return path.includes("/auth/refresh") || path.includes("/auth/logout") || path.includes("/auth/login") || path.includes("/auth/google");
}

function roleForPath(path: string): AuthRole | null {
  if (path.startsWith("/api/admin/")) return "admin";
  if (path.startsWith("/api/teacher/")) return "teacher";
  if (path.startsWith("/api/supervisor/")) return "supervisor";
  if (path.startsWith("/api/secretary/")) return "secretary";
  return null;
}

function refreshUrlForRole(role: AuthRole): string {
  switch (role) {
    case "admin":
      return "/api/admin/auth/refresh";
    case "teacher":
      return "/api/teacher/auth/refresh";
    case "secretary":
      return "/api/secretary/auth/refresh";
    default:
      return "/api/supervisor/auth/refresh";
  }
}

let pendingRefresh: { url: string; promise: Promise<boolean> } | null = null;

// El refresh token vive en una cookie httpOnly: el navegador lo envía solo.
function runRefresh(url: string): Promise<boolean> {
  if (pendingRefresh && pendingRefresh.url === url) {
    return pendingRefresh.promise;
  }

  const promise = (async () => {
    try {
      const res = await fetchWithTimeout(`${BASE_URL}${url}`, {
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
    const res = await execute(send);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const err = new ApiRequestError(res.status, body?.error?.code || "HTTP_ERROR", body?.error?.message || `Error ${res.status}`);

      if (retry && res.status === 401 && !isAuthPath(path)) {
        const role = roleForPath(path);
        if (role) {
          const refreshed = await runRefresh(refreshUrlForRole(role));
          if (refreshed) {
            const retryRes = await execute(send);
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

  async download(path: string, params?: Record<string, string>): Promise<Blob> {
    const res = await this.sendRaw(() =>
      fetchWithTimeout(this.buildUrl(path, params), { headers: this.buildHeaders(), credentials: "include" }),
      path,
    );
    return res.blob();
  }

  private async sendRaw(send: () => Promise<Response>, path: string): Promise<Response> {
    const res = await execute(send);
    if (!res.ok) {
      if (res.status === 401 && !isAuthPath(path)) {
        const role = roleForPath(path);
        if (role) {
          const refreshed = await runRefresh(refreshUrlForRole(role));
          if (refreshed) {
            const retryRes = await execute(send);
            if (retryRes.ok) return retryRes;
            throw new ApiRequestError(
              retryRes.status,
              (await retryRes.json().catch(() => null))?.error?.code || "HTTP_ERROR",
              `Error ${retryRes.status}`
            );
          }
        }
      }
      const body = await res.json().catch(() => null);
      throw new ApiRequestError(res.status, body?.error?.code || "HTTP_ERROR", body?.error?.message || `Error ${res.status}`);
    }
    return res;
  }

  private buildHeaders(contentType?: string): HeadersInit {
    const headers: Record<string, string> = {};
    if (contentType) headers["Content-Type"] = contentType;
    return headers;
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    return this.attempt<T>(
      () => fetchWithTimeout(this.buildUrl(path, params), { headers: this.buildHeaders(), credentials: "include" }),
      path,
      true
    );
  }

  async post<T>(path: string, data?: unknown, options?: ApiRequestOptions): Promise<T> {
    const retry = options?.retry !== false;
    return this.attempt<T>(
      () =>
        fetchWithTimeout(this.buildUrl(path), {
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
        fetchWithTimeout(this.buildUrl(path), {
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
      () => fetchWithTimeout(this.buildUrl(path), { method: "DELETE", headers: this.buildHeaders(), credentials: "include" }),
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
