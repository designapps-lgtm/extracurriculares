import type { Request, Response } from "express";
import { AppError } from "../../middlewares/errorHandler";
import { assertTrustedOrigin } from "../../utils/originGuard";
import { clearAuthCookies } from "../../utils/authCookies";
import { getUserById } from "../appsheet/appsheet.domain";
import { renewRoleSession, roleUserPayload } from "../auth/session";

export async function supervisorRefreshSession(req: Request, res: Response): Promise<void> {
  const supervisor = await renewRoleSession(req, res, "supervisor");
  res.json({ success: true, data: { supervisor: roleUserPayload(supervisor) } });
}

export async function supervisorLogout(req: Request, res: Response): Promise<void> {
  assertTrustedOrigin(req);
  clearAuthCookies(res, "supervisor");
  res.json({ success: true, data: { message: "Sesión cerrada" } });
}

export async function supervisorMe(req: Request, res: Response): Promise<void> {
  if (!req.supervisor) throw new AppError(401, "UNAUTHORIZED", "No autenticado");
  const supervisor = await getUserById(req.supervisor.supervisorId, "supervisor");
  if (!supervisor || !supervisor.active) throw new AppError(403, "FORBIDDEN", "Acceso denegado");
  res.json({ success: true, data: roleUserPayload(supervisor) });
}
