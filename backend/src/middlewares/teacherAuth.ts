import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken, type AccessClaims } from "../modules/auth/session";
import { TEACHER_ACCESS_COOKIE } from "../utils/authCookies";
import { extractBearerToken } from "./auth";

export interface TeacherPayload extends AccessClaims {
  teacherId: string;
}

declare global {
  namespace Express {
    interface Request {
      teacher?: TeacherPayload;
    }
  }
}

export function authenticateTeacher(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req) || req.cookies?.[TEACHER_ACCESS_COOKIE] || null;
  if (!token) {
    res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "No autenticado" } });
    return;
  }
  try {
    const claims = verifyAccessToken(token, "teacher");
    req.teacher = { ...claims, teacherId: claims.userId };
    next();
  } catch {
    res.status(401).json({ success: false, error: { code: "INVALID_TOKEN", message: "Token inválido o expirado" } });
  }
}

export function requireActiveTeacher(req: Request, res: Response, next: NextFunction): void {
  if (!req.teacher || req.teacher.role !== "teacher") {
    res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Acceso denegado" } });
    return;
  }
  next();
}
