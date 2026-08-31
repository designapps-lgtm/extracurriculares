import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import prisma from "../../config/prisma";
import { config } from "../../config";
import { AppError } from "../../middlewares/errorHandler";
import { createRefreshService } from "./refreshTokens";
import { setAuthCookies, clearAuthCookies, TEACHER_REFRESH_COOKIE, SUPERVISOR_REFRESH_COOKIE, ADMIN_REFRESH_COOKIE } from "../../utils/authCookies";

type Role = "admin" | "teacher" | "supervisor";

const teacherRefresh = createRefreshService({
  userIdField: "teacherId",
  refreshModel: prisma.teacherRefreshToken as any,
  buildAccessToken: ({ id, email }) =>
    jwt.sign({ teacherId: id, email }, config.jwtSecret, {
      expiresIn: config.accessTokenExpiresIn,
    } as jwt.SignOptions),
});

const supervisorRefresh = createRefreshService({
  userIdField: "supervisorId",
  refreshModel: prisma.supervisorRefreshToken as any,
  buildAccessToken: ({ id, email }) =>
    jwt.sign({ supervisorId: id, email }, config.jwtSecret, {
      expiresIn: config.accessTokenExpiresIn,
    } as jwt.SignOptions),
});

const adminRefresh = createRefreshService({
  userIdField: "adminId",
  refreshModel: prisma.adminRefreshToken as any,
  buildAccessToken: ({ id, email }) =>
    jwt.sign({ adminId: id, email }, config.jwtSecret, {
      expiresIn: config.accessTokenExpiresIn,
    } as jwt.SignOptions),
});

async function verifyGoogleCredential(credential: string): Promise<string> {
  if (!config.googleClientId) {
    throw new AppError(503, "GOOGLE_AUTH_NOT_CONFIGURED", "El inicio con Google no está configurado");
  }

  const client = new OAuth2Client(config.googleClientId);
  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: config.googleClientId,
    });
    payload = ticket.getPayload();
  } catch {
    throw new AppError(401, "INVALID_GOOGLE_TOKEN", "La credencial de Google es inválida o expiró");
  }

  if (!payload || payload.email_verified !== true) {
    throw new AppError(403, "GOOGLE_EMAIL_NOT_VERIFIED", "La cuenta de Google no tiene el correo verificado");
  }

  if (payload.hd && payload.hd.toLowerCase() !== config.googleInstitutionDomain.toLowerCase()) {
    throw new AppError(403, "GOOGLE_DOMAIN_NOT_ALLOWED", `La cuenta debe ser de la institución (${config.googleInstitutionDomain})`);
  }

  const email = payload.email?.toLowerCase() || "";
  if (!email) {
    throw new AppError(401, "INVALID_GOOGLE_TOKEN", "No se pudo obtener el correo de la cuenta de Google");
  }
  return email;
}

interface UserIdentity {
  role: Role;
  id: string;
  email: string;
  nombre: string;
  apellido: string;
}

async function resolveRoleByEmail(email: string): Promise<UserIdentity> {
  // Prioridad de rol: si el mismo correo existe en varias tablas, gana el de
  // mayor jerarquía (admin > supervisor > teacher), para que por ejemplo un
  // admin que también figura como profesor entre siempre al panel administrativo.
  const matches: Array<{ role: Role; id: string; email: string; nombre: string; apellido: string; estado: string }> = [];

  const admin = await prisma.adminUser.findUnique({
    where: { email },
    select: { id: true, email: true, nombre: true, apellido: true, estado: true },
  });
  if (admin) matches.push({ role: "admin", id: admin.id, email: admin.email, nombre: admin.nombre, apellido: admin.apellido, estado: admin.estado });

  const supervisor = await prisma.supervisor.findUnique({
    where: { correo: email },
    select: { idSupervisor: true, correo: true, nombre: true, apellido: true, estado: true },
  });
  if (supervisor) matches.push({ role: "supervisor", id: supervisor.idSupervisor, email: supervisor.correo || email, nombre: supervisor.nombre, apellido: supervisor.apellido, estado: supervisor.estado });

  const teacher = await prisma.teacher.findUnique({
    where: { correo: email },
    select: { idProfesor: true, correo: true, nombre: true, apellido: true, estado: true },
  });
  if (teacher) matches.push({ role: "teacher", id: teacher.idProfesor, email: teacher.correo || email, nombre: teacher.nombre, apellido: teacher.apellido, estado: teacher.estado });

  const priority: Record<Role, number> = { admin: 0, supervisor: 1, teacher: 2 };
  matches.sort((a, b) => priority[a.role] - priority[b.role]);

  const match = matches[0];
  if (!match) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Este correo no está registrado en el sistema");
  }

  if (match.estado !== "activo") {
    const code = match.role === "teacher" ? "TEACHER_INACTIVE" : match.role === "supervisor" ? "SUPERVISOR_INACTIVE" : "ACCOUNT_DISABLED";
    const label = match.role === "teacher" ? "profesor" : match.role === "supervisor" ? "supervisor" : "administrador";
    throw new AppError(403, code, `Tu cuenta de ${label} está desactivada`);
  }

  return { role: match.role, id: match.id, email: match.email, nombre: match.nombre, apellido: match.apellido };
}

