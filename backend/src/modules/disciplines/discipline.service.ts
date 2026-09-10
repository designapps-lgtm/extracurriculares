import { AppError } from "../../middlewares/errorHandler";
import { type PaginatedResult, type PaginationParams, paginatedResult } from "../../utils/pagination";
import {
  assignmentPayload,
  disciplineCodes,
  disciplinePayload,
  gradePayload,
  loadCoreData,
  matchesTokens,
  pageSlice,
  schedulePayload,
  studentPayload,
  teacherPayload,
} from "../../db/views";
import type { DisciplineQuery } from "./discipline.types";

export async function getDisciplines(query: DisciplineQuery, pagination: PaginationParams): Promise<PaginatedResult<any>> {
  const data = await loadCoreData();
  const rows = disciplineCodes(data)
    .filter((code) => matchesTokens([code], query.search))
    .map((code) => ({
      ...disciplinePayload(code),
      _count: {
        studentSchedules: data.enrollments.filter((row) => row.disciplineCode === code).length,
        assignments: data.assignments.filter((row) => row.disciplineCode === code).length,
      },
    }));
  return paginatedResult(pageSlice(rows, pagination.page, pagination.limit), rows.length, pagination);
}

export async function getDisciplineByCodigo(codigo: string) {
  const data = await loadCoreData();
  if (!disciplineCodes(data).includes(codigo)) throw new AppError(404, "DISCIPLINE_NOT_FOUND", "No se encontró la disciplina");
  const assignments = data.assignments.filter((row) => row.disciplineCode === codigo).map((row) => assignmentPayload(row, data));
  return {
    ...disciplinePayload(codigo),
    _count: { studentSchedules: data.enrollments.filter((row) => row.disciplineCode === codigo).length },
    assignments,
  };
}

export async function getDisciplineStudents(codigo: string, pagination: PaginationParams): Promise<PaginatedResult<any>> {
  const data = await loadCoreData();
  if (!disciplineCodes(data).includes(codigo)) throw new AppError(404, "DISCIPLINE_NOT_FOUND", "No se encontró la disciplina");
  const codes = new Set(data.enrollments.filter((row) => row.disciplineCode === codigo).map((row) => row.studentCode));
  const rows = data.students.filter((row) => codes.has(row.code)).sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "es"));
  return paginatedResult(pageSlice(rows, pagination.page, pagination.limit).map((row) => studentPayload(row, data)), rows.length, pagination);
}

export async function getDisciplineTeachers(codigo: string) {
  const data = await loadCoreData();
  if (!disciplineCodes(data).includes(codigo)) throw new AppError(404, "DISCIPLINE_NOT_FOUND", "No se encontró la disciplina");
  const byTeacher = new Map<string, any>();
  for (const assignment of data.assignments.filter((row) => row.disciplineCode === codigo)) {
    const teacher = data.userById.get(assignment.teacherId);
    if (!teacher) continue;
    const current = byTeacher.get(teacher.id) ?? {
      ...teacherPayload(teacher),
      teacher: teacherPayload(teacher),
      grade: gradePayload(data.gradeById.get(assignment.gradeId), assignment.gradeId),
      schedules: [],
    };
    for (const scheduleId of assignment.scheduleIds) {
      const schedule = data.scheduleById.get(scheduleId);
      if (schedule && !current.schedules.some((item: any) => item.schedule.idHorario === schedule.id)) {
        current.schedules.push({ schedule: schedulePayload(schedule) });
      }
    }
    byTeacher.set(teacher.id, current);
  }
  return [...byTeacher.values()];
}
