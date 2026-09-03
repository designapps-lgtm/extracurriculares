import { Request, Response } from "express";
import { config } from "../../config";
import { syncAppSheetStudents } from "./appsheet.students";
import { ingestAppSheetNovedades, syncAppSheetNovedades } from "./appsheet.novedades";

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


function isNovedadesAuthorized(req: Request): boolean {
  if (!config.appsheetNovedadesWebhookToken) return false;
  const header = req.headers["x-appsheet-webhook-token"] || req.headers["x-webhook-token"];
  const authorization = req.headers.authorization;
  const providedHeader = Array.isArray(header) ? header[0] : header;
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  return providedHeader === config.appsheetNovedadesWebhookToken || bearer === config.appsheetNovedadesWebhookToken;
}

export async function syncNovedades(req: Request, res: Response): Promise<void> {
  if (!config.appsheetNovedadesWebhookToken) {
    res.status(503).json({
      success: false,
      error: { code: "APPSHEET_NOVEDADES_NOT_CONFIGURED", message: "El token del webhook de novedades no está configurado" },
    });
    return;
  }

  if (!isNovedadesAuthorized(req)) {
    res.status(401).json({ success: false, error: { code: "INVALID_APPSHEET_WEBHOOK", message: "Webhook de AppSheet inválido" } });
    return;
  }

  const result = await ingestAppSheetNovedades(req.body);
  const status = result.accepted > 0 ? 200 : 422;
  res.status(status).json({ success: result.ok, data: result });
}

export async function syncNovedadesFromApi(req: Request, res: Response): Promise<void> {
  if (!isNovedadesAuthorized(req)) {
    res.status(401).json({ success: false, error: { code: "INVALID_APPSHEET_WEBHOOK", message: "Webhook de AppSheet inválido" } });
    return;
  }

  const result = await syncAppSheetNovedades();
  res.json({ success: result.ok, data: result });
}