async function issueSession(res: Response, identity: UserIdentity) {
  let tokens;
  switch (identity.role) {
    case "teacher":
      tokens = await teacherRefresh.issue(identity.id, identity.email);
      break;
    case "supervisor":
      tokens = await supervisorRefresh.issue(identity.id, identity.email);
      break;
    default:
      tokens = await adminRefresh.issue(identity.id, identity.email);
      break;
  }
  setAuthCookies(res, identity.role, tokens.accessToken, tokens.refreshToken);
}

export async function googleLogin(req: Request, res: Response) {
  const { credential } = req.body;

  if (!credential) {
    throw new AppError(400, "VALIDATION_ERROR", "Credencial de Google requerida");
  }

  const email = await verifyGoogleCredential(credential);
  const identity = await resolveRoleByEmail(email);

  await issueSession(res, identity);

  res.json({
    success: true,
    data: {
      role: identity.role,
      user: {
        id: identity.id,
        nombre: identity.nombre,
        apellido: identity.apellido,
        email: identity.email,
      },
    },
  });
}

export async function logout(req: Request, res: Response) {
  const services: Record<Role, { revoke: (t: string) => Promise<void> }> = {
    teacher: teacherRefresh,
    supervisor: supervisorRefresh,
    admin: adminRefresh,
  };
  for (const role of Object.keys(refreshMap) as Role[]) {
    const cookie = req.cookies?.[refreshMap[role]];
    if (cookie) {
      await services[role].revoke(cookie);
    }
    clearAuthCookies(res, role);
  }
  res.json({ success: true, data: { message: "Sesión cerrada" } });
}

const refreshMap: Record<Role, string> = {
  teacher: TEACHER_REFRESH_COOKIE,
  supervisor: SUPERVISOR_REFRESH_COOKIE,
  admin: ADMIN_REFRESH_COOKIE,
};

export async function me(req: Request, res: Response) {
  for (const role of ["teacher", "supervisor", "admin"] as Role[]) {
    const cookie = req.cookies?.[refreshMap[role]];
    if (!cookie) continue;

    try {
      const refreshService =
        role === "teacher" ? teacherRefresh : role === "supervisor" ? supervisorRefresh : adminRefresh;
      const { userId } = await refreshService.validate(cookie);

      let identity: UserIdentity | null = null;
      if (role === "teacher") {
        const t = await prisma.teacher.findUnique({
          where: { idProfesor: userId },
          select: { idProfesor: true, correo: true, nombre: true, apellido: true, estado: true },
        });
        if (t && t.estado === "activo") {
          identity = { role: "teacher", id: t.idProfesor, email: t.correo || "", nombre: t.nombre, apellido: t.apellido };
        }
      } else if (role === "supervisor") {
        const s = await prisma.supervisor.findUnique({
          where: { idSupervisor: userId },
          select: { idSupervisor: true, correo: true, nombre: true, apellido: true, estado: true },
        });
        if (s && s.estado === "activo") {
          identity = { role: "supervisor", id: s.idSupervisor, email: s.correo || "", nombre: s.nombre, apellido: s.apellido };
        }
      } else {
        const a = await prisma.adminUser.findUnique({
          where: { id: userId },
          select: { id: true, email: true, nombre: true, apellido: true, estado: true },
        });
        if (a && a.estado === "activo") {
          identity = { role: "admin", id: a.id, email: a.email, nombre: a.nombre, apellido: a.apellido };
        }
      }

      if (identity) {
        res.json({
          success: true,
          data: {
            role: identity.role,
            user: { id: identity.id, nombre: identity.nombre, apellido: identity.apellido, email: identity.email },
          },
        });
        return;
      }
    } catch {
      // Token de refresh inválido/expirado para este rol → intentar el siguiente.
      continue;
    }
  }

  throw new AppError(401, "UNAUTHORIZED", "No hay sesión activa");
}
