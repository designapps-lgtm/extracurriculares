import { Request, Response } from "express";
import { config } from "../../config";
import { syncAppSheetStudents } from "./appsheet.students";
import { clearAppSheetCache, getTableRows, type AppSheetTableName } from "./appsheet.repository";

function isAuthorized(req: Request): boolean {
  const validTokens = [config.appsheetWebhookToken, config.googleDriveWebhookToken].filter(Boolean);
  if (validTokens.length === 0) return false;
  const header = req.headers["x-webhook-token"] || req.headers["x-goog-channel-token"];
  const query = typeof req.query.token === "string" ? req.query.token : "";
  const provided = Array.isArray(header) ? String(header[0]) : String(header || "");
  return validTokens.includes(provided) || validTokens.includes(query);
}

export async function syncStudents(req: Request, res: Response): Promise<void> {
  if (!isAuthorized(req)) {
    res.status(401).json({ success: false, error: { code: "INVALID_WEBHOOK", message: "Webhook inválido" } });
    return;
  }
  const result = await syncAppSheetStudents();
  res.json({ success: result.ok, data: result });
}

// Endpoint de push: AppSheet lo llama (automatización "Call a webhook") cuando
// cambian filas de una tabla. Invalidamos la copia local y compartida de esa
// tabla y refrescamos AppSheet en caliente para repoblar KV con el dato real.
// El token va en header `x-webhook-token` o query `token`.
export async function syncTable(req: Request, res: Response): Promise<void> {
  if (!isAuthorized(req)) {
    res.status(401).json({ success: false, error: { code: "INVALID_WEBHOOK", message: "Webhook inválido" } });
    return;
  }

  const rawTable =
    (typeof req.body?.table === "string" && req.body.table) ||
    (typeof req.body?.tableName === "string" && req.body.tableName) ||
    (typeof req.query.table === "string" && req.query.table) ||
    (typeof req.query.tableName === "string" && req.query.tableName) ||
    "";
  const tableName = rawTable.trim() as AppSheetTableName;

  if (!tableName) {
    res.status(400).json({ success: false, error: { code: "MISSING_TABLE", message: "Falta table/tableName" } });
    return;
  }

  try {
    // Refresca AppSheet en caliente y repuebla la caché compartida (KV + memoria).
    const rows = await getTableRows(tableName, { fresh: true });
    res.json({ success: true, data: { table: tableName, rows: rows.length } });
  } catch (error) {
    // Si AppSheet está caído o con 429, al menos invalidamos la copia vencida para
    // que la próxima lectura intente de nuevo en vez de servir un dato viejo.
    clearAppSheetCache(tableName);
    res.status(502).json({
      success: false,
      error: {
        code: "APPSHEET_REFRESH_FAILED",
        message: error instanceof Error ? error.message : "Falló el refresh de AppSheet",
      },
    });
  }
}
