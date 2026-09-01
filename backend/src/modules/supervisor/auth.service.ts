import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { sql } from "../../config/db";
import { config } from "../../config";
import { AppError } from "../../middlewares/errorHandler";
import { createRefreshService } from "../../modules/auth/refreshTokens";
import { setAuthCookies, clearAuthCookies, SUPERVISOR_REFRESH_COOKIE } from "../../utils/authCookies";
import { assertTrustedOrigin } from "../../utils/originGuard";

const supervisorRefresh = createRefreshService({
  userIdField: "supervisorId",
  tableName: "SupervisorRefreshToken",
  buildAccessToken: ({ id, email }) =>
    jwt.sign({ supervisorId: id, email }, config.jwtSecret, {
      expiresIn: config.accessTokenExpiresIn,
    } as jwt.SignOptions),
});

export async function supervisorRefreshSession(req: Request, res: Response) {
  assertTrustedOrigin(req);
  const refreshToken = req.cookies?.[SUPERVISOR_REFRESH_COOKIE];

  if (!refreshToken) {
    throw new AppError(401, "REFRESH_REQUIRED", "No hay sesión activa para renovar");
  }

  const { userId, refreshToken: newRefreshToken } = await supervisorRefresh.rotate(refreshToken, "");

  const rows = await sql`SELECT "idSupervisor", "nombre", "apellido", "correo", "estado" FROM "Supervisor" WHERE "idSupervisor" = ${userId} LIMIT 1`;
  const supervisor = rows[0] ?? null;

  if (!supervisor || supervisor.estado !== "activo") {
    throw new AppError(403, "FORBIDDEN", "Acceso denegado");
  }

  const accessToken = jwt.sign(
    { supervisorId: supervisor.idSupervisor, email: supervisor.correo },
    config.jwtSecret,
    { expiresIn: config.accessTokenExpiresIn } as jwt.SignOptions
  );

  setAuthCookies(res, "supervisor", accessToken, newRefreshToken);

  res.json({
    success: true,
    data: {
      supervisor: {
        idSupervisor: supervisor.idSupervisor,
        nombre: supervisor.nombre,
        apellido: supervisor.apellido,
        email: supervisor.correo,
      },
    },
  });
}

export async function supervisorLogout(req: Request, res: Response) {
  assertTrustedOrigin(req);
  const refreshToken = req.cookies?.[SUPERVISOR_REFRESH_COOKIE];
  await supervisorRefresh.revoke(refreshToken);
  clearAuthCookies(res, "supervisor");
  res.json({ success: true, data: { message: "Sesión cerrada" } });
}

export async function supervisorMe(req: Request, res: Response) {
  if (!req.supervisor) {
    throw new AppError(401, "UNAUTHORIZED", "No autenticado");
  }

  const rows = await sql`SELECT "idSupervisor", "nombre", "apellido", "correo", "estado" FROM "Supervisor" WHERE "idSupervisor" = ${req.supervisor.supervisorId} LIMIT 1`;
  const supervisor = rows[0] ?? null;

  if (!supervisor || supervisor.estado !== "activo") {
    throw new AppError(403, "FORBIDDEN", "Acceso denegado");
  }

  res.json({ success: true, data: supervisor });
}
