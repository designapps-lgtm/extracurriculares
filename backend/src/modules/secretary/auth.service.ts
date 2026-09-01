import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { sql } from "../../config/db";
import { config } from "../../config";
import { AppError } from "../../middlewares/errorHandler";
import { createRefreshService } from "../../modules/auth/refreshTokens";
import { setAuthCookies, clearAuthCookies, SECRETARY_REFRESH_COOKIE } from "../../utils/authCookies";

const secretaryRefresh = createRefreshService({
  userIdField: "secretaryId",
  tableName: "SecretaryRefreshToken",
  buildAccessToken: ({ id, email }) =>
    jwt.sign({ secretaryId: id, email }, config.jwtSecret, {
      expiresIn: config.accessTokenExpiresIn,
    } as jwt.SignOptions),
});

export async function secretaryRefreshSession(req: Request, res: Response) {
  const refreshToken = req.cookies?.[SECRETARY_REFRESH_COOKIE];

  if (!refreshToken) {
    throw new AppError(401, "REFRESH_REQUIRED", "No hay sesión activa para renovar");
  }

  const { userId, refreshToken: newRefreshToken } = await secretaryRefresh.rotate(refreshToken, "");

  const rows = await sql`SELECT "idSecretary", "nombre", "apellido", "correo", "estado" FROM "Secretary" WHERE "idSecretary" = ${userId} LIMIT 1`;
  const secretary = rows[0] ?? null;

  if (!secretary || secretary.estado !== "activo") {
    throw new AppError(403, "FORBIDDEN", "Acceso denegado");
  }

  const accessToken = jwt.sign(
    { secretaryId: secretary.idSecretary, email: secretary.correo },
    config.jwtSecret,
    { expiresIn: config.accessTokenExpiresIn } as jwt.SignOptions
  );

  setAuthCookies(res, "secretary", accessToken, newRefreshToken);

  res.json({
    success: true,
    data: {
      secretary: {
        idSecretary: secretary.idSecretary,
        nombre: secretary.nombre,
        apellido: secretary.apellido,
        email: secretary.correo,
      },
    },
  });
}

export async function secretaryLogout(req: Request, res: Response) {
  const refreshToken = req.cookies?.[SECRETARY_REFRESH_COOKIE];
  await secretaryRefresh.revoke(refreshToken);
  clearAuthCookies(res, "secretary");
  res.json({ success: true, data: { message: "Sesión cerrada" } });
}

export async function secretaryMe(req: Request, res: Response) {
  if (!req.secretary) {
    throw new AppError(401, "UNAUTHORIZED", "No autenticado");
  }

  const rows = await sql`SELECT "idSecretary", "nombre", "apellido", "correo", "estado" FROM "Secretary" WHERE "idSecretary" = ${req.secretary.secretaryId} LIMIT 1`;
  const secretary = rows[0] ?? null;

  if (!secretary || secretary.estado !== "activo") {
    throw new AppError(403, "FORBIDDEN", "Acceso denegado");
  }

  res.json({ success: true, data: secretary });
}
