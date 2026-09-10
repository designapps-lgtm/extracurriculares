import type { NextFunction, Request, Response } from "express";
import { writeAuditEvent } from "../db/audit";
import { AppSheetApiError } from "../modules/appsheet/appsheet.service";

export class AppError extends Error {
  constructor(public statusCode: number, public code: string, message: string) {
    super(message);
    this.name = "AppError";
  }
}

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const isAdminMutation = ["POST", "PATCH", "DELETE"].includes(req.method) && Boolean(req.admin);
    if (!isAdminMutation) {
      fn(req, res, next).catch(next);
      return;
    }
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      void writeAuditEvent({
        userId: req.admin!.adminId,
        userType: "admin",
        action: `${req.method} ${req.originalUrl}`,
        entity: extractResourceType(req.originalUrl),
        entityId: extractResourceId(req.originalUrl),
        details: {
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          body: sanitizeBody(req.body),
          result: sanitizeBody(body?.data),
        },
      }).catch((error) => console.error("[EC_Auditoria] No se pudo registrar", error instanceof Error ? error.message : error));
      return originalJson(body);
    };
    fn(req, res, next).catch(next);
  };
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Ruta no encontrada" } });
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof AppSheetApiError) {
    console.error("[AppSheetError]", {
      table: err.table,
      action: err.action,
      status: err.status,
      timedOut: err.timedOut,
      response: err.responseBody,
    });
    const status = err.timedOut ? 504 : err.status === 429 ? 503 : err.status === 401 || err.status === 403 ? 502 : 502;
    const code = err.timedOut ? "APPSHEET_TIMEOUT" : err.status === 429 ? "APPSHEET_RATE_LIMITED" : "APPSHEET_UNAVAILABLE";
    res.status(status).json({ success: false, error: { code, message: err.timedOut ? "AppSheet tardó demasiado en responder" : "No fue posible consultar AppSheet" } });
    return;
  }
  const clientCode = (err as any).clientCode as string | undefined;
  if (clientCode === "NOT_FOUND") {
    res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "El registro solicitado no existe." } });
    return;
  }
  if (clientCode === "DUPLICATE_EMAIL") {
    res.status(409).json({ success: false, error: { code: "DUPLICATE_EMAIL", message: "Ya existe un usuario con ese correo." } });
    return;
  }
  console.error("[Unhandled Error]", err.message);
  res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Error interno del servidor" } });
}

function extractResourceType(url: string): string {
  if (url.includes("/operations/sessions")) return "attendance_session";
  if (url.includes("/students")) return "student";
  if (url.includes("/teachers")) return "teacher";
  if (url.includes("/assignments")) return "assignment";
  if (url.includes("/admins")) return "admin_user";
  if (url.includes("/supervisors")) return "supervisor";
  if (url.includes("/secretaries")) return "secretary";
  if (url.includes("/schedules")) return "schedule";
  return "unknown";
}

function extractResourceId(url: string): string | null {
  const clean = url.split("?")[0];
  const parts = clean.split("/").filter(Boolean);
  const last = parts.at(-1);
  return last && !["start", "reset-password", "students", "teachers", "assignments", "admins", "supervisors", "secretaries", "schedules"].includes(last) ? last : null;
}

function sanitizeBody(body: any): any {
  if (!body || typeof body !== "object") return body;
  if (Array.isArray(body)) return body.slice(0, 25).map(sanitizeBody);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (["password", "passwordHash", "credential", "token", "accessToken", "refreshToken"].includes(key)) continue;
    result[key] = value && typeof value === "object" ? sanitizeBody(value) : value;
  }
  return result;
}
