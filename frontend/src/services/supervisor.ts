import { api } from "./api";
import type {
  ApiResponse,
  PaginatedResponse,
  Supervisor,
  SupervisorSessionItem,
  SupervisorSessionDetail,
  SupervisorTeacherSchedule,
  SupervisorScheduleHistory,
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

export interface SupervisorFilterData {
  disciplinas: {
    codigoDisciplina: string;
    nombre: string;
    grados: string[];
  }[];
  profesores: {
    idProfesor: string;
    nombre: string;
    apellido: string;
  }[];
}

export async function getSupervisorFilters(): Promise<SupervisorFilterData> {
  const res = await api.get<ApiResponse<{ disciplinas: SupervisorFilterData["disciplinas"]; profesores: SupervisorFilterData["profesores"] }>>(
    "/api/supervisor/filters",
  );
  return res.data;
}

export async function getSupervisorTeacherSchedules(): Promise<SupervisorTeacherSchedule[]> {
  const res = await api.get<ApiResponse<SupervisorTeacherSchedule[]>>("/api/supervisor/schedules");
  return res.data;
}

export async function getSupervisorScheduleHistory(
  asignacionId: string,
  horarioId: string,
): Promise<SupervisorScheduleHistory> {
  const res = await api.get<ApiResponse<SupervisorScheduleHistory>>(
    `/api/supervisor/schedules/${asignacionId}/${horarioId}`,
  );
  return res.data;
}

export async function exportSupervisorAttendance(params?: Record<string, string>): Promise<Blob> {
  return api.download("/api/supervisor/sessions/export", params);
}

export async function exportSupervisorSession(sessionId: string): Promise<Blob> {
  return api.download(`/api/supervisor/sessions/${sessionId}/export`);
}
