import crypto from "crypto";
import jwt from "jsonwebtoken";
import { sql } from "../../config/db";
import { config } from "../../config";
import { generateRefreshToken, hashRefreshToken, hoursToMs } from "../../utils/tokens";
import { AppError } from "../../middlewares/errorHandler";

interface RefreshServiceOptions {
  userIdField: "teacherId" | "adminId" | "supervisorId" | "secretaryId";
  tableName: string;
  buildAccessToken: (identity: { id: string; email: string }) => string;
}

export interface IssueResult {
  accessToken: string;
  refreshToken: string;
}

export interface RotateResult {
  userId: string;
  accessToken: string;
  refreshToken: string;
}

export function createRefreshService({
  userIdField,
  tableName,
  buildAccessToken,
}: RefreshServiceOptions) {
  const issue = async (userId: string, email: string): Promise<IssueResult> => {
    const token = generateRefreshToken();
    const familyId = crypto.randomUUID();
    // Vencimiento ABSOLUTO de la sesión (no se desliza al rotar): se fija al
    // iniciar sesión y se mantiene en toda la familia de refresh tokens.
    const expiresAt = new Date(Date.now() + hoursToMs(config.sessionDurationHours));

    await sql(
      `INSERT INTO "${tableName}" ("id", "${userIdField}", "tokenHash", "familyId", "expiresAt", "createdAt", "lastUsedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, now(), now())`,
      [userId, hashRefreshToken(token), familyId, expiresAt]
    );

    const accessToken = buildAccessToken({ id: userId, email });
    return { accessToken, refreshToken: token };
  };

  const rotate = async (presented: string, email: string): Promise<RotateResult> => {
    if (!presented) {
      throw new AppError(401, "REFRESH_REQUIRED", "No hay sesión activa para renovar");
    }

    const tokenHash = hashRefreshToken(presented);
    const rows = await sql(
      `SELECT * FROM "${tableName}" WHERE "tokenHash" = $1 LIMIT 1`,
      [tokenHash]
    );
    const record = rows[0] ?? null;

    if (!record) {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Token de renovación inválido");
    }

    // REUSE DETECTION
    if (record.revokedAt) {
      await sql(
        `UPDATE "${tableName}" SET "revokedAt" = now() WHERE "familyId" = $1`,
        [record.familyId]
      );
      throw new AppError(401, "REUSED_REFRESH_TOKEN", "Sesión comprometida. Vuelva a iniciar sesión.");
    }

    if (new Date(record.expiresAt) < new Date()) {
      await sql(
        `UPDATE "${tableName}" SET "revokedAt" = now() WHERE "id" = $1`,
        [record.id]
      );
      throw new AppError(401, "REFRESH_TOKEN_EXPIRED", "La sesión expiró. Vuelva a iniciar sesión.");
    }

    const userId = record[userIdField];

    const newToken = generateRefreshToken();
    // Mismo vencimiento ABSOLUTO de la familia: al rotar NO se estira la sesión,
    // se hereda la fecha límite original del login.
    const newExpiresAt = record.expiresAt;

    await sql(
      `UPDATE "${tableName}" SET "revokedAt" = now(), "lastUsedAt" = now() WHERE "id" = $1`,
      [record.id]
    );
    await sql(
      `INSERT INTO "${tableName}" ("id", "${userIdField}", "tokenHash", "familyId", "expiresAt", "createdAt", "lastUsedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, now(), now())`,
      [userId, hashRefreshToken(newToken), record.familyId, newExpiresAt]
    );

    const accessToken = buildAccessToken({ id: userId, email });
    return { userId, accessToken, refreshToken: newToken };
  };

  const revoke = async (presented: string) => {
    if (!presented) return;
    const rows = await sql(
      `SELECT "familyId" FROM "${tableName}" WHERE "tokenHash" = $1 LIMIT 1`,
      [hashRefreshToken(presented)]
    );
    if (rows.length > 0) {
      await sql(
        `UPDATE "${tableName}" SET "revokedAt" = now() WHERE "familyId" = $1`,
        [rows[0].familyId]
      );
    }
  };

  const validate = async (presented: string): Promise<{ userId: string }> => {
    if (!presented) {
      throw new AppError(401, "REFRESH_REQUIRED", "No hay sesión activa para renovar");
    }

    const rows = await sql(
      `SELECT * FROM "${tableName}" WHERE "tokenHash" = $1 LIMIT 1`,
      [hashRefreshToken(presented)]
    );
    const record = rows[0] ?? null;

    if (!record || record.revokedAt) {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Token de renovación inválido");
    }

    if (new Date(record.expiresAt) < new Date()) {
      throw new AppError(401, "REFRESH_TOKEN_EXPIRED", "La sesión expiró. Vuelva a iniciar sesión.");
    }

    return { userId: record[userIdField] };
  };

  return { issue, rotate, revoke, validate };
}

export { jwt };
