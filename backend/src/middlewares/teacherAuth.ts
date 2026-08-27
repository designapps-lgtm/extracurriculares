import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import prisma from "../config/prisma";

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

export const TEACHER_AUTH_COOKIES = {
  access: "teacher_access",
  refresh: "teacher_refresh",
} as const;

export function authenticateTeacher(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.teacher_access;
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

  const teacher = await prisma.teacher.findUnique({ where: { idProfesor: req.teacher.teacherId } });
  if (!teacher || teacher.estado !== "activo") {
    res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Acceso denegado" } });
    return;
  }

  next();
}