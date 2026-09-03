import { api } from "./api";
import type {
  ApiResponse,
  PaginatedResponse,
  Student,
  Teacher,
  TeacherWithCount,
  Grade,
  Discipline,
  Schedule,
  Assignment,
  Supervisor,
  Secretary,
} from "../types";

export interface AdminUser {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
}

export interface DashboardStats {
  totalStudents: number;
  enrolledStudents: number;
  unenrolledStudents: number;
  totalTeachers: number;
  totalDisciplines: number;
  totalGrades: number;
  totalAssignments: number;
  totalSchedules: number;
  assignmentsByDay: Record<string, number>;
}

export async function login(email: string, password: string): Promise<{ admin: AdminUser }> {
  const res = await api.post<ApiResponse<{ admin: AdminUser }>>("/api/admin/auth/login", { email, password });
  return { admin: res.data.admin };
}

export async function logout(): Promise<void> {
  try {
    await api.post<ApiResponse<null>>("/api/auth/logout", {});
  } catch {
    // Las cookies se limpian en el backend; si falla la llamada, igual navegamos.
  }
}

export async function getMe(): Promise<AdminUser> {
  const res = await api.get<ApiResponse<AdminUser>>("/api/admin/auth/me");
  return res.data;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await api.get<ApiResponse<DashboardStats>>("/api/admin/dashboard/stats");
  return res.data;
}

export async function getAdminStudents(params?: Record<string, string>) {
  return api.get<PaginatedResponse<Student>>("/api/admin/students", params);
}

export async function getAdminStudent(codigo: string) {
  return api.get<ApiResponse<Student>>(`/api/admin/students/${codigo}`);
}

export async function updateAdminStudent(codigo: string, data: Record<string, unknown>) {
  return api.patch<ApiResponse<Student>>(`/api/admin/students/${codigo}`, data);
}

export async function getAdminTeachers(params?: Record<string, string>) {
  return api.get<PaginatedResponse<TeacherWithCount>>("/api/admin/teachers", params);
}

export async function createAdminTeacher(data: { nombre: string; apellido: string; correo?: string; fotoUrl?: string }) {
  return api.post<ApiResponse<Teacher>>("/api/admin/teachers", data);
}

export async function updateAdminTeacher(id: string, data: Record<string, unknown>) {
  return api.patch<ApiResponse<Teacher>>(`/api/admin/teachers/${id}`, data);
}

export async function deleteAdminTeacher(id: string) {
  return api.delete<ApiResponse<{ id: string }>>(`/api/admin/teachers/${id}`);
}

export async function getAdminAssignments(params?: Record<string, string>) {
  return api.get<PaginatedResponse<Assignment>>("/api/admin/assignments", params);
}

export interface AssignmentScheduleInput {
  idHorario?: string;
  diaSemana?: string;
  horaInicio?: string;
  horaFin?: string | null;
  aula?: string | null;
}

export async function createAdminAssignment(data: {
  codigoDisciplina: string;
  idGrado?: number;
  idGrados?: number[];
  idProfesor: string;
  esPrincipal?: boolean;
  schedules?: AssignmentScheduleInput[];
}) {
  return api.post<ApiResponse<Assignment>>("/api/admin/assignments", data);
}

export async function updateAdminAssignment(id: string, data: {
  esPrincipal?: boolean;
  estado?: string;
  schedules?: AssignmentScheduleInput[];
}) {
  return api.patch<ApiResponse<Assignment>>(`/api/admin/assignments/${id}`, data);
}

export async function createAdminSchedule(data: {
  diaSemana: string;
  horaInicio: string;
  horaFin?: string | null;
  aula?: string | null;
}) {
  return api.post<ApiResponse<Schedule> & { created: boolean }>("/api/admin/schedules", data);
}

export async function deleteAdminAssignment(id: string) {
  return api.delete<ApiResponse<Assignment>>(`/api/admin/assignments/${id}`);
}

