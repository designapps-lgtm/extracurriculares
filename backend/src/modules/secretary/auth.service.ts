import type { Request, Response } from "express";
import { AppError } from "../../middlewares/errorHandler";
import { assertTrustedOrigin } from "../../utils/originGuard";
import { clearAuthCookies } from "../../utils/authCookies";
import { getUserById } from "../../db/domain";
import { renewRoleSession, roleUserPayload } from "../auth/session";

export async function secretaryRefreshSession(req: Request, res: Response): Promise<void> {
  const secretary = await renewRoleSession(req, res, "secretary");
  res.json({ success: true, data: { secretary: roleUserPayload(secretary) } });
}

export async function secretaryLogout(req: Request, res: Response): Promise<void> {
  assertTrustedOrigin(req);
  clearAuthCookies(res, "secretary");
  res.json({ success: true, data: { message: "Sesión cerrada" } });
}

export async function secretaryMe(req: Request, res: Response): Promise<void> {
  if (!req.secretary) throw new AppError(401, "UNAUTHORIZED", "No autenticado");
  const secretary = await getUserById(req.secretary.secretaryId, "secretary");
  if (!secretary || !secretary.active) throw new AppError(403, "FORBIDDEN", "Acceso denegado");
  res.json({ success: true, data: roleUserPayload(secretary) });
}
