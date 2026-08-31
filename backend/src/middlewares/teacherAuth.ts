import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { sql } from "../config/db";
import { TEACHER_ACCESS_COOKIE } from "../utils/authCookies";

import { extractBearerToken } from "./auth";

export interface TeacherPayload {
  teacherId: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      teacher?: TeacherPayload;
    }
  }
}

export function authenticateTeacher(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req) || req.cookies?.[TEACHER_ACCESS_COOKIE] || null;
  if (!token) {
    res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "No autenticado" } });
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as TeacherPayload;
    req.teacher = payload;
    next();
  } catch {
    res.status(401).json({ success: false, error: { code: "INVALID_TOKEN", message: "Token inválido o expirado" } });
  }
}

export async function requireActiveTeacher(req: Request, res: Response, next: NextFunction) {
  if (!req.teacher) {
    res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "No autenticado" } });
    return;
  }

  const teacher = (await sql`
    SELECT "idProfesor", "estado"
    FROM "Teacher"
    WHERE "idProfesor" = ${req.teacher.teacherId}
    LIMIT 1
  `) as unknown as Array<{ idProfesor: string; estado: string }>;

  if (teacher.length === 0 || teacher[0].estado !== "activo") {
    res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Acceso denegado" } });
    return;
  }

  next();
}
