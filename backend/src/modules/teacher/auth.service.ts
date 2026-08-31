import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { googleOAuthClient } from "../../utils/googleOAuth";
import { sql } from "../../config/db";
import { config } from "../../config";
import { AppError } from "../../middlewares/errorHandler";
import { createRefreshService } from "../../modules/auth/refreshTokens";
import { setAuthCookies, clearAuthCookies, TEACHER_REFRESH_COOKIE } from "../../utils/authCookies";

const teacherRefresh = createRefreshService({
  userIdField: "teacherId",
  tableName: "TeacherRefreshToken",
  buildAccessToken: ({ id, email }) =>
    jwt.sign({ teacherId: id, email }, config.jwtSecret, {
      expiresIn: config.accessTokenExpiresIn,
    } as jwt.SignOptions),
});

export async function teacherLogin(req: Request, res: Response) {
  const { email } = req.body;

  if (!email) {
    throw new AppError(400, "VALIDATION_ERROR", "Email es requerido");
  }

  const rows = await sql`SELECT * FROM "Teacher" WHERE "correo" = ${email} LIMIT 1`;
  const teacher = rows[0] ?? null;

  if (!teacher) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Correo no registrado como profesor");
  }

  if (teacher.estado !== "activo") {
    throw new AppError(403, "TEACHER_INACTIVE", "La cuenta está desactivada");
  }

  const { accessToken, refreshToken } = await teacherRefresh.issue(
    teacher.idProfesor,
    teacher.correo || ""
  );

  setAuthCookies(res, "teacher", accessToken, refreshToken);

  res.json({
    success: true,
    data: {
      teacher: {
        idProfesor: teacher.idProfesor,
        nombre: teacher.nombre,
        apellido: teacher.apellido,
        email: teacher.correo,
      },
    },
  });
}

export async function teacherGoogleLogin(req: Request, res: Response) {
  const { credential } = req.body;

  if (!credential) {
    throw new AppError(400, "VALIDATION_ERROR", "Credencial de Google requerida");
  }

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

  const email = payload.email?.toLowerCase() || "";
  if (payload.hd && payload.hd.toLowerCase() !== config.googleInstitutionDomain.toLowerCase()) {
    throw new AppError(403, "GOOGLE_DOMAIN_NOT_ALLOWED", `La cuenta debe ser de la institución (${config.googleInstitutionDomain})`);
  }

  const rows = await sql`SELECT * FROM "Teacher" WHERE "correo" = ${email} LIMIT 1`;
  const teacher = rows[0] ?? null;

  if (!teacher) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Correo no registrado como profesor");
  }

  if (teacher.estado !== "activo") {
    throw new AppError(403, "TEACHER_INACTIVE", "La cuenta está desactivada");
  }

  const { accessToken, refreshToken } = await teacherRefresh.issue(
    teacher.idProfesor,
    teacher.correo || ""
  );

  setAuthCookies(res, "teacher", accessToken, refreshToken);

  res.json({
    success: true,
    data: {
      teacher: {
        idProfesor: teacher.idProfesor,
        nombre: teacher.nombre,
        apellido: teacher.apellido,
        email: teacher.correo,
      },
    },
  });
}

export async function teacherRefreshSession(req: Request, res: Response) {
  const refreshToken = req.cookies?.[TEACHER_REFRESH_COOKIE];

  if (!refreshToken) {
    throw new AppError(401, "REFRESH_REQUIRED", "No hay sesión activa para renovar");
  }

  const { userId, refreshToken: newRefreshToken } = await teacherRefresh.rotate(refreshToken, "");

  const rows = await sql`SELECT "idProfesor", "nombre", "apellido", "correo", "estado" FROM "Teacher" WHERE "idProfesor" = ${userId} LIMIT 1`;
  const teacher = rows[0] ?? null;

  if (!teacher || teacher.estado !== "activo") {
    throw new AppError(403, "FORBIDDEN", "Acceso denegado");
  }

  const accessToken = jwt.sign(
    { teacherId: teacher.idProfesor, email: teacher.correo },
    config.jwtSecret,
    { expiresIn: config.accessTokenExpiresIn } as jwt.SignOptions
  );

  setAuthCookies(res, "teacher", accessToken, newRefreshToken);

  res.json({
    success: true,
    data: {
      teacher: {
        idProfesor: teacher.idProfesor,
        nombre: teacher.nombre,
        apellido: teacher.apellido,
        email: teacher.correo,
      },
    },
  });
}

export async function teacherLogout(req: Request, res: Response) {
  const refreshToken = req.cookies?.[TEACHER_REFRESH_COOKIE];
  await teacherRefresh.revoke(refreshToken);
  clearAuthCookies(res, "teacher");
  res.json({ success: true, data: { message: "Sesión cerrada" } });
}

export async function teacherMe(req: Request, res: Response) {
  if (!req.teacher) {
    throw new AppError(401, "UNAUTHORIZED", "No autenticado");
  }

  const rows = await sql`SELECT "idProfesor", "nombre", "apellido", "correo", "estado" FROM "Teacher" WHERE "idProfesor" = ${req.teacher.teacherId} LIMIT 1`;
  const teacher = rows[0] ?? null;

  if (!teacher || teacher.estado !== "activo") {
    throw new AppError(403, "FORBIDDEN", "Acceso denegado");
  }

  res.json({ success: true, data: teacher });
}
