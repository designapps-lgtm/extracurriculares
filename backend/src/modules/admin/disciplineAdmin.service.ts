import { AppError } from "../../middlewares/errorHandler";
import type { PaginationParams } from "../../utils/pagination";
import { disciplineCodes, disciplinePayload, loadCoreData } from "../appsheet/appsheet.views";
import * as disciplineService from "../disciplines/discipline.service";

export function getDisciplines(query: { search?: string }, pagination: PaginationParams) {
  return disciplineService.getDisciplines(query, pagination);
}

export async function getDisciplineGrades(codigoDisciplina: string) {
  const data = await loadCoreData();
  if (!disciplineCodes(data).includes(codigoDisciplina)) throw new AppError(404, "DISCIPLINE_NOT_FOUND", "Disciplina no encontrada");
  const grades = data.grades
    .filter((grade) => data.enrollments.some((enrollment) => enrollment.disciplineCode === codigoDisciplina && data.studentByCode.get(enrollment.studentCode)?.gradeId === grade.id))
    .map((grade) => ({
      idGrado: grade.id,
      nombre: grade.name,
      students: new Set(data.enrollments.filter((row) => row.disciplineCode === codigoDisciplina && data.studentByCode.get(row.studentCode)?.gradeId === grade.id).map((row) => row.studentCode)).size,
    }));
  const scheduleIds = new Set(data.assignments.filter((row) => row.disciplineCode === codigoDisciplina).flatMap((row) => row.scheduleIds));
  const schedules = [...scheduleIds].map((id) => data.scheduleById.get(id)).filter(Boolean).map((row) => ({
    idHorario: row!.id,
    diaSemana: row!.day,
    horaInicio: row!.startTime,
    horaFin: row!.endTime,
    aula: row!.classroom,
  }));
  return { ...disciplinePayload(codigoDisciplina), codigoDisciplina, grades, schedules };
}
