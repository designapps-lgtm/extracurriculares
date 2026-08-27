import { api } from "./api";
import type { PaginatedResponse, Discipline, DisciplineDetail, DisciplineTeacher, Student } from "../types";

export async function getDisciplines(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<PaginatedResponse<Discipline>> {
  const query: Record<string, string> = {};
  if (params?.page) query.page = String(params.page);
  if (params?.limit) query.limit = String(params.limit);
  if (params?.search) query.search = params.search;

  return api.get<PaginatedResponse<Discipline>>("/api/disciplines", query);
}

export async function getDisciplineByCodigo(codigo: string) {
  return api.get<{ success: boolean; data: DisciplineDetail }>(`/api/disciplines/${codigo}`);
}

export async function getDisciplineStudents(codigo: string, params?: { page?: number; limit?: number }) {
  const query: Record<string, string> = {};
  if (params?.page) query.page = String(params.page);
  if (params?.limit) query.limit = String(params.limit);

  return api.get<PaginatedResponse<Student>>(`/api/disciplines/${codigo}/students`, query);
}

export async function getDisciplineTeachers(codigo: string) {
  return api.get<{ success: boolean; data: DisciplineTeacher[] }>(`/api/disciplines/${codigo}/teachers`);
}
