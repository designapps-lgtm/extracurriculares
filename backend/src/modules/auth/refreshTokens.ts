import crypto from "crypto";
import jwt from "jsonwebtoken";
import prisma from "../../config/prisma";
import { config } from "../../config";
import { generateRefreshToken, hashRefreshToken, daysToMs } from "../../utils/tokens";
import { AppError } from "../../middlewares/errorHandler";

interface RefreshModel {
  findUnique: (args: { where: { tokenHash: string } }) => Promise<any>;
  update: (args: { where: { id: string }; data: any }) => Promise<any>;
  updateMany: (args: { where: any; data: any }) => Promise<any>;
  create: (args: { data: any }) => Promise<any>;
}

interface RefreshServiceOptions {
  userIdField: "teacherId" | "adminId" | "supervisorId";
  refreshModel: any;
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
  refreshModel,
  buildAccessToken,
}: RefreshServiceOptions) {
  const userIdWhere = (userId: string) =>
    userIdField === "teacherId"
      ? { teacherId: userId }
      : userIdField === "adminId"
        ? { adminId: userId }
        : { supervisorId: userId };

  const issue = async (userId: string, email: string): Promise<IssueResult> => {
    const token = generateRefreshToken();
    const familyId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + daysToMs(config.refreshTokenExpiresInDays));

    await refreshModel.create({
      data: {
        ...userIdWhere(userId),
        tokenHash: hashRefreshToken(token),
        familyId,
        expiresAt,
      },
    });

    const accessToken = buildAccessToken({ id: userId, email });
    return { accessToken, refreshToken: token };
  };

  const rotate = async (presented: string, email: string): Promise<RotateResult> => {
    if (!presented) {
      throw new AppError(401, "REFRESH_REQUIRED", "No hay sesión activa para renovar");
    }

    const tokenHash = hashRefreshToken(presented);
    const record = await refreshModel.findUnique({ where: { tokenHash } });

    if (!record) {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Token de renovación inválido");
    }

    // REUSE DETECTION: este token ya fue rotado/revocado → alguien lo está reutilizando. Matar toda la familia.
    if (record.revokedAt) {
      await refreshModel.updateMany({
        where: { familyId: record.familyId },
        data: { revokedAt: new Date() },
      });
      throw new AppError(401, "REUSED_REFRESH_TOKEN", "Sesión comprometida. Vuelva a iniciar sesión.");
    }

    if (record.expiresAt < new Date()) {
      await refreshModel.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
      throw new AppError(401, "REFRESH_TOKEN_EXPIRED", "La sesión expiró. Vuelva a iniciar sesión.");
    }

    const userId = record[userIdField];

    const newToken = generateRefreshToken();
    const newExpiresAt = new Date(Date.now() + daysToMs(config.refreshTokenExpiresInDays));

    await refreshModel.update({
      where: { id: record.id },
      data: { revokedAt: new Date(), lastUsedAt: new Date() },
    });
    await refreshModel.create({
      data: {
        ...userIdWhere(userId),
        tokenHash: hashRefreshToken(newToken),
        familyId: record.familyId,
        expiresAt: newExpiresAt,
      },
    });

    const accessToken = buildAccessToken({ id: userId, email });
    return { userId, accessToken, refreshToken: newToken };
  };

  const revoke = async (presented: string) => {
    if (!presented) return;
    const record = await refreshModel.findUnique({
      where: { tokenHash: hashRefreshToken(presented) },
    });
    if (record) {
      await refreshModel.updateMany({
        where: { familyId: record.familyId },
        data: { revokedAt: new Date() },
      });
    }
  };

  // Verifica un refresh token SIN rotarlo (para consultar la sesión activa sin
  // invalidar tokens de otras pestañas). Devuelve el userId si es válido.
  const validate = async (presented: string): Promise<{ userId: string }> => {
    if (!presented) {
      throw new AppError(401, "REFRESH_REQUIRED", "No hay sesión activa para renovar");
    }

    const record = await refreshModel.findUnique({
      where: { tokenHash: hashRefreshToken(presented) },
    });

    if (!record || record.revokedAt) {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Token de renovación inválido");
    }

    if (record.expiresAt < new Date()) {
      throw new AppError(401, "REFRESH_TOKEN_EXPIRED", "La sesión expiró. Vuelva a iniciar sesión.");
    }

    return { userId: record[userIdField] };
  };

  return { issue, rotate, revoke, validate };
}

export { jwt };
