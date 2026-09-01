import { api } from "./api";
import type {
  ApiResponse,
  PaginatedResponse,
  SupervisorSessionItem,
  SupervisorSessionDetail,
  SupervisorTeacherSchedule,
  SupervisorScheduleHistory,
  SupervisorAssignmentHistory,
  SupervisorStay,
  SupervisorStayStudent,
  SupervisorTransfer,
  StudentNovedades,
} from "../types";

export interface Secretary {
  idSecretary: string;
  nombre: string;
  apellido: string;
  correo: string | null;
  estado: string;
}

export async function secretaryMe(): Promise<Secretary> {
  const res = await api.get<ApiResponse<Secretary>>("/api/secretary/auth/me");
  return res.data;
}

export async function secretaryLogout(): Promise<void> {
  try {
    await api.post<ApiResponse<null>>("/api/secretary/auth/logout", {});
  } catch {
    // Las cookies se limpian en el backend; si falla la llamada, igual navegamos.
  }
}

export async function getSecretarySessions(params?: Record<string, string>) {
  return api.get<PaginatedResponse<SupervisorSessionItem>>("/api/secretary/sessions", params);
}

export async function getSecretarySession(sessionId: string): Promise<SupervisorSessionDetail> {
  const res = await api.get<ApiResponse<SupervisorSessionDetail>>(`/api/secretary/sessions/${sessionId}`);
  return res.data;
}

export interface SecretaryFilterData {
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

export async function getSecretaryFilters(): Promise<SecretaryFilterData> {
  const res = await api.get<ApiResponse<{ disciplinas: SecretaryFilterData["disciplinas"]; profesores: SecretaryFilterData["profesores"] }>>(
    "/api/secretary/filters",
  );
  return res.data;
}

export async function getSecretaryTeacherSchedules(): Promise<SupervisorTeacherSchedule[]> {
  const res = await api.get<ApiResponse<SupervisorTeacherSchedule[]>>("/api/secretary/schedules");
  return res.data;
}

export async function getSecretaryScheduleHistory(
  asignacionId: string,
  horarioId: string,
): Promise<SupervisorScheduleHistory> {
  const res = await api.get<ApiResponse<SupervisorScheduleHistory>>(
    `/api/secretary/schedules/${asignacionId}/${horarioId}`,
  );
  return res.data;
}

export async function getSecretaryAssignmentHistory(
  asignacionId: string,
): Promise<SupervisorAssignmentHistory> {
  const res = await api.get<ApiResponse<SupervisorAssignmentHistory>>(
    `/api/secretary/schedules/${asignacionId}`,
  );
  return res.data;
}

export async function exportSecretaryAttendance(params?: Record<string, string>): Promise<Blob> {
  return api.download("/api/secretary/sessions/export", params);
}

export async function exportSecretarySession(sessionId: string): Promise<Blob> {
  return api.download(`/api/secretary/sessions/${sessionId}/export`);
}

export async function getSecretaryStays(
  idAsignacion: string,
  idHorario: string,
  fecha: string,
): Promise<SupervisorStay[]> {
  const res = await api.get<ApiResponse<SupervisorStay[]>>("/api/secretary/stays", { idAsignacion, idHorario, fecha });
  return res.data;
}

export async function listSecretaryTransfers(params?: {
  codigoEstudiante?: string;
  fecha?: string;
  fechaFin?: string;
}): Promise<SupervisorTransfer[]> {
  const res = await api.get<ApiResponse<SupervisorTransfer[]>>(`/api/secretary/transfers`, {
    codigoEstudiante: params?.codigoEstudiante || "",
    fecha: params?.fecha || "",
    fechaFin: params?.fechaFin || "",
  });
  return res.data;
}

export async function searchSecretaryStudents(q: string): Promise<SupervisorStayStudent[]> {
  const res = await api.get<ApiResponse<SupervisorStayStudent[]>>("/api/secretary/stays/search", { q });
  return res.data;
}

export async function getSecretaryNovedadesBatch(
  codigos: string[],
  fecha?: string,
): Promise<StudentNovedades[]> {
  const res = await api.get<ApiResponse<StudentNovedades[]>>(`/api/secretary/novedades/batch`, {
    codigos: codigos.join(","),
    fecha: fecha || "",
  });
  return res.data;
}
