import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { googleOAuthClient } from "../../utils/googleOAuth";
import { sql, first } from "../../config/db";
import { config } from "../../config";
import { AppError } from "../../middlewares/errorHandler";
import { createRefreshService } from "./refreshTokens";
import { setAuthCookies, clearAuthCookies, TEACHER_REFRESH_COOKIE, SUPERVISOR_REFRESH_COOKIE, ADMIN_REFRESH_COOKIE, SECRETARY_REFRESH_COOKIE } from "../../utils/authCookies";
import { assertTrustedOrigin } from "../../utils/originGuard";

type Role = "admin" | "teacher" | "supervisor" | "secretary";

const teacherRefresh = createRefreshService({
  userIdField: "teacherId",
  tableName: "TeacherRefreshToken",
  buildAccessToken: ({ id, email }) =>
    jwt.sign({ teacherId: id, email }, config.jwtSecret, {
      expiresIn: config.accessTokenExpiresIn,
    } as jwt.SignOptions),
});

const supervisorRefresh = createRefreshService({
  userIdField: "supervisorId",
  tableName: "SupervisorRefreshToken",
  buildAccessToken: ({ id, email }) =>
    jwt.sign({ supervisorId: id, email }, config.jwtSecret, {
      expiresIn: config.accessTokenExpiresIn,
    } as jwt.SignOptions),
});

const secretaryRefresh = createRefreshService({
  userIdField: "secretaryId",
  tableName: "SecretaryRefreshToken",
  buildAccessToken: ({ id, email }) =>
    jwt.sign({ secretaryId: id, email }, config.jwtSecret, {
      expiresIn: config.accessTokenExpiresIn,
    } as jwt.SignOptions),
});

const adminRefresh = createRefreshService({
  userIdField: "adminId",
  tableName: "AdminRefreshToken",
  buildAccessToken: ({ id, email }) =>
    jwt.sign({ adminId: id, email }, config.jwtSecret, {
      expiresIn: config.accessTokenExpiresIn,
    } as jwt.SignOptions),
});

