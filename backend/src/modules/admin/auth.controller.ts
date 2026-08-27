import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import prisma from "../../config/prisma";
import { config } from "../../config";
import { AppError } from "../../middlewares/errorHandler";
import { createRefreshService } from "../../modules/auth/refreshTokens";
import * as service from "./auth.service";

const adminRefresh = createRefreshService({
  userIdField: "adminId",
  refreshModel: prisma.adminRefreshToken as any,
  buildAccessToken: ({ id, email }) =>
    jwt.sign({ adminId: id, email }, config.jwtSecret, {
      expiresIn: config.accessTokenExpiresIn,
    } as jwt.SignOptions),
});

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  const admin = await service.login(email, password);
  const { accessToken, refreshToken } = await adminRefresh.issue(admin.id, admin.email);

  res.json({
    success: true,
    data: {
      accessToken,
      refreshToken,
      admin: { id: admin.id, email: admin.email, nombre: admin.nombre, apellido: admin.apellido },
    },
  });
}

export async function refreshSession(req: Request, res: Response) {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError(401, "REFRESH_REQUIRED", "No hay sesión activa para renovar");
  }

  const { userId, accessToken, refreshToken: newRefreshToken } = await adminRefresh.rotate(
    refreshToken,
    ""
  );

  const admin = await service.getAdminById(userId);

  res.json({
    success: true,
    data: {
      accessToken,
      refreshToken: newRefreshToken,
      admin: { id: admin.id, email: admin.email, nombre: admin.nombre, apellido: admin.apellido },
    },
  });
}

export async function logout(req: Request, res: Response) {
  const { refreshToken } = req.body;
  await adminRefresh.revoke(refreshToken);
  res.json({ success: true, data: { message: "Sesión cerrada" } });
}

export async function me(req: Request, res: Response) {
  if (!req.admin) {
    throw new AppError(401, "UNAUTHORIZED", "No autenticado");
  }

  const admin = await service.getAdminById(req.admin.adminId);
  res.json({ success: true, data: admin });
}

export async function bootstrap(req: Request, res: Response) {
  const { email, password, nombre, apellido } = req.body;
  const admin = await service.bootstrap({ email, password, nombre, apellido });
  const { accessToken, refreshToken } = await adminRefresh.issue(admin.id, admin.email);

  res.status(201).json({ success: true, data: { admin, accessToken, refreshToken } });
}