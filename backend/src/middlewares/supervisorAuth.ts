import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import prisma from "../config/prisma";
import { SUPERVISOR_ACCESS_COOKIE } from "../utils/authCookies";

import { extractBearerToken } from "./auth";

export interface SupervisorPayload {
  supervisorId: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      supervisor?: SupervisorPayload;
    }
  }
}

export function authenticateSupervisor(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req) || req.cookies?.[SUPERVISOR_ACCESS_COOKIE] || null;
  if (!token) {
    res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "No autenticado" } });
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as SupervisorPayload;
    req.supervisor = payload;
    next();
  } catch {
    res.status(401).json({ success: false, error: { code: "INVALID_TOKEN", message: "Token inválido o expirado" } });
  }
}

export async function requireActiveSupervisor(req: Request, res: Response, next: NextFunction) {
  if (!req.supervisor) {
    res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "No autenticado" } });
    return;
  }

  const supervisor = await prisma.supervisor.findUnique({ where: { idSupervisor: req.supervisor.supervisorId } });
  if (!supervisor || supervisor.estado !== "activo") {
    res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Acceso denegado" } });
    return;
  }

  next();
}