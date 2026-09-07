import { AppError } from "../../middlewares/errorHandler";
import { type PaginatedResult, type PaginationParams, paginatedResult } from "../../utils/pagination";
import { loadCoreData, matchesTokens, pageSlice, studentPayload } from "../appsheet/appsheet.views";
import type { StudentQuery } from "./student.types";

export async function getStudents(query: StudentQuery, pagination: PaginationParams): Promise<PaginatedResult<any>> {
  const data = await loadCoreData();
  const rows = data.students
    .filter((student) => matchesTokens([student.code, student.firstName, student.lastName], query.search))
    .filter((student) => !query.grado || student.gradeName === query.grado || data.gradeById.get(student.gradeId)?.name === query.grado)
    .filter((student) => {
      const enrollments = data.enrollments.filter((row) => row.studentCode === student.code);
      if (query.inscrito === "true" && enrollments.length === 0) return false;
      if (query.inscrito === "false" && enrollments.length > 0) return false;
      if (query.disciplina && !enrollments.some((row) => row.disciplineCode === query.disciplina)) return false;
      return true;
    })
    .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "es"));
  return paginatedResult(pageSlice(rows, pagination.page, pagination.limit).map((row) => studentPayload(row, data)), rows.length, pagination);
}

export async function getStudentByCode(codigo: string) {
  const data = await loadCoreData();
  const student = data.studentByCode.get(codigo);
  if (!student) throw new AppError(404, "STUDENT_NOT_FOUND", "No se encontró el estudiante");
  return studentPayload(student, data);
}

export async function getStudentProfile(codigo: string) {
  const data = await loadCoreData();
  const student = data.studentByCode.get(codigo);
  if (!student) throw new AppError(404, "STUDENT_NOT_FOUND", "No se encontró el estudiante");
  const extracurricular = data.enrollments
    .filter((row) => row.studentCode === codigo)
    .map((enrollment) => {
      const assignment = data.assignments.find((row) => row.disciplineCode === enrollment.disciplineCode && row.gradeId === student.gradeId && row.scheduleIds.some((id) => data.scheduleById.get(id)?.day === enrollment.day));
      const schedule = assignment?.scheduleIds.map((id) => data.scheduleById.get(id)).find((row) => row?.day === enrollment.day);
      const teacher = assignment ? data.userById.get(assignment.teacherId) : undefined;
      return {
        dia: enrollment.day,
        disciplina: { codigo: enrollment.disciplineCode, nombre: enrollment.disciplineCode },
        oferta: assignment ? {
          profesor: [teacher?.firstName, teacher?.lastName].filter(Boolean).join(" "),
          horaInicio: schedule?.startTime ?? null,
          horaFin: schedule?.endTime ?? null,
        } : null,
      };
    });
  return {
    student: {
      codigoEstudiante: student.code,
      nombre: student.firstName,
      apellido: student.lastName,
      grupo: student.group,
      correo: student.email,
      fotoUrl: student.photoUrl,
      grade: data.gradeById.has(student.gradeId)
        ? { idGrado: student.gradeId, nombre: data.gradeById.get(student.gradeId)!.name, nivel: data.gradeById.get(student.gradeId)!.level }
        : { idGrado: student.gradeId, nombre: student.gradeName, nivel: null },
    },
    extracurricular: extracurricular.length ? extracurricular : null,
  };
}
