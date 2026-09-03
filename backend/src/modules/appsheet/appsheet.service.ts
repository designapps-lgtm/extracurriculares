import { config } from "../../config";

const APPSHEET_API_BASE = "https://www.appsheet.com/api/v2/apps";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;

export interface AppSheetRow {
  [column: string]: unknown;
}

function requireConfig(): { appId: string; accessKey: string } {
  if (!config.appsheetAppId || !config.appsheetAccessKey) {
    throw new Error("AppSheet no está configurado: faltan APPSHEET_APP_ID o APPSHEET_APPLICATION_ACCESS_KEY");
  }
  return { appId: config.appsheetAppId, accessKey: config.appsheetAccessKey };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

class AppSheetRequestError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
    this.name = "AppSheetRequestError";
  }
}

function extractRows(payload: unknown): AppSheetRow[] {
  if (Array.isArray(payload)) return payload as AppSheetRow[];
  if (!payload || typeof payload !== "object") return [];

  const body = payload as Record<string, unknown>;
  const candidates = [body.Rows, body.rows, body.data, body.Data];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as AppSheetRow[];
    if (candidate && typeof candidate === "object") {
      const nested = candidate as Record<string, unknown>;
      if (Array.isArray(nested.Rows)) return nested.Rows as AppSheetRow[];
      if (Array.isArray(nested.rows)) return nested.rows as AppSheetRow[];
    }
  }

  return [];
}

/** Lee todas las filas visibles de una tabla AppSheet con timeout y reintentos. */
export async function findAppSheetRows(tableName: string, selector?: string): Promise<AppSheetRow[]> {
  const { appId, accessKey } = requireConfig();
  const url = `${APPSHEET_API_BASE}/${encodeURIComponent(appId)}/tables/${encodeURIComponent(tableName)}/Action`;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "ApplicationAccessKey": accessKey,
        },
        body: JSON.stringify({
          Action: "Find",
          Properties: {
            Locale: "es-CO",
            Timezone: "America/Bogota",
            ...(selector ? { Selector: selector } : {}),
          },
          Rows: [],
        }),
        signal: controller.signal,
      });

      const detail = await response.text();
      if (!response.ok) {
        throw new AppSheetRequestError(
          `AppSheet API ${response.status}: ${detail.slice(0, 500)}`,
          isRetryableStatus(response.status),
        );
      }

      let payload: unknown;
      try {
        payload = detail ? JSON.parse(detail) : [];
      } catch {
        throw new AppSheetRequestError("AppSheet devolvió una respuesta JSON inválida", false);
      }

      return extractRows(payload);
    } catch (error) {
      if (error instanceof AppSheetRequestError && !error.retryable) {
        throw error;
      }
      lastError = error instanceof Error
        ? (error.name === "AbortError" ? new Error("Tiempo de espera agotado al consultar AppSheet") : error)
        : new Error(String(error));
      if (attempt === MAX_ATTEMPTS) throw lastError;
      await wait(attempt * 1000);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error("No se pudo consultar AppSheet");
}
