import { Request, Response, NextFunction } from "express";
import prisma from "../config/prisma";

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

      prisma.auditLog.create({
        data: {
          adminId: req.admin!.adminId,
          accion,
          entidad,
          entidadId: entidadId || undefined,
          detalles: JSON.stringify({
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            body: sanitizeBody(req.body),
          }),
        },
      }).catch((err) => {
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

  if (isPrismaError(err)) {
    res.status(prismaStatus(err)).json({
      success: false,
      error: { code: prismaCode(err), message: prismaMessage(err) },
    });
    return;
  }

  console.error("[Unhandled Error]", err.message);
  res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "Error interno del servidor" },
  });
}

function isPrismaError(err: Error): boolean {
  return typeof (err as any).code === "string" && ((err as any).code.startsWith("P") || (err as any).meta !== undefined);
}

function prismaCode(err: Error): string {
  const code = (err as any).code as string;
  switch (code) {
    case "P2002": return "DUPLICATE_EMAIL";
    case "P2025": return "NOT_FOUND";
    case "P2003": return "REFERENCED_RECORD_MISSING";
    default: return `PRISMA_${code}`;
  }
}

function prismaStatus(err: Error): number {
  const code = (err as any).code as string;
  switch (code) {
    case "P2002": return 409;
    case "P2025": return 404;
    case "P2003": return 400;
    default: return 500;
  }
}

function prismaMessage(err: Error): string {
  const code = (err as any).code as string;
  switch (code) {
    case "P2002": {
      const target = (err as any).meta?.target;
      return `Ya existe un registro con ese ${Array.isArray(target) ? target.join(", ") : "valor"}.`;
    }
    case "P2025": return "El registro solicitado no existe.";
    case "P2003": return "Referencia a un registro inexistente.";
    default: return err.message;
  }
}

function extractResourceType(url: string): string {
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
