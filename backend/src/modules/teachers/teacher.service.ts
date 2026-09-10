import { AppError } from "../../middlewares/errorHandler";
import { type PaginatedResult, type PaginationParams, paginatedResult } from "../../utils/pagination";
import { assignmentPayload, loadCoreData, matchesTokens, pageSlice, teacherPayload } from "../../db/views";
import type { TeacherQuery } from "./teacher.types";

export async function getTeachers(query: TeacherQuery, pagination: PaginationParams): Promise<PaginatedResult<any>> {
  const data = await loadCoreData();
  const rows = data.users
    .filter((user) => user.role === "teacher")
    .filter((user) => matchesTokens([user.code, user.firstName, user.lastName, user.email], query.search))
    .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "es"));
  const shaped = pageSlice(rows, pagination.page, pagination.limit).map((user) => ({
    ...teacherPayload(user),
    _count: { assignments: data.assignments.filter((row) => row.teacherId === user.id).length },
  }));
  return paginatedResult(shaped, rows.length, pagination);
}

export async function getTeacherById(id: string) {
  const data = await loadCoreData();
  const teacher = data.users.find((user) => user.id === id && user.role === "teacher");
  if (!teacher) throw new AppError(404, "TEACHER_NOT_FOUND", "No se encontró el profesor");
  return { ...teacherPayload(teacher), _count: { assignments: data.assignments.filter((row) => row.teacherId === id).length } };
}

export async function getTeacherAssignments(id: string) {
  const data = await loadCoreData();
  if (!data.users.some((user) => user.id === id && user.role === "teacher")) {
    throw new AppError(404, "TEACHER_NOT_FOUND", "No se encontró el profesor");
  }
  return data.assignments.filter((row) => row.teacherId === id).map((row) => assignmentPayload(row, data));
}
