import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken, type AccessClaims } from "../modules/auth/session";
import { SECRETARY_ACCESS_COOKIE } from "../utils/authCookies";
import { extractBearerToken } from "./auth";

export interface SecretaryPayload extends AccessClaims {
  secretaryId: string;
}

declare global {
  namespace Express {
    interface Request {
      secretary?: SecretaryPayload;
    }
  }
}

export function authenticateSecretary(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req) || req.cookies?.[SECRETARY_ACCESS_COOKIE] || null;
  if (!token) {
    res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "No autenticado" } });
    return;
  }
  try {
    const claims = verifyAccessToken(token, "secretary");
    req.secretary = { ...claims, secretaryId: claims.userId };
    next();
  } catch {
    res.status(401).json({ success: false, error: { code: "INVALID_TOKEN", message: "Token inválido o expirado" } });
  }
}

export function requireActiveSecretary(req: Request, res: Response, next: NextFunction): void {
  if (!req.secretary || req.secretary.role !== "secretary") {
    res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Acceso denegado" } });
    return;
  }
  next();
}
