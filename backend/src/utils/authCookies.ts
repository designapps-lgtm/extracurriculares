import { Response } from "express";
import { config } from "../config";

export interface AuthCookieNames {
  access: string;
  refresh: string;
}

export function setAccessCookie(res: Response, names: AuthCookieNames, token: string, maxAgeMs: number) {
  const isProduction = config.nodeEnv === "production";
  res.cookie(names.access, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    maxAge: maxAgeMs,
    path: "/",
  });
}

export function setRefreshCookie(res: Response, names: AuthCookieNames, token: string, maxAgeMs: number) {
  const isProduction = config.nodeEnv === "production";
  res.cookie(names.refresh, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    maxAge: maxAgeMs,
    path: "/",
  });
}

export function clearAuthCookies(res: Response, names: AuthCookieNames) {
  const isProduction = config.nodeEnv === "production";
  for (const name of [names.access, names.refresh]) {
    res.cookie(name, "", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "strict" : "lax",
      maxAge: 0,
      path: "/",
    });
  }
}