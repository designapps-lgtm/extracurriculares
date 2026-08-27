import { api } from "./api";
import type { PaginatedResponse, TeacherWithCount, Teacher, TeacherAssignment } from "../types";

export async function getTeachers(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<PaginatedResponse<TeacherWithCount>> {
  const query: Record<string, string> = {};
  if (params?.page) query.page = String(params.page);
  if (params?.limit) query.limit = String(params.limit);
  if (params?.search) query.search = params.search;

  return api.get<PaginatedResponse<TeacherWithCount>>("/api/teachers", query);
}

export async function getTeacherById(id: string) {
  return api.get<{ success: boolean; data: Teacher }>(`/api/teachers/${id}`);
}

export async function getTeacherAssignments(id: string) {
  return api.get<{ success: boolean; data: TeacherAssignment[] }>(`/api/teachers/${id}/assignments`);
}
