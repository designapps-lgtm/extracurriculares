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
  SupervisorClassesResponse,
  AttendanceResponse,
  StudentNovedades,
} from "../types";
import type { DailyNovedad, RoleFilters } from "./roles";
import type { SecretaryClassStudentsData } from "./secretary";

const base = "/api/admin/operations";

export async function adminMe() {
  const res = await api.get<ApiResponse<{ nombre: string; apellido: string; email: string }>>("/api/admin/auth/me");
  return { nombre: res.data.nombre, apellido: res.data.apellido, correo: res.data.email };
}

export async function getAdminOperationalSessions(params?: Record<string, string>) {
  return api.get<PaginatedResponse<SupervisorSessionItem>>(`${base}/sessions`, params);
}

export async function getAdminOperationalSession(sessionId: string): Promise<SupervisorSessionDetail> {
  const res = await api.get<ApiResponse<SupervisorSessionDetail>>(`${base}/sessions/${sessionId}`);
  return res.data;
}

export async function getAdminOperationalFilters(): Promise<RoleFilters> {
  const res = await api.get<ApiResponse<RoleFilters>>(`${base}/filters`);
  return res.data;
}

export async function exportAdminAttendance(params?: Record<string, string>): Promise<Blob> {
  return api.download(`${base}/sessions/export`, params);
}

export async function exportAdminSession(sessionId: string): Promise<Blob> {
  return api.download(`${base}/sessions/${sessionId}/export`);
}

export async function getAdminTeacherSchedules(): Promise<SupervisorTeacherSchedule[]> {
  const res = await api.get<ApiResponse<SupervisorTeacherSchedule[]>>(`${base}/schedules`);
  return res.data;
}

export async function getAdminScheduleHistory(asignacionId: string, horarioId: string): Promise<SupervisorScheduleHistory> {
  const res = await api.get<ApiResponse<SupervisorScheduleHistory>>(`${base}/schedules/${asignacionId}/${horarioId}`);
  return res.data;
}

export async function getAdminAssignmentHistory(asignacionId: string): Promise<SupervisorAssignmentHistory> {
  const res = await api.get<ApiResponse<SupervisorAssignmentHistory>>(`${base}/schedules/${asignacionId}`);
  return res.data;
}

export async function getAdminClasses(todayOnly?: boolean): Promise<SupervisorClassesResponse> {
  const res = await api.get<ApiResponse<SupervisorClassesResponse>>(`${base}/classes`, todayOnly ? { today: "1" } : {});
  return res.data;
}

export async function getAdminClassStudents(asignacionId: string, horarioId: string): Promise<SecretaryClassStudentsData> {
  const res = await api.get<ApiResponse<SecretaryClassStudentsData>>(`${base}/classes/${asignacionId}/${horarioId}/students`);
  return res.data;
}

export async function getAdminStays(idAsignacion: string, idHorario: string, fecha: string): Promise<SupervisorStay[]> {
  const res = await api.get<ApiResponse<SupervisorStay[]>>(`${base}/stays`, { idAsignacion, idHorario, fecha });
  return res.data;
}

export async function searchAdminStudents(q: string): Promise<SupervisorStayStudent[]> {
  const res = await api.get<ApiResponse<SupervisorStayStudent[]>>(`${base}/stays/search`, { q });
  return res.data;
}

export async function getAdminNovedadesBatch(codigos: string[], fecha?: string): Promise<StudentNovedades[]> {
  const res = await api.get<ApiResponse<StudentNovedades[]>>(`${base}/novedades/batch`, {
    codigos: codigos.join(","),
    fecha: fecha || "",
  });
  return res.data;
}

export async function getAdminDailyNovedades(params?: { fecha?: string; grado?: string }): Promise<DailyNovedad[]> {
  const res = await api.get<ApiResponse<DailyNovedad[]>>(`${base}/novedades/diarias`, {
    fecha: params?.fecha || "",
    grado: params?.grado || "",
  });
  return res.data;
}

export async function adminStartSession(data: {
  idAsignacion: string;
  idHorario: string;
}): Promise<{ id: string }> {
  const res = await api.post<ApiResponse<{ id: string }>>(`${base}/sessions/start`, data);
  return res.data;
}

export async function getAdminAttendanceList(sessionId: string): Promise<AttendanceResponse> {
  const res = await api.get<ApiResponse<AttendanceResponse>>(`${base}/sessions/${sessionId}/attendance`);
  return res.data;
}

export async function adminSaveAttendance(
  sessionId: string,
  records: { codigoEstudiante: string; estado: string }[],
): Promise<{ sessionId: string; total: number; resultado: string }> {
  const res = await api.post<ApiResponse<{ sessionId: string; total: number; resultado: string }>>(
    `${base}/sessions/${sessionId}/attendance`,
    { records },
  );
  return res.data;
}