export async function getAdminDisciplines(params?: Record<string, string>) {
  return api.get<PaginatedResponse<Discipline>>("/api/admin/disciplines", params);
}

export interface DisciplineGrade {
  idGrado: number;
  nombre: string;
  students: number;
}

export interface DisciplineScheduleInfo {
  idHorario: string;
  diaSemana: string;
  horaInicio: string | null;
  horaFin: string | null;
  aula: string | null;
}

export async function getAdminDisciplineGrades(codigoDisciplina: string) {
  return api.get<{ success: boolean; codigoDisciplina: string; grades: DisciplineGrade[]; schedules: DisciplineScheduleInfo[] }>(
    `/api/admin/disciplines/${encodeURIComponent(codigoDisciplina)}/grades`,
  );
}

export async function getAdminGrades() {
  return api.get<{ success: boolean; data: Grade[] }>("/api/admin/grades");
}

export async function getAdminSchedules(params?: Record<string, string>) {
  return api.get<PaginatedResponse<Schedule>>("/api/admin/schedules", params);
}

// Admin user management
export interface AdminUserEntry {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  estado: string;
  createdAt: string;
}

export async function getAdminUsers() {
  return api.get<{ success: boolean; data: AdminUserEntry[] }>("/api/admin/admins");
}

export async function createAdminUser(data: { email: string; nombre?: string; apellido?: string; password?: string }) {
  return api.post<{ success: boolean; data: AdminUserEntry }>("/api/admin/admins", data);
}

export async function updateAdminUser(id: string, data: Record<string, unknown>) {
  return api.patch<{ success: boolean; data: AdminUserEntry }>(`/api/admin/admins/${id}`, data);
}

export async function resetAdminPassword(id: string, password: string) {
  return api.patch<ApiResponse<{ id: string }>>(`/api/admin/admins/${id}/reset-password`, { password });
}

export async function deleteAdminUser(id: string) {
  return api.delete<ApiResponse<{ id: string }>>(`/api/admin/admins/${id}`);
}

// Supervisor management
export async function getAdminSupervisors(params?: Record<string, string>) {
  return api.get<PaginatedResponse<Supervisor>>("/api/admin/supervisors", params);
}

export async function createAdminSupervisor(data: { codigoSupervisor?: string; nombre: string; apellido: string; correo?: string; fotoUrl?: string }) {
  return api.post<ApiResponse<Supervisor>>("/api/admin/supervisors", data);
}

export async function updateAdminSupervisor(id: string, data: Record<string, unknown>) {
  return api.patch<ApiResponse<Supervisor>>(`/api/admin/supervisors/${id}`, data);
}

export async function deleteAdminSupervisor(id: string) {
  return api.delete<ApiResponse<{ id: string }>>(`/api/admin/supervisors/${id}`);
}

// Secretary management
export async function getAdminSecretaries(params?: Record<string, string>) {
  return api.get<PaginatedResponse<Secretary>>("/api/admin/secretaries", params);
}

export async function createAdminSecretary(data: { codigoSecretary?: string; nombre: string; apellido: string; correo?: string; fotoUrl?: string }) {
  return api.post<ApiResponse<Secretary>>("/api/admin/secretaries", data);
}

export async function updateAdminSecretary(id: string, data: Record<string, unknown>) {
  return api.patch<ApiResponse<Secretary>>(`/api/admin/secretaries/${id}`, data);
}

export async function deleteAdminSecretary(id: string) {
  return api.delete<ApiResponse<{ id: string }>>(`/api/admin/secretaries/${id}`);
}


export const adminNovedadesApi = {
  getFilters: async () => {
    const response = await getAdminGrades();
    return { disciplinas: [], profesores: [], grados: response.data.map((grade) => grade.nombre) };
  },
  getNovedadesDiarias: async (params?: { fecha?: string; grado?: string }) => {
    const response = await api.get<ApiResponse<import("../services/roles").DailyNovedad[]>>(
      "/api/admin/novedades/diarias",
      params,
    );
    return response.data;
  },
};