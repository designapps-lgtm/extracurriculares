import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import prisma from "../../config/prisma";
import { config } from "../../config";
import { AppError } from "../../middlewares/errorHandler";
import { createRefreshService } from "../../modules/auth/refreshTokens";
import { setAuthCookies, clearAuthCookies, SUPERVISOR_REFRESH_COOKIE } from "../../utils/authCookies";

const supervisorRefresh = createRefreshService({
  userIdField: "supervisorId",
  refreshModel: prisma.supervisorRefreshToken as any,
  buildAccessToken: ({ id, email }) =>
    jwt.sign({ supervisorId: id, email }, config.jwtSecret, {
      expiresIn: config.accessTokenExpiresIn,
    } as jwt.SignOptions),
});

export async function supervisorLogin(req: Request, res: Response) {
  const { email } = req.body;

  if (!email) {
    throw new AppError(400, "VALIDATION_ERROR", "Email es requerido");
  }

  const supervisor = await prisma.supervisor.findUnique({ where: { correo: email } });
  if (!supervisor) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Correo no registrado como supervisor");
  }

  if (supervisor.estado !== "activo") {
    throw new AppError(403, "SUPERVISOR_INACTIVE", "La cuenta está desactivada");
  }

  const { accessToken, refreshToken } = await supervisorRefresh.issue(
    supervisor.idSupervisor,
    supervisor.correo || ""
  );

  setAuthCookies(res, "supervisor", accessToken, refreshToken);

  res.json({
    success: true,
    data: {
      supervisor: {
        idSupervisor: supervisor.idSupervisor,
        nombre: supervisor.nombre,
        apellido: supervisor.apellido,
        email: supervisor.correo,
      },
    },
  });
}

export async function supervisorRefreshSession(req: Request, res: Response) {
  const refreshToken = req.cookies?.[SUPERVISOR_REFRESH_COOKIE];

  if (!refreshToken) {
    throw new AppError(401, "REFRESH_REQUIRED", "No hay sesión activa para renovar");
  }

  const { userId, refreshToken: newRefreshToken } = await supervisorRefresh.rotate(refreshToken, "");

  const supervisor = await prisma.supervisor.findUnique({
    where: { idSupervisor: userId },
    select: { idSupervisor: true, nombre: true, apellido: true, correo: true, estado: true },
  });

  if (!supervisor || supervisor.estado !== "activo") {
    throw new AppError(403, "FORBIDDEN", "Acceso denegado");
  }

  const accessToken = jwt.sign(
    { supervisorId: supervisor.idSupervisor, email: supervisor.correo },
    config.jwtSecret,
    { expiresIn: config.accessTokenExpiresIn } as jwt.SignOptions
  );

  setAuthCookies(res, "supervisor", accessToken, newRefreshToken);

  res.json({
    success: true,
    data: {
      supervisor: {
        idSupervisor: supervisor.idSupervisor,
        nombre: supervisor.nombre,
        apellido: supervisor.apellido,
        email: supervisor.correo,
      },
    },
  });
}

export async function supervisorLogout(req: Request, res: Response) {
  const refreshToken = req.cookies?.[SUPERVISOR_REFRESH_COOKIE];
  await supervisorRefresh.revoke(refreshToken);
  clearAuthCookies(res, "supervisor");
  res.json({ success: true, data: { message: "Sesión cerrada" } });
}

export async function supervisorMe(req: Request, res: Response) {
  if (!req.supervisor) {
    throw new AppError(401, "UNAUTHORIZED", "No autenticado");
  }

  const supervisor = await prisma.supervisor.findUnique({
    where: { idSupervisor: req.supervisor.supervisorId },
    select: { idSupervisor: true, nombre: true, apellido: true, correo: true, estado: true },
  });

  if (!supervisor || supervisor.estado !== "activo") {
    throw new AppError(403, "FORBIDDEN", "Acceso denegado");
  }

  res.json({ success: true, data: supervisor });
}