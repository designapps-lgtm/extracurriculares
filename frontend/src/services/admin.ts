import { api } from "./api";

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
  const res = await api.post<{ success: boolean; data: { admin: AdminUser } }>("/api/admin/auth/login", { email, password });
  return res.data;
}

export async function logout(): Promise<void> {
  await api.post("/api/admin/auth/logout");
}

export async function getMe(): Promise<AdminUser> {
  const res = await api.get<{ success: boolean; data: AdminUser }>("/api/admin/auth/me");
  return res.data;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await api.get<{ success: boolean; data: DashboardStats }>("/api/admin/dashboard/stats");
  return res.data;
}

export async function getAdminStudents(params?: Record<string, string>) {
  return api.get<{ success: boolean; data: any[]; meta: any }>("/api/admin/students", params);
}

export async function getAdminStudent(codigo: string) {
  return api.get<{ success: boolean; data: any }>(`/api/admin/students/${codigo}`);
}

export async function updateAdminStudent(codigo: string, data: Record<string, unknown>) {
  return api.patch<{ success: boolean; data: any }>(`/api/admin/students/${codigo}`, data);
}

export async function getAdminTeachers(params?: Record<string, string>) {
  return api.get<{ success: boolean; data: any[]; meta: any }>("/api/admin/teachers", params);
}

export async function createAdminTeacher(data: { nombre: string; apellido: string; correo?: string; fotoUrl?: string }) {
  return api.post<{ success: boolean; data: any }>("/api/admin/teachers", data);
}

export async function updateAdminTeacher(id: string, data: Record<string, unknown>) {
  return api.patch<{ success: boolean; data: any }>(`/api/admin/teachers/${id}`, data);
}

export async function getAdminAssignments(params?: Record<string, string>) {
  return api.get<{ success: boolean; data: any[]; meta: any }>("/api/admin/assignments", params);
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
  idGrado: number;
  idProfesor: string;
  esPrincipal?: boolean;
  schedules?: AssignmentScheduleInput[];
}) {
  return api.post<{ success: boolean; data: any }>("/api/admin/assignments", data);
}

export async function updateAdminAssignment(id: string, data: {
  esPrincipal?: boolean;
  estado?: string;
  schedules?: AssignmentScheduleInput[];
}) {
  return api.patch<{ success: boolean; data: any }>(`/api/admin/assignments/${id}`, data);
}

export async function createAdminSchedule(data: {
  diaSemana: string;
  horaInicio: string;
  horaFin?: string | null;
  aula?: string | null;
}) {
  return api.post<{ success: boolean; data: any; created: boolean }>("/api/admin/schedules", data);
}

export async function deleteAdminAssignment(id: string) {
  return api.delete<{ success: boolean; data: any }>(`/api/admin/assignments/${id}`);
}

export async function getAdminDisciplines(params?: Record<string, string>) {
  return api.get<{ success: boolean; data: any[]; meta: any }>("/api/admin/disciplines", params);
}

export async function getAdminGrades() {
  return api.get<{ success: boolean; data: any[] }>("/api/admin/grades");
}

export async function getAdminSchedules(params?: Record<string, string>) {
  return api.get<{ success: boolean; data: any[]; meta: any }>("/api/admin/schedules", params);
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
  return api.patch<{ success: boolean; data: any }>(`/api/admin/admins/${id}/reset-password`, { password });
}

export async function deleteAdminUser(id: string) {
  return api.delete<{ success: boolean; data: any }>(`/api/admin/admins/${id}`);
}
