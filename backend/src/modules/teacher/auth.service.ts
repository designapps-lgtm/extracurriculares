import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import prisma from "../../config/prisma";
import { config } from "../../config";
import { AppError } from "../../middlewares/errorHandler";
import { TEACHER_AUTH_COOKIES } from "../../middlewares/teacherAuth";
import { createRefreshService } from "../../modules/auth/refreshTokens";

const teacherRefresh = createRefreshService({
  userIdField: "teacherId",
  refreshModel: prisma.teacherRefreshToken as any,
  cookieNames: {
    access: TEACHER_AUTH_COOKIES.access,
    refresh: TEACHER_AUTH_COOKIES.refresh,
  },
  buildAccessToken: ({ id, email }) =>
    jwt.sign({ teacherId: id, email }, config.jwtSecret, {
      expiresIn: config.accessTokenExpiresIn,
    } as jwt.SignOptions),
});

export async function teacherLogin(req: Request, res: Response) {
  const { email } = req.body;

  if (!email) {
    throw new AppError(400, "VALIDATION_ERROR", "Email es requerido");
  }

  const teacher = await prisma.teacher.findUnique({ where: { correo: email } });
  if (!teacher) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Correo no registrado como profesor");
  }

  if (teacher.estado !== "activo") {
    throw new AppError(403, "TEACHER_INACTIVE", "La cuenta está desactivada");
  }

  await teacherRefresh.issue(res, teacher.idProfesor, teacher.correo || "");

  res.json({
    success: true,
    data: {
      teacher: {
        idProfesor: teacher.idProfesor,
        nombre: teacher.nombre,
        apellido: teacher.apellido,
        email: teacher.correo,
      },
    },
  });
}

export async function teacherRefreshSession(req: Request, res: Response) {
  const teacherId = await teacherRefresh.rotate(req, res);
  const teacher = await prisma.teacher.findUnique({
    where: { idProfesor: teacherId },
    select: { idProfesor: true, nombre: true, apellido: true, correo: true, estado: true },
  });

  if (!teacher || teacher.estado !== "activo") {
    throw new AppError(403, "FORBIDDEN", "Acceso denegado");
  }

  res.json({
    success: true,
    data: {
      teacher: {
        idProfesor: teacher.idProfesor,
        nombre: teacher.nombre,
        apellido: teacher.apellido,
        email: teacher.correo,
      },
    },
  });
}

export async function teacherLogout(req: Request, res: Response) {
  await teacherRefresh.revoke(req, res);
  res.json({ success: true, data: { message: "Sesión cerrada" } });
}

export async function teacherMe(req: Request, res: Response) {
  if (!req.teacher) {
    throw new AppError(401, "UNAUTHORIZED", "No autenticado");
  }

  const teacher = await prisma.teacher.findUnique({
    where: { idProfesor: req.teacher.teacherId },
    select: { idProfesor: true, nombre: true, apellido: true, correo: true, estado: true },
  });

  if (!teacher || teacher.estado !== "activo") {
    throw new AppError(403, "FORBIDDEN", "Acceso denegado");
  }

  res.json({ success: true, data: teacher });
}