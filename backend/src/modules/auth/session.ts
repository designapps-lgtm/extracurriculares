import type { Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { config } from "../../config";
import { AppError } from "../../middlewares/errorHandler";
import { assertTrustedOrigin } from "../../utils/originGuard";
import {
  ADMIN_REFRESH_COOKIE,
  SECRETARY_REFRESH_COOKIE,
  SUPERVISOR_REFRESH_COOKIE,
  TEACHER_REFRESH_COOKIE,
  clearAuthCookies,
  setAuthCookies,
} from "../../utils/authCookies";
import { getUserById, type AppUser, type UserPermissions, type UserRole } from "../../db/domain";

export interface AccessClaims extends JwtPayload {
  tokenType: "access";
  role: UserRole;
  userId: string;
  email: string;
  permissions: UserPermissions;
  adminId?: string;
  teacherId?: string;
  supervisorId?: string;
  secretaryId?: string;
}

interface RefreshClaims extends JwtPayload {
  tokenType: "refresh";
  role: UserRole;
  userId: string;
  email: string;
}

const REFRESH_COOKIES: Record<UserRole, string> = {
  admin: ADMIN_REFRESH_COOKIE,
  teacher: TEACHER_REFRESH_COOKIE,
  supervisor: SUPERVISOR_REFRESH_COOKIE,
  secretary: SECRETARY_REFRESH_COOKIE,
};

function roleIdClaim(role: UserRole, id: string): Record<string, string> {
  if (role === "admin") return { adminId: id };
  if (role === "teacher") return { teacherId: id };
  if (role === "supervisor") return { supervisorId: id };
  return { secretaryId: id };
}

export function signAccessToken(user: AppUser): string {
  return jwt.sign(
    {
      tokenType: "access",
      role: user.role,
      userId: user.id,
      email: user.email,
      permissions: user.permissions,
      ...roleIdClaim(user.role, user.id),
    },
    config.jwtSecret,
    { expiresIn: config.accessTokenExpiresIn } as jwt.SignOptions,
  );
}

export function signRefreshToken(user: AppUser): string {
  return jwt.sign(
    { tokenType: "refresh", role: user.role, userId: user.id, email: user.email },
    config.jwtSecret,
    { expiresIn: `${config.sessionDurationHours}h`, jwtid: crypto.randomUUID() } as jwt.SignOptions,
  );
}

export function verifyAccessToken(token: string, expectedRole: UserRole): AccessClaims {
  try {
    const claims = jwt.verify(token, config.jwtSecret) as AccessClaims;
    if (claims.tokenType !== "access" || claims.role !== expectedRole || !claims.userId || !claims.email) throw new Error("claims");
    return claims;
  } catch {
    throw new AppError(401, "INVALID_TOKEN", "Token inválido o expirado");
  }
}

function verifyRefreshToken(token: string, expectedRole?: UserRole): RefreshClaims {
  try {
    const claims = jwt.verify(token, config.jwtSecret) as RefreshClaims;
    if (claims.tokenType !== "refresh" || !claims.role || !claims.userId || !claims.email) throw new Error("claims");
    if (expectedRole && claims.role !== expectedRole) throw new Error("role");
    return claims;
  } catch {
    throw new AppError(401, "INVALID_REFRESH_TOKEN", "La sesión expiró o no es válida. Inicie sesión nuevamente.");
  }
}

export function issueAuthSession(res: Response, user: AppUser): { accessToken: string; refreshToken: string } {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  setAuthCookies(res, user.role, accessToken, refreshToken);
  return { accessToken, refreshToken };
}

export async function renewRoleSession(
  req: Request,
  res: Response,
  role: UserRole,
  options: { enforceOrigin?: boolean } = {},
): Promise<AppUser> {
  if (options.enforceOrigin !== false) assertTrustedOrigin(req);
  const token = req.cookies?.[REFRESH_COOKIES[role]];
  if (!token) throw new AppError(401, "REFRESH_REQUIRED", "No hay sesión activa para renovar");
  const claims = verifyRefreshToken(token, role);
  const user = await getUserById(claims.userId, role, { fresh: true });
  if (!user || !user.active || user.email !== claims.email.toLowerCase()) {
    clearAuthCookies(res, role);
    throw new AppError(403, "FORBIDDEN", "La cuenta no existe o está desactivada");
  }
  issueAuthSession(res, user);
  return user;
}

export function clearAllAuthCookies(res: Response): void {
  for (const role of Object.keys(REFRESH_COOKIES) as UserRole[]) clearAuthCookies(res, role);
}

export function refreshCookieForRole(role: UserRole): string {
  return REFRESH_COOKIES[role];
}

export function roleUserPayload(user: AppUser): Record<string, unknown> {
  if (user.role === "teacher") {
    return { idProfesor: user.id, codigoProfesor: user.code, nombre: user.firstName, apellido: user.lastName, correo: user.email, email: user.email, fotoUrl: user.photoUrl, estado: user.status };
  }
  if (user.role === "supervisor") {
    return { idSupervisor: user.id, codigoSupervisor: user.code, nombre: user.firstName, apellido: user.lastName, correo: user.email, email: user.email, fotoUrl: user.photoUrl, estado: user.status };
  }
  if (user.role === "secretary") {
    return { idSecretary: user.id, codigoSecretary: user.code, nombre: user.firstName, apellido: user.lastName, correo: user.email, email: user.email, fotoUrl: user.photoUrl, estado: user.status };
  }
  return { id: user.id, email: user.email, nombre: user.firstName, apellido: user.lastName, estado: user.status, createdAt: user.createdAt };
}
