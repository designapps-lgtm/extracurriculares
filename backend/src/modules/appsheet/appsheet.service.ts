import { config } from "../../config";

const APPSHEET_API_BASE = "https://www.appsheet.com/api/v2/apps";

export interface AppSheetRow {
  [column: string]: unknown;
}

function requireConfig(): { appId: string; accessKey: string } {
  if (!config.appsheetAppId || !config.appsheetAccessKey) {
    throw new Error("AppSheet no está configurado: faltan APPSHEET_APP_ID o APPSHEET_APPLICATION_ACCESS_KEY");
  }
  return { appId: config.appsheetAppId, accessKey: config.appsheetAccessKey };
}

/** Lee una tabla AppSheet. El nombre de tabla se conecta cuando se defina el mapa de fuentes. */
export async function findAppSheetRows(tableName: string, selector?: string): Promise<AppSheetRow[]> {
  const { appId, accessKey } = requireConfig();
  const response = await fetch(
    `${APPSHEET_API_BASE}/${encodeURIComponent(appId)}/tables/${encodeURIComponent(tableName)}/Action`,
    {
      method: "POST",
      headers: {
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
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`AppSheet API ${response.status}: ${detail}`);
  }

  // AppSheet REST API devuelve Find como un arreglo directamente (aunque
  // algunas respuestas/documentaciones lo muestran envuelto en `Rows`).
  const payload = await response.json() as AppSheetRow[] | { Rows?: AppSheetRow[] };
  return Array.isArray(payload) ? payload : payload.Rows || [];
}
