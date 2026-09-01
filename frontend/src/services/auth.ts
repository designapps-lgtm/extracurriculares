import { api } from "./api";
import type { ApiResponse } from "../types";

export type AuthRole = "admin" | "teacher" | "supervisor" | "secretary";

export interface AuthUser {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
}

export interface AuthSession {
  role: AuthRole;
  user: AuthUser;
}

export async function googleLogin(credential: string): Promise<AuthSession> {
  const res = await api.post<ApiResponse<AuthSession>>("/api/auth/google", { credential });
  return res.data;
}

export async function me(): Promise<AuthSession> {
  const res = await api.get<ApiResponse<AuthSession>>("/api/auth/me");
  return res.data;
}

export async function logout(): Promise<void> {
  try {
    await api.post<ApiResponse<null>>("/api/auth/logout", {});
  } catch {
    // Las cookies se limpian en el backend; si falla la llamada, igual navegamos.
  }
}

export function homePathForRole(role: AuthRole): string {
  switch (role) {
    case "admin":
      return "/admin/dashboard";
    case "teacher":
      return "/teacher/dashboard";
    case "secretary":
      return "/secretary/dashboard";
    default:
      return "/supervisor/dashboard";
  }
}
