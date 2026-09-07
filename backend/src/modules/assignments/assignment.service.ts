import { AppError } from "../../middlewares/errorHandler";
import { type PaginatedResult, type PaginationParams, paginatedResult } from "../../utils/pagination";
import { assignmentPayload, loadCoreData, pageSlice } from "../appsheet/appsheet.views";
import type { AssignmentQuery } from "./assignment.types";

export async function getAssignments(query: AssignmentQuery, pagination: PaginationParams): Promise<PaginatedResult<any>> {
  const data = await loadCoreData();
  const rows = data.assignments
    .filter((row) => !query.grado || data.gradeById.get(row.gradeId)?.name === query.grado)
    .filter((row) => !query.disciplina || row.disciplineCode === query.disciplina)
    .filter((row) => !query.profesor || row.teacherId === query.profesor)
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
  return paginatedResult(pageSlice(rows, pagination.page, pagination.limit).map((row) => assignmentPayload(row, data)), rows.length, pagination);
}

export async function getAssignmentById(id: string) {
  const data = await loadCoreData();
  const assignment = data.assignments.find((row) => row.id === id);
  if (!assignment) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "No se encontró la asignación");
  return assignmentPayload(assignment, data);
}
