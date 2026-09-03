import { Request, Response, NextFunction } from "express";
import { sql } from "../config/db";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const isMutation = ["POST", "PATCH", "DELETE"].includes(req.method);

    if (!isMutation || !req.admin) {
      fn(req, res, next).catch(next);
      return;
    }

    const originalJson = res.json.bind(res);

    res.json = function (body: any) {
      const accion = `${req.method} ${req.originalUrl}`;
      const entidad = extractResourceType(req.originalUrl);
      const entidadId = extractResourceId(req.originalUrl);

      sql`
        INSERT INTO "AuditLog" ("id", "adminId", "accion", "entidad", "entidadId", "detalles", "createdAt")
        VALUES (gen_random_uuid(), ${req.admin!.adminId}, ${accion}, ${entidad}, ${entidadId || null}, ${JSON.stringify({
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          body: sanitizeBody(req.body),
          result: sanitizeBody(body?.data),
        })}::jsonb, now())
      `.catch((err) => {
        console.error("[AuditLog] Failed to write:", err.message);
      });

      return originalJson(body);
    };

    fn(req, res, next).catch(next);
  };
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: "Ruta no encontrada" },
  });
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
    return;
  }

  // Errores del query-layer de Neon (SQL crudo). Simula los códigos Prisma
  // que los clientes del frontend ya esperaban (DUPLICATE_EMAIL, NOT_FOUND, ...).
  if (isDbError(err)) {
    res.status(dbStatus(err)).json({
      success: false,
      error: { code: dbCode(err), message: dbMessage(err) },
    });
    return;
  }

  console.error("[Unhandled Error]", err.message);
  res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "Error interno del servidor" },
  });
}

// Un error del driver Neon (NeonDbError) o un error marcado manualmente con
// `clientCode` (p. ej. "NOT_FOUND" lanzado por `must()`).
function isDbError(err: Error): boolean {
  return typeof (err as any).code === "string" || typeof (err as any).clientCode === "string";
}

function dbCode(err: Error): string {
  const clientCode = (err as any).clientCode as string | undefined;
  if (clientCode === "NOT_FOUND") return "NOT_FOUND";
  const code = (err as any).code as string;
  switch (code) {
    case "23505": return "DUPLICATE_EMAIL";
    case "P2025": return "NOT_FOUND";
    case "23503": return "REFERENCED_RECORD_MISSING";
    default: return code ? `DB_${code}` : "INTERNAL_ERROR";
  }
}

function dbStatus(err: Error): number {
  const clientCode = (err as any).clientCode as string | undefined;
  if (clientCode === "NOT_FOUND") return 404;
  const code = (err as any).code as string;
  switch (code) {
    case "23505": return 409;
    case "P2025": return 404;
    case "23503": return 400;
    default: return 500;
  }
}

function dbMessage(err: Error): string {
  const clientCode = (err as any).clientCode as string | undefined;
  if (clientCode === "NOT_FOUND") return "El registro solicitado no existe.";
  const code = (err as any).code as string;
  switch (code) {
    case "23505": return "Ya existe un registro con ese valor.";
    case "P2025": return "El registro solicitado no existe.";
    case "23503": return "Referencia a un registro inexistente.";
    default: {
      // No filtrar detalles de la base (el mensaje del driver incluye el SQL y
      // nombres de tablas/columnas). Log interno + mensaje genérico.
      console.error("[DbError]", err.message);
      return "Error de base de datos.";
    }
  }
}

function extractResourceType(url: string): string {
  if (url.includes("/admin/operations/sessions")) return "attendance_session";
  if (url.includes("/admin/students")) return "student";
  if (url.includes("/admin/teachers")) return "teacher";
  if (url.includes("/admin/assignments")) return "assignment";
  if (url.includes("/admin/admins")) return "admin_user";
  if (url.includes("/admin/disciplines")) return "discipline";
  if (url.includes("/admin/grades")) return "grade";
  if (url.includes("/admin/schedules")) return "schedule";
  return "unknown";
}

function extractResourceId(url: string): string | null {
  const attendanceSession = /\/admin\/operations\/sessions\/([^/?]+)/.exec(url)?.[1];
  if (attendanceSession) return attendanceSession === "start" ? null : attendanceSession;

  const parts = url.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  if (last && !last.includes("?") && !["reset-password"].includes(last)) {
    return last;
  }
  return null;
}

function sanitizeBody(body: any): any {
  if (!body || typeof body !== "object") return body;
  const sanitized = { ...body };
  delete sanitized.password;
  delete sanitized.passwordHash;
  return sanitized;
}
