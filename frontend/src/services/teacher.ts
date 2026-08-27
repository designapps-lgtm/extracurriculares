import { api } from "./api";

export interface TeacherUser {
  idProfesor: string;
  nombre: string;
  apellido: string;
  email: string | null;
}

export async function teacherLogin(email: string): Promise<{ teacher: TeacherUser }> {
  const res = await api.post<{ success: boolean; data: { teacher: TeacherUser } }>("/api/teacher/auth/login", { email });
  return res.data;
}

export async function teacherLogout(): Promise<void> {
  await api.post("/api/teacher/auth/logout");
}

export async function teacherMe(): Promise<TeacherUser> {
  const res = await api.get<{ success: boolean; data: TeacherUser }>("/api/teacher/auth/me");
  return res.data;
}

export async function getTeacherClasses() {
  const res = await api.get<{ success: boolean; data: any }>("/api/teacher/classes");
  return res.data;
}

export async function getTeacherAssignments() {
  const res = await api.get<{ success: boolean; data: any[] }>("/api/teacher/assignments");
  return res.data;
}

export async function startSession(data: { idAsignacion: string; idHorario: string }) {
  const res = await api.post<{ success: boolean; data: any }>("/api/teacher/sessions/start", data);
  return res.data;
}

export async function getAttendanceList(sessionId: string) {
  const res = await api.get<{ success: boolean; data: any }>(`/api/teacher/sessions/${sessionId}/attendance`);
  return res.data;
}

export async function saveAttendance(sessionId: string, records: { codigoEstudiante: string; estado: string }[]) {
  const res = await api.post<{ success: boolean; data: any }>(`/api/teacher/sessions/${sessionId}/attendance`, { records });
  return res.data;
}
