import { api } from "./api";
import type { PaginatedResponse, GradeWithCount } from "../types";

export async function getGrades(params?: { page?: number; limit?: number }) {
  const query: Record<string, string> = {};
  if (params?.page) query.page = String(params.page);
  if (params?.limit) query.limit = String(params.limit);

  return api.get<PaginatedResponse<GradeWithCount>>("/api/grades", query);
}
