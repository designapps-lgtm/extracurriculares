import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken, type AccessClaims } from "../modules/auth/session";
import { SUPERVISOR_ACCESS_COOKIE } from "../utils/authCookies";
import { extractBearerToken } from "./auth";

export interface SupervisorPayload extends AccessClaims {
  supervisorId: string;
}

declare global {
  namespace Express {
    interface Request {
      supervisor?: SupervisorPayload;
    }
  }
}

export function authenticateSupervisor(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req) || req.cookies?.[SUPERVISOR_ACCESS_COOKIE] || null;
  if (!token) {
    res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "No autenticado" } });
    return;
  }
  try {
    const claims = verifyAccessToken(token, "supervisor");
    req.supervisor = { ...claims, supervisorId: claims.userId };
    next();
  } catch {
    res.status(401).json({ success: false, error: { code: "INVALID_TOKEN", message: "Token inválido o expirado" } });
  }
}

export function requireActiveSupervisor(req: Request, res: Response, next: NextFunction): void {
  if (!req.supervisor || req.supervisor.role !== "supervisor") {
    res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Acceso denegado" } });
    return;
  }
  next();
}
