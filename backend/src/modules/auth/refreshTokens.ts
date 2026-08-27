import { Request, Response } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import prisma from "../../config/prisma";
import { config } from "../../config";
import { generateRefreshToken, hashRefreshToken, parseDurationToMs, daysToMs } from "../../utils/tokens";
import {
  setAccessCookie,
  setRefreshCookie,
  clearAuthCookies,
  AuthCookieNames,
} from "../../utils/authCookies";
import { AppError } from "../../middlewares/errorHandler";

interface RefreshModel {
  findUnique: (args: { where: { tokenHash: string } }) => Promise<any>;
  update: (args: { where: { id: string }; data: any }) => Promise<any>;
  updateMany: (args: { where: any; data: any }) => Promise<any>;
  create: (args: { data: any }) => Promise<any>;
}

interface RefreshServiceOptions {
  userIdField: "teacherId" | "adminId";
  refreshModel: any;
  cookieNames: AuthCookieNames;
  buildAccessToken: (identity: { id: string; email: string }) => string;
}

export function createRefreshService({
  userIdField,
  refreshModel,
  cookieNames,
  buildAccessToken,
}: RefreshServiceOptions) {
  const userIdWhere = (userId: string) =>
    userIdField === "teacherId" ? { teacherId: userId } : { adminId: userId };

  const issue = async (res: Response, userId: string, email: string) => {
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
    setAccessCookie(res, cookieNames, accessToken, parseDurationToMs(config.accessTokenExpiresIn));
    setRefreshCookie(res, cookieNames, token, daysToMs(config.refreshTokenExpiresInDays));
  };

  const rotate = async (req: Request, res: Response) => {
    const presented = req.cookies?.[cookieNames.refresh];
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
    const email = null;

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
    setAccessCookie(res, cookieNames, accessToken, parseDurationToMs(config.accessTokenExpiresIn));
    setRefreshCookie(res, cookieNames, newToken, daysToMs(config.refreshTokenExpiresInDays));

    return userId;
  };

  const revoke = async (req: Request, res: Response) => {
    const presented = req.cookies?.[cookieNames.refresh];
    if (presented) {
      const record = await refreshModel.findUnique({
        where: { tokenHash: hashRefreshToken(presented) },
      });
      if (record) {
        await refreshModel.updateMany({
          where: { familyId: record.familyId },
          data: { revokedAt: new Date() },
        });
      }
    }
    clearAuthCookies(res, cookieNames);
  };

  return { issue, rotate, revoke };
}

export { jwt };