import { Response } from "express";
import { config } from "../config";
import { parseDurationToMs, hoursToMs } from "./tokens";

export const ADMIN_ACCESS_COOKIE = "admin_access";
export const ADMIN_REFRESH_COOKIE = "admin_refresh";
export const TEACHER_ACCESS_COOKIE = "teacher_access";
export const TEACHER_REFRESH_COOKIE = "teacher_refresh";
export const SUPERVISOR_ACCESS_COOKIE = "supervisor_access";
export const SUPERVISOR_REFRESH_COOKIE = "supervisor_refresh";
export const SECRETARY_ACCESS_COOKIE = "secretary_access";
export const SECRETARY_REFRESH_COOKIE = "secretary_refresh";

const isProduction = config.nodeEnv === "production";

// Frontend (Vercel) y backend (Worker) son sitios distintos, pero el navegador
// SOLO habla con Vercel: vercel.json reescribe /api/* al worker, así que las
// cookies viajan first-party (mismo dominio). Por eso SameSite=Lax alcanza y
// bloquea el envío de cookies en requests cross-site (mitiga CSRF). En
// desarrollo (localhost) SameSite=Lax también alcanza.
const cookieBase = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
  path: "/",
};

export function setAuthCookies(
  res: Response,
  role: "admin" | "teacher" | "supervisor" | "secretary",
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

export function clearAuthCookies(res: Response, role: "admin" | "teacher" | "supervisor" | "secretary") {
  const prefix = role === "supervisor" ? "supervisor" : role;
  res.clearCookie(`${prefix}_access`, cookieBase);
  res.clearCookie(`${prefix}_refresh`, cookieBase);
}
