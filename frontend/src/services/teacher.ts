import { api } from "./api";
import { saveTokens, clearTokens } from "./tokenStorage";
import type {
  ApiResponse,
  TeacherClassesResponse,
  Assignment,
  AttendanceResponse,
} from "../types";

export interface TeacherUser {
  idProfesor: string;
  nombre: string;
  apellido: string;
  email: string | null;
}

interface TeacherLoginResponse {
  teacher: TeacherUser;
  accessToken: string;
  refreshToken: string;
}

export async function teacherLogin(email: string): Promise<{ teacher: TeacherUser }> {
  const res = await api.post<ApiResponse<TeacherLoginResponse>>("/api/teacher/auth/login", { email });
  saveTokens("teacher", { accessToken: res.data.accessToken, refreshToken: res.data.refreshToken });
  return { teacher: res.data.teacher };
}

export async function teacherLogout(): Promise<void> {
  try {
    await api.post<ApiResponse<null>>("/api/teacher/auth/logout", {});
  } finally {
    clearTokens("teacher");
  }
}

export async function teacherMe(): Promise<TeacherUser> {
  const res = await api.get<ApiResponse<TeacherUser>>("/api/teacher/auth/me");
  return res.data;
}

export async function getTeacherClasses(): Promise<TeacherClassesResponse> {
  const res = await api.get<ApiResponse<TeacherClassesResponse>>("/api/teacher/classes");
  return res.data;
}

export async function getTeacherAssignments(): Promise<Assignment[]> {
  const res = await api.get<ApiResponse<Assignment[]>>("/api/teacher/assignments");
  return res.data;
}

export interface SessionStartResult {
  id: string;
  idAsignacion: string;
  idHorario: string;
  idProfesor: string;
  fecha: string;
  estado: string;
}

export async function startSession(data: { idAsignacion: string; idHorario: string }): Promise<SessionStartResult> {
  const res = await api.post<ApiResponse<SessionStartResult>>("/api/teacher/sessions/start", data);
  return res.data;
}

export async function getAttendanceList(sessionId: string): Promise<AttendanceResponse> {
  const res = await api.get<ApiResponse<AttendanceResponse>>(`/api/teacher/sessions/${sessionId}/attendance`);
  return res.data;
}

export async function saveAttendance(
  sessionId: string,
  records: { codigoEstudiante: string; estado: string }[]
): Promise<{ id: string }> {
  const res = await api.post<ApiResponse<{ id: string }>>(
    `/api/teacher/sessions/${sessionId}/attendance`,
    { records }
  );
  return res.data;
}