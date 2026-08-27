import { Response } from "express";
import { config } from "../config";
import { parseDurationToMs, daysToMs } from "./tokens";

export const ADMIN_ACCESS_COOKIE = "admin_access";
export const ADMIN_REFRESH_COOKIE = "admin_refresh";
export const TEACHER_ACCESS_COOKIE = "teacher_access";
export const TEACHER_REFRESH_COOKIE = "teacher_refresh";

const isProduction = config.nodeEnv === "production";

// Frontend (Vercel) y backend (Render) son sitios distintos. Para que el
// navegador guarde y envíe la cookie entre dominios hace falta SameSite=None.
// En desarrollo (localhost) SameSite=Lax alcanza y no requiere HTTPS.
const cookieBase = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? ("none" as const) : ("lax" as const),
  path: "/",
};

export function setAuthCookies(
  res: Response,
  role: "admin" | "teacher",
  accessToken: string,
  refreshToken: string
) {
  const prefix = role === "admin" ? "admin" : "teacher";
  res.cookie(`${prefix}_access`, accessToken, {
    ...cookieBase,
    maxAge: parseDurationToMs(config.accessTokenExpiresIn),
  });
  res.cookie(`${prefix}_refresh`, refreshToken, {
    ...cookieBase,
    maxAge: daysToMs(config.refreshTokenExpiresInDays),
  });
}

export function clearAuthCookies(res: Response, role: "admin" | "teacher") {
  const prefix = role === "admin" ? "admin" : "teacher";
  res.clearCookie(`${prefix}_access`, cookieBase);
  res.clearCookie(`${prefix}_refresh`, cookieBase);
}
