import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { sql } from "../config/db";
import { SECRETARY_ACCESS_COOKIE } from "../utils/authCookies";

import { extractBearerToken } from "./auth";

export interface SecretaryPayload {
  secretaryId: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      secretary?: SecretaryPayload;
    }
  }
}

export function authenticateSecretary(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req) || req.cookies?.[SECRETARY_ACCESS_COOKIE] || null;
  if (!token) {
    res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "No autenticado" } });
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as SecretaryPayload;
    req.secretary = payload;
    next();
  } catch {
    res.status(401).json({ success: false, error: { code: "INVALID_TOKEN", message: "Token inválido o expirado" } });
  }
}

export async function requireActiveSecretary(req: Request, res: Response, next: NextFunction) {
  if (!req.secretary) {
    res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "No autenticado" } });
    return;
  }

  const secretary = (await sql`
    SELECT "idSecretary", "estado"
    FROM "Secretary"
    WHERE "idSecretary" = ${req.secretary.secretaryId}
    LIMIT 1
  `) as unknown as Array<{ idSecretary: string; estado: string }>;

  if (secretary.length === 0 || secretary[0].estado !== "activo") {
    res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Acceso denegado" } });
    return;
  }

  next();
}
