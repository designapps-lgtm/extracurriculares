import { api } from "./api";
import type {
  ApiResponse,
  PaginatedResponse,
  Supervisor,
  SupervisorSessionItem,
  SupervisorSessionDetail,
} from "../types";

export async function supervisorLogin(email: string): Promise<{ supervisor: Supervisor }> {
  const res = await api.post<ApiResponse<{ supervisor: Supervisor }>>("/api/supervisor/auth/login", { email });
  return { supervisor: res.data.supervisor };
}

export async function supervisorLogout(): Promise<void> {
  try {
    await api.post<ApiResponse<null>>("/api/supervisor/auth/logout", {});
  } catch {
    // Las cookies se limpian en el backend; si falla la llamada, igual navegamos.
  }
}

export async function supervisorMe(): Promise<Supervisor> {
  const res = await api.get<ApiResponse<Supervisor>>("/api/supervisor/auth/me");
  return res.data;
}

export async function getSupervisorSessions(params?: Record<string, string>) {
  return api.get<PaginatedResponse<SupervisorSessionItem>>("/api/supervisor/sessions", params);
}

export async function getSupervisorSession(sessionId: string): Promise<SupervisorSessionDetail> {
  const res = await api.get<ApiResponse<SupervisorSessionDetail>>(`/api/supervisor/sessions/${sessionId}`);
  return res.data;
}