import { api } from "./api";
import type {
  ApiResponse,
  PaginatedResponse,
  Supervisor,
  SupervisorSessionItem,
  SupervisorSessionDetail,
  SupervisorTeacherSchedule,
  SupervisorScheduleHistory,
  SupervisorAssignmentHistory,
  SupervisorStay,
  SupervisorStayStudent,
  SupervisorClassesResponse,
  AttendanceResponse,
  StudentNovedades,
  SupervisorTransfer,
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

export async function getSupervisorAssignmentHistory(
  asignacionId: string,
): Promise<SupervisorAssignmentHistory> {
  const res = await api.get<ApiResponse<SupervisorAssignmentHistory>>(
    `/api/supervisor/schedules/${asignacionId}`,
  );
  return res.data;
}

export async function exportSupervisorAttendance(params?: Record<string, string>): Promise<Blob> {
  return api.download("/api/supervisor/sessions/export", params);
}

export async function exportSupervisorSession(sessionId: string): Promise<Blob> {
  return api.download(`/api/supervisor/sessions/${sessionId}/export`);
}

export async function searchSupervisorStudents(q: string): Promise<SupervisorStayStudent[]> {
  const res = await api.get<ApiResponse<SupervisorStayStudent[]>>("/api/supervisor/stays/search", { q });
  return res.data;
}

export async function getSupervisorStays(
  idAsignacion: string,
  idHorario: string,
  fecha: string,
): Promise<SupervisorStay[]> {
  const res = await api.get<ApiResponse<SupervisorStay[]>>("/api/supervisor/stays", { idAsignacion, idHorario, fecha });
  return res.data;
}

export async function createSupervisorStay(payload: {
  idAsignacion: string;
  idHorario: string;
  codigoEstudiante: string;
  fecha: string;
}): Promise<{ id: string | null }> {
  const res = await api.post<ApiResponse<{ id: string | null }>>("/api/supervisor/stays", payload);
  return res.data;
}

export async function deleteSupervisorStay(stayId: string): Promise<void> {
  await api.delete<ApiResponse<{ id: string }>>(`/api/supervisor/stays/${stayId}`);
}

export async function getSupervisorClasses(todayOnly?: boolean): Promise<SupervisorClassesResponse> {
  const res = await api.get<ApiResponse<SupervisorClassesResponse>>("/api/supervisor/classes", {
    ...(todayOnly ? { today: "1" } : {}),
  });
  return res.data;
}

export async function supervisorStartSession(data: {
  idAsignacion: string;
  idHorario: string;
}): Promise<{ id: string }> {
  const res = await api.post<ApiResponse<{ id: string }>>("/api/supervisor/sessions/start", data);
  return res.data;
}

export async function getSupervisorAttendanceList(sessionId: string): Promise<AttendanceResponse> {
  const res = await api.get<ApiResponse<AttendanceResponse>>(
    `/api/supervisor/sessions/${sessionId}/attendance`,
  );
  return res.data;
}

export async function supervisorSaveAttendance(
  sessionId: string,
  records: { codigoEstudiante: string; estado: string }[],
): Promise<{ id: string }> {
  const res = await api.post<ApiResponse<{ id: string }>>(
    `/api/supervisor/sessions/${sessionId}/attendance`,
    { records },
  );
  return res.data;
}

export async function getSupervisorNovedadesBatch(
  codigos: string[],
  fecha?: string,
): Promise<StudentNovedades[]> {
  const res = await api.get<ApiResponse<StudentNovedades[]>>(`/api/supervisor/novedades/batch`, {
    codigos: codigos.join(","),
    fecha: fecha || "",
  });
  return res.data;
}

export async function listSupervisorTransfers(params?: {
  codigoEstudiante?: string;
  fecha?: string;
}): Promise<SupervisorTransfer[]> {
  const res = await api.get<ApiResponse<SupervisorTransfer[]>>(`/api/supervisor/transfers`, {
    codigoEstudiante: params?.codigoEstudiante || "",
    fecha: params?.fecha || "",
  });
  return res.data;
}

export async function createSupervisorTransfer(data: {
  codigoEstudiante: string;
  idAsignacionOrigen: string;
  idAsignacionDestino: string;
  idHorarioDestino: string;
  fecha: string;
  motivo: string;
}): Promise<{ id: string }> {
  const res = await api.post<ApiResponse<{ id: string }>>(`/api/supervisor/transfers`, data);
  return res.data;
}

export async function deleteSupervisorTransfer(id: string): Promise<void> {
  await api.delete<ApiResponse<{ id: string }>>(`/api/supervisor/transfers/${id}`);
}
