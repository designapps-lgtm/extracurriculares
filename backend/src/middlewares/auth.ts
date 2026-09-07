import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken, type AccessClaims } from "../modules/auth/session";
import { ADMIN_ACCESS_COOKIE } from "../utils/authCookies";

export interface AuthPayload extends AccessClaims {
  adminId: string;
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

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req) || req.cookies?.[ADMIN_ACCESS_COOKIE] || null;
  if (!token) {
    res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "No autenticado" } });
    return;
  }
  try {
    const claims = verifyAccessToken(token, "admin");
    req.admin = { ...claims, adminId: claims.userId };
    next();
  } catch {
    res.status(401).json({ success: false, error: { code: "INVALID_TOKEN", message: "Token inválido o expirado" } });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.admin || req.admin.role !== "admin") {
    res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Acceso denegado" } });
    return;
  }
  next();
}
