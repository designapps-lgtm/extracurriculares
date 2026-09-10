import type { Request, Response } from "express";
import { config } from "../../config";
import { AppError } from "../../middlewares/errorHandler";
import { googleOAuthClient } from "../../utils/googleOAuth";
import { assertTrustedOrigin } from "../../utils/originGuard";
import { getUsersByEmail, type AppUser, type UserRole } from "../../db/domain";
import {
  clearAllAuthCookies,
  issueAuthSession,
  refreshCookieForRole,
  renewRoleSession,
} from "./session";

const ROLE_PRIORITY: Record<UserRole, number> = { admin: 0, supervisor: 1, secretary: 2, teacher: 3 };

export async function verifyGoogleCredential(credential: string): Promise<string> {
  if (!config.googleClientId) throw new AppError(503, "GOOGLE_AUTH_NOT_CONFIGURED", "El inicio con Google no está configurado");
  try {
    const ticket = await googleOAuthClient.verifyIdToken({ idToken: credential, audience: config.googleClientId });
    const payload = ticket.getPayload();
    if (!payload || payload.email_verified !== true) {
      throw new AppError(403, "GOOGLE_EMAIL_NOT_VERIFIED", "La cuenta de Google no tiene el correo verificado");
    }
    if (payload.hd && payload.hd.toLowerCase() !== config.googleInstitutionDomain.toLowerCase()) {
      throw new AppError(403, "GOOGLE_DOMAIN_NOT_ALLOWED", `La cuenta debe ser de la institución (${config.googleInstitutionDomain})`);
    }
    const email = payload.email?.trim().toLowerCase();
    if (!email) throw new AppError(401, "INVALID_GOOGLE_TOKEN", "No se pudo obtener el correo de la cuenta de Google");
    return email;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(401, "INVALID_GOOGLE_TOKEN", "La credencial de Google es inválida o expiró");
  }
}

export async function resolveRoleByEmail(email: string, requiredRole?: UserRole): Promise<AppUser> {
  const matches = (await getUsersByEmail(email, { fresh: true }))
    .filter((user) => !requiredRole || user.role === requiredRole)
    .sort((a, b) => ROLE_PRIORITY[a.role] - ROLE_PRIORITY[b.role]);
  if (matches.length === 0) {
    const message = requiredRole ? `Correo no registrado con el rol ${requiredRole}` : "Este correo no está registrado en el sistema";
    throw new AppError(401, "INVALID_CREDENTIALS", message);
  }
  const user = matches.find((candidate) => candidate.active) ?? matches[0];
  if (!user.active) {
    const code = user.role === "teacher" ? "TEACHER_INACTIVE" : user.role === "supervisor" ? "SUPERVISOR_INACTIVE" : user.role === "secretary" ? "SECRETARY_INACTIVE" : "ACCOUNT_DISABLED";
    throw new AppError(403, code, "La cuenta está desactivada");
  }
  return user;
}

export async function googleLogin(req: Request, res: Response): Promise<void> {
  const credential = typeof req.body?.credential === "string" ? req.body.credential : "";
  if (!credential) throw new AppError(400, "VALIDATION_ERROR", "Credencial de Google requerida");
  const email = await verifyGoogleCredential(credential);
  const user = await resolveRoleByEmail(email);
  issueAuthSession(res, user);
  res.json({
    success: true,
    data: {
      role: user.role,
      user: { id: user.id, nombre: user.firstName, apellido: user.lastName, email: user.email, permissions: user.permissions },
    },
  });
}

export async function logout(req: Request, res: Response): Promise<void> {
  assertTrustedOrigin(req);
  clearAllAuthCookies(res);
  res.json({ success: true, data: { message: "Sesión cerrada" } });
}

export async function me(req: Request, res: Response): Promise<void> {
  for (const role of ["admin", "supervisor", "secretary", "teacher"] as UserRole[]) {
    if (!req.cookies?.[refreshCookieForRole(role)]) continue;
    try {
      const user = await renewRoleSession(req, res, role, { enforceOrigin: false });
      res.json({
        success: true,
        data: {
          role: user.role,
          user: { id: user.id, nombre: user.firstName, apellido: user.lastName, email: user.email, permissions: user.permissions },
        },
      });
      return;
    } catch {
      continue;
    }
  }
  throw new AppError(401, "UNAUTHORIZED", "No hay sesión activa");
}
