const APPSHEET_API_BASE = "https://www.appsheet.com/api/v2/apps";
const REQUEST_TIMEOUT_MS = 20_000;
const FIND_MAX_ATTEMPTS = 3;

export type AppSheetAction = "Find" | "Add" | "Edit" | "Delete";

export interface AppSheetRow {
  [column: string]: unknown;
}

export interface AppSheetConnection {
  appId: string;
  accessKey: string;
}

export class AppSheetApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly table: string,
    readonly action: AppSheetAction,
    readonly endpoint: string,
    readonly responseBody: string | null,
    readonly timedOut = false,
  ) {
    super(message);
    this.name = "AppSheetApiError";
  }
}

function requireConfig(connection?: AppSheetConnection): AppSheetConnection {
  const appId = connection?.appId;
  const accessKey = connection?.accessKey;
  if (!appId || !accessKey) {
    throw new AppSheetApiError(
      "AppSheet no está configurado: faltan el App ID o la llave de acceso",
      503,
      "configuration",
      "Find",
      APPSHEET_API_BASE,
      null,
    );
  }
  return { appId, accessKey };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
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

function safeDetail(detail: string): string {
  return detail.replace(/[\r\n\t]+/g, " ").slice(0, 500);
}

async function executeAction(
  tableName: string,
  action: AppSheetAction,
  rows: AppSheetRow[],
  selector?: string,
  connection?: AppSheetConnection,
): Promise<AppSheetRow[]> {
  const { appId, accessKey } = requireConfig(connection);
  const endpoint = `${APPSHEET_API_BASE}/${encodeURIComponent(appId)}/tables/${encodeURIComponent(tableName)}/Action`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ApplicationAccessKey: accessKey,
      },
      body: JSON.stringify({
        Action: action,
        Properties: {
          Locale: "es-CO",
          Timezone: "America/Bogota",
          ...(selector ? { Selector: selector } : {}),
        },
        Rows: rows,
      }),
      signal: controller.signal,
    });

    const detail = await response.text();
    if (!response.ok) {
      throw new AppSheetApiError(
        `AppSheet ${action} en ${tableName} falló con HTTP ${response.status}: ${safeDetail(detail)}`,
        response.status,
        tableName,
        action,
        endpoint,
        safeDetail(detail),
      );
    }

    if (!detail) return [];
    try {
      return extractRows(JSON.parse(detail));
    } catch {
      throw new AppSheetApiError(
        `AppSheet ${action} en ${tableName} devolvió JSON inválido`,
        502,
        tableName,
        action,
        endpoint,
        safeDetail(detail),
      );
    }
  } catch (error) {
    if (error instanceof AppSheetApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AppSheetApiError(
        `Tiempo de espera agotado al ejecutar ${action} en AppSheet (${tableName})`,
        504,
        tableName,
        action,
        endpoint,
        null,
        true,
      );
    }
    throw new AppSheetApiError(
      `No se pudo conectar con AppSheet para ${action} en ${tableName}: ${error instanceof Error ? error.message : String(error)}`,
      502,
      tableName,
      action,
      endpoint,
      null,
    );
  } finally {
    clearTimeout(timeout);
  }
}

/** Find es idempotente; reintenta únicamente errores temporales y 429. */
export async function findAppSheetRows(
  tableName: string,
  selector?: string,
  connection?: AppSheetConnection,
): Promise<AppSheetRow[]> {
  let lastError: AppSheetApiError | null = null;
  for (let attempt = 1; attempt <= FIND_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await executeAction(tableName, "Find", [], selector, connection);
    } catch (error) {
      const apiError = error instanceof AppSheetApiError
        ? error
        : new AppSheetApiError(String(error), 502, tableName, "Find", APPSHEET_API_BASE, null);
      lastError = apiError;
      if (!isRetryableStatus(apiError.status) || attempt === FIND_MAX_ATTEMPTS) throw apiError;
      await wait(attempt * 500);
    }
  }
  throw lastError ?? new AppSheetApiError("No se pudo consultar AppSheet", 502, tableName, "Find", APPSHEET_API_BASE, null);
}
