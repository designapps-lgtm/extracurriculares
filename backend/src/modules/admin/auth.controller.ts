import type { Request, Response } from "express";
import { AppError } from "../../middlewares/errorHandler";
import { assertTrustedOrigin } from "../../utils/originGuard";
import { clearAuthCookies } from "../../utils/authCookies";
import { renewRoleSession, roleUserPayload } from "../auth/session";
import * as service from "./auth.service";

export async function login(_req: Request, _res: Response): Promise<void> {
  throw new AppError(410, "PASSWORD_LOGIN_DISABLED", "El acceso con contraseña fue retirado. Use Iniciar sesión con Google.");
}

export async function refreshSession(req: Request, res: Response): Promise<void> {
  const admin = await renewRoleSession(req, res, "admin");
  res.json({ success: true, data: { admin: roleUserPayload(admin) } });
}

export async function logout(req: Request, res: Response): Promise<void> {
  assertTrustedOrigin(req);
  clearAuthCookies(res, "admin");
  res.json({ success: true, data: { message: "Sesión cerrada" } });
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.admin) throw new AppError(401, "UNAUTHORIZED", "No autenticado");
  res.json({ success: true, data: await service.getAdminById(req.admin.adminId) });
}

export async function bootstrap(_req: Request, _res: Response): Promise<void> {
  throw new AppError(410, "BOOTSTRAP_DISABLED", "El bootstrap con contraseña fue retirado. Use Usuarios_Roles y Google.");
}
