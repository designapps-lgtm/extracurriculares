import type { Request, Response } from "express";
import { AppError } from "../../middlewares/errorHandler";
import { assertTrustedOrigin } from "../../utils/originGuard";
import { clearAuthCookies } from "../../utils/authCookies";
import { getUserById } from "../../db/domain";
import { issueAuthSession, renewRoleSession, roleUserPayload } from "../auth/session";
import { resolveRoleByEmail, verifyGoogleCredential } from "../auth/unifiedAuth";

export async function teacherGoogleLogin(req: Request, res: Response): Promise<void> {
  const credential = typeof req.body?.credential === "string" ? req.body.credential : "";
  if (!credential) throw new AppError(400, "VALIDATION_ERROR", "Credencial de Google requerida");
  const email = await verifyGoogleCredential(credential);
  const teacher = await resolveRoleByEmail(email, "teacher");
  issueAuthSession(res, teacher);
  res.json({ success: true, data: { teacher: roleUserPayload(teacher) } });
}

export async function teacherRefreshSession(req: Request, res: Response): Promise<void> {
  const teacher = await renewRoleSession(req, res, "teacher");
  res.json({ success: true, data: { teacher: roleUserPayload(teacher) } });
}

export async function teacherLogout(req: Request, res: Response): Promise<void> {
  assertTrustedOrigin(req);
  clearAuthCookies(res, "teacher");
  res.json({ success: true, data: { message: "Sesión cerrada" } });
}

export async function teacherMe(req: Request, res: Response): Promise<void> {
  if (!req.teacher) throw new AppError(401, "UNAUTHORIZED", "No autenticado");
  const teacher = await getUserById(req.teacher.teacherId, "teacher");
  if (!teacher || !teacher.active) throw new AppError(403, "FORBIDDEN", "Acceso denegado");
  res.json({ success: true, data: roleUserPayload(teacher) });
}
