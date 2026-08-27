import { api } from "./api";
import type { PaginatedResponse, Student, StudentProfile } from "../types";

export async function getStudents(params: {
  page?: number;
  limit?: number;
  search?: string;
  grado?: string;
  disciplina?: string;
  inscrito?: string;
}): Promise<PaginatedResponse<Student>> {
  const query: Record<string, string> = {};
  if (params.page) query.page = String(params.page);
  if (params.limit) query.limit = String(params.limit);
  if (params.search) query.search = params.search;
  if (params.grado) query.grado = params.grado;
  if (params.disciplina) query.disciplina = params.disciplina;
  if (params.inscrito) query.inscrito = params.inscrito;

  return api.get<PaginatedResponse<Student>>("/api/students", query);
}

export async function getStudentByCode(codigo: string) {
  return api.get<{ success: boolean; data: Student }>(`/api/students/${codigo}`);
}

export async function getStudentProfile(codigo: string) {
  return api.get<{ success: boolean; data: StudentProfile }>(`/api/students/${codigo}/profile`);
}
