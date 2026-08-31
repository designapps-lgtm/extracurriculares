import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { sql } from "../config/db";
import { ADMIN_ACCESS_COOKIE } from "../utils/authCookies";

export interface AuthPayload {
  adminId: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      admin?: AuthPayload;
    }
  }
}

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req) || req.cookies?.[ADMIN_ACCESS_COOKIE] || null;
  if (!token) {
    res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "No autenticado" } });
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
    req.admin = payload;
    next();
  } catch {
    res.status(401).json({ success: false, error: { code: "INVALID_TOKEN", message: "Token inválido o expirado" } });
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.admin) {
    res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "No autenticado" } });
    return;
  }

  const admin = (await sql`
    SELECT "id", "estado"
    FROM "AdminUser"
    WHERE "id" = ${req.admin.adminId}
    LIMIT 1
  `) as unknown as Array<{ id: string; estado: string }>;

  if (admin.length === 0 || admin[0].estado !== "activo") {
    res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Acceso denegado" } });
    return;
  }

  next();
}
