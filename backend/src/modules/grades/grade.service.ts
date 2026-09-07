import { AppError } from "../../middlewares/errorHandler";
import { type PaginatedResult, type PaginationParams, paginatedResult } from "../../utils/pagination";
import { assignmentPayload, gradePayload, loadCoreData, pageSlice, studentPayload } from "../appsheet/appsheet.views";

function withCounts(data: Awaited<ReturnType<typeof loadCoreData>>, gradeId: number) {
  return {
    ...gradePayload(data.gradeById.get(gradeId), gradeId),
    _count: {
      students: data.students.filter((row) => row.gradeId === gradeId).length,
      assignments: data.assignments.filter((row) => row.gradeId === gradeId).length,
    },
  };
}

export async function getGrades(pagination: PaginationParams): Promise<PaginatedResult<any>> {
  const data = await loadCoreData();
  const rows = data.grades.slice().sort((a, b) => a.id - b.id);
  return paginatedResult(pageSlice(rows, pagination.page, pagination.limit).map((row) => withCounts(data, row.id)), rows.length, pagination);
}

export async function getGradeById(id: number) {
  const data = await loadCoreData();
  if (!data.gradeById.has(id)) throw new AppError(404, "GRADE_NOT_FOUND", "No se encontró el grado");
  return withCounts(data, id);
}

export async function getGradeStudents(id: number, pagination: PaginationParams): Promise<PaginatedResult<any>> {
  const data = await loadCoreData();
  if (!data.gradeById.has(id)) throw new AppError(404, "GRADE_NOT_FOUND", "No se encontró el grado");
  const rows = data.students.filter((row) => row.gradeId === id).sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "es"));
  return paginatedResult(pageSlice(rows, pagination.page, pagination.limit).map((row) => studentPayload(row, data)), rows.length, pagination);
}

export async function getGradeAssignments(id: number) {
  const data = await loadCoreData();
  if (!data.gradeById.has(id)) throw new AppError(404, "GRADE_NOT_FOUND", "No se encontró el grado");
  return data.assignments.filter((row) => row.gradeId === id).map((row) => assignmentPayload(row, data));
}
