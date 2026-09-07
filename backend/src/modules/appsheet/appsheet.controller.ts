import { Request, Response } from "express";
import { config } from "../../config";
import { syncAppSheetStudents } from "./appsheet.students";

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