async function verifyGoogleCredential(credential: string): Promise<string> {
  if (!config.googleClientId) {
    throw new AppError(503, "GOOGLE_AUTH_NOT_CONFIGURED", "El inicio con Google no está configurado");
  }

  const client = googleOAuthClient;
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
  const matches: Array<{ role: Role; id: string; email: string; nombre: string; apellido: string; estado: string }> = [];

  // Las 3 búsquedas son independientes: se ejecutan en paralelo (1 round-trip
  // HTTP de Neón en vez de 3 secuenciales).
  const [adminRows, supRows, teacherRows, secRows] = await Promise.all([
    sql`SELECT "id", "email", "nombre", "apellido", "estado" FROM "AdminUser" WHERE "email" = ${email} LIMIT 1`,
    sql`SELECT "idSupervisor", "correo", "nombre", "apellido", "estado" FROM "Supervisor" WHERE "correo" = ${email} LIMIT 1`,
    sql`SELECT "idProfesor", "correo", "nombre", "apellido", "estado" FROM "Teacher" WHERE "correo" = ${email} LIMIT 1`,
    sql`SELECT "idSecretary", "correo", "nombre", "apellido", "estado" FROM "Secretary" WHERE "correo" = ${email} LIMIT 1`,
  ]);

  if (adminRows.length > 0) {
    const a = adminRows[0];
    matches.push({ role: "admin", id: a.id, email: a.email, nombre: a.nombre, apellido: a.apellido, estado: a.estado });
  }

  if (supRows.length > 0) {
    const s = supRows[0];
    matches.push({ role: "supervisor", id: s.idSupervisor, email: s.correo || email, nombre: s.nombre, apellido: s.apellido, estado: s.estado });
  }

  if (teacherRows.length > 0) {
    const t = teacherRows[0];
    matches.push({ role: "teacher", id: t.idProfesor, email: t.correo || email, nombre: t.nombre, apellido: t.apellido, estado: t.estado });
  }

  if (secRows.length > 0) {
    const s = secRows[0];
    matches.push({ role: "secretary", id: s.idSecretary, email: s.correo || email, nombre: s.nombre, apellido: s.apellido, estado: s.estado });
  }

  const priority: Record<Role, number> = { admin: 0, supervisor: 1, secretary: 2, teacher: 3 };
  matches.sort((a, b) => priority[a.role] - priority[b.role]);

  if (matches.length === 0) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Este correo no está registrado en el sistema");
  }

  // Si el mismo correo es supervisor Y secretaria (o admin, etc.), se entra con
  // el rol de mayor prioridad que esté ACTIVO. Un rol desactivado no debe
  // bloquear la entrada por otro rol que siga activo.
  const match = matches.find((m) => m.estado === "activo") ?? matches[0];

  if (match.estado !== "activo") {
    const code = match.role === "teacher" ? "TEACHER_INACTIVE" : match.role === "supervisor" ? "SUPERVISOR_INACTIVE" : match.role === "secretary" ? "SECRETARY_INACTIVE" : "ACCOUNT_DISABLED";
    const label = match.role === "teacher" ? "profesor" : match.role === "supervisor" ? "supervisor" : match.role === "secretary" ? "secretaria" : "administrador";
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
    case "secretary":
      tokens = await secretaryRefresh.issue(identity.id, identity.email);
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
  assertTrustedOrigin(req);

  const services: Record<Role, { revoke: (t: string) => Promise<void> }> = {
    teacher: teacherRefresh,
    supervisor: supervisorRefresh,
    secretary: secretaryRefresh,
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
  secretary: SECRETARY_REFRESH_COOKIE,
  admin: ADMIN_REFRESH_COOKIE,
};

export async function me(req: Request, res: Response) {
  for (const role of ["admin", "supervisor", "teacher", "secretary"] as Role[]) {
    const cookie = req.cookies?.[refreshMap[role]];
    if (!cookie) continue;

    try {
      const refreshService =
        role === "teacher"
          ? teacherRefresh
          : role === "supervisor"
            ? supervisorRefresh
            : role === "secretary"
              ? secretaryRefresh
              : adminRefresh;
      const { userId } = await refreshService.validate(cookie);

      let identity: UserIdentity | null = null;
      if (role === "teacher") {
        const rows = await sql`SELECT "idProfesor", "correo", "nombre", "apellido", "estado" FROM "Teacher" WHERE "idProfesor" = ${userId} LIMIT 1`;
        const t = rows[0] ?? null;
        if (t && t.estado === "activo") {
          identity = { role: "teacher", id: t.idProfesor, email: t.correo || "", nombre: t.nombre, apellido: t.apellido };
        }
      } else if (role === "supervisor") {
        const rows = await sql`SELECT "idSupervisor", "correo", "nombre", "apellido", "estado" FROM "Supervisor" WHERE "idSupervisor" = ${userId} LIMIT 1`;
        const s = rows[0] ?? null;
        if (s && s.estado === "activo") {
          identity = { role: "supervisor", id: s.idSupervisor, email: s.correo || "", nombre: s.nombre, apellido: s.apellido };
        }
      } else if (role === "secretary") {
        const rows = await sql`SELECT "idSecretary", "correo", "nombre", "apellido", "estado" FROM "Secretary" WHERE "idSecretary" = ${userId} LIMIT 1`;
        const s = rows[0] ?? null;
        if (s && s.estado === "activo") {
          identity = { role: "secretary", id: s.idSecretary, email: s.correo || "", nombre: s.nombre, apellido: s.apellido };
        }
      } else {
        const rows = await sql`SELECT "id", "email", "nombre", "apellido", "estado" FROM "AdminUser" WHERE "id" = ${userId} LIMIT 1`;
        const a = rows[0] ?? null;
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
      continue;
    }
  }

  throw new AppError(401, "UNAUTHORIZED", "No hay sesión activa");
}
