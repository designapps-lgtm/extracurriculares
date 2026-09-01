import { Response } from "express";
import { config } from "../config";
import { parseDurationToMs, hoursToMs } from "./tokens";

export const ADMIN_ACCESS_COOKIE = "admin_access";
export const ADMIN_REFRESH_COOKIE = "admin_refresh";
export const TEACHER_ACCESS_COOKIE = "teacher_access";
export const TEACHER_REFRESH_COOKIE = "teacher_refresh";
export const SUPERVISOR_ACCESS_COOKIE = "supervisor_access";
export const SUPERVISOR_REFRESH_COOKIE = "supervisor_refresh";

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
  role: "admin" | "teacher" | "supervisor",
  accessToken: string,
  refreshToken: string
) {
  const prefix = role === "supervisor" ? "supervisor" : role;
  res.cookie(`${prefix}_access`, accessToken, {
    ...cookieBase,
    maxAge: parseDurationToMs(config.accessTokenExpiresIn),
  });
  res.cookie(`${prefix}_refresh`, refreshToken, {
    ...cookieBase,
    maxAge: hoursToMs(config.sessionDurationHours),
  });
}

export function clearAuthCookies(res: Response, role: "admin" | "teacher" | "supervisor") {
  const prefix = role === "supervisor" ? "supervisor" : role;
  res.clearCookie(`${prefix}_access`, cookieBase);
  res.clearCookie(`${prefix}_refresh`, cookieBase);
}
