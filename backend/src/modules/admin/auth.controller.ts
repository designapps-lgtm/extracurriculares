import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../../config";
import { AppError } from "../../middlewares/errorHandler";
import { createRefreshService } from "../../modules/auth/refreshTokens";
import { setAuthCookies, clearAuthCookies, ADMIN_REFRESH_COOKIE } from "../../utils/authCookies";
import * as service from "./auth.service";

const adminRefresh = createRefreshService({
  userIdField: "adminId",
  tableName: "AdminRefreshToken",
  buildAccessToken: ({ id, email }) =>
    jwt.sign({ adminId: id, email }, config.jwtSecret, {
      expiresIn: config.accessTokenExpiresIn,
    } as jwt.SignOptions),
});

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  const admin = await service.login(email, password);
  const { accessToken, refreshToken } = await adminRefresh.issue(admin.id, admin.email);

  setAuthCookies(res, "admin", accessToken, refreshToken);

  res.json({
    success: true,
    data: {
      admin: { id: admin.id, email: admin.email, nombre: admin.nombre, apellido: admin.apellido },
    },
  });
}

export async function refreshSession(req: Request, res: Response) {
  const refreshToken = req.cookies?.[ADMIN_REFRESH_COOKIE];

  if (!refreshToken) {
    throw new AppError(401, "REFRESH_REQUIRED", "No hay sesión activa para renovar");
  }

  const { userId, refreshToken: newRefreshToken } = await adminRefresh.rotate(refreshToken, "");

  const admin = await service.getAdminById(userId);

  const accessToken = jwt.sign(
    { adminId: admin.id, email: admin.email },
    config.jwtSecret,
    { expiresIn: config.accessTokenExpiresIn } as jwt.SignOptions
  );

  setAuthCookies(res, "admin", accessToken, newRefreshToken);

  res.json({
    success: true,
    data: {
      admin: { id: admin.id, email: admin.email, nombre: admin.nombre, apellido: admin.apellido },
    },
  });
}

export async function logout(req: Request, res: Response) {
  const refreshToken = req.cookies?.[ADMIN_REFRESH_COOKIE];
  await adminRefresh.revoke(refreshToken);
  clearAuthCookies(res, "admin");
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

  setAuthCookies(res, "admin", accessToken, refreshToken);

  res.status(201).json({ success: true, data: { admin } });
}
