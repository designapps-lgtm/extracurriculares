import { AppError } from "../../middlewares/errorHandler";
import type { PaginationParams } from "../../utils/pagination";
import { normalizeDayName } from "../../utils/colombiaTime";
import { replaceStudentEnrollments, updateStudentRow } from "../appsheet/appsheet.domain";
import * as studentService from "../students/student.service";
import { loadCoreData } from "../appsheet/appsheet.views";

const VALID_DAYS = new Set(["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"]);

export function getStudents(query: { search?: string; grado?: string; inscrito?: string }, pagination: PaginationParams) {
  return studentService.getStudents(query, pagination);
}

export function getStudentByCode(codigo: string) {
  return studentService.getStudentByCode(codigo);
}

export async function updateStudent(codigo: string, input: {
  nombre?: string;
  apellido?: string;
  idGrado?: number;
  grupo?: string;
  correo?: string;
  estado?: string;
  fotoUrl?: string;
  schedules?: Array<{ codigoDisciplina: string; diaSemana: string }>;
}) {
  const data = await loadCoreData({ fresh: true });
  const current = data.studentByCode.get(codigo);
  if (!current) throw new AppError(404, "STUDENT_NOT_FOUND", "No se encontró el estudiante");
  let gradeName = current.gradeName;
  if (input.idGrado !== undefined) {
    const grade = data.gradeById.get(Number(input.idGrado));
    if (!grade) throw new AppError(400, "INVALID_GRADE", "Grado no válido");
    gradeName = grade.name;
  }
  if (input.schedules !== undefined) {
    const seenDays = new Set<string>();
    const knownCodes = new Set([...data.assignments.map((row) => row.disciplineCode), ...data.enrollments.map((row) => row.disciplineCode)]);
    for (const row of input.schedules) {
      const day = normalizeDayName(row.diaSemana);
      if (!VALID_DAYS.has(day)) throw new AppError(400, "VALIDATION_ERROR", `Día inválido: ${row.diaSemana}`);
      if (seenDays.has(day)) throw new AppError(400, "VALIDATION_ERROR", `Día duplicado: ${row.diaSemana}`);
      if (!knownCodes.has(row.codigoDisciplina)) throw new AppError(400, "INVALID_DISCIPLINE", `Disciplina no encontrada: ${row.codigoDisciplina}`);
      seenDays.add(day);
    }
  }
  await updateStudentRow(codigo, {
    firstName: input.nombre ?? current.firstName,
    lastName: input.apellido ?? current.lastName,
    gradeId: input.idGrado === undefined ? current.gradeId : Number(input.idGrado),
    gradeName,
    group: input.grupo === undefined ? current.group : input.grupo,
    email: input.correo === undefined ? current.email : input.correo,
    photoUrl: input.fotoUrl === undefined ? current.photoUrl : input.fotoUrl,
  });
  if (input.schedules !== undefined) {
    await replaceStudentEnrollments(codigo, input.schedules.map((row) => ({ disciplineCode: row.codigoDisciplina, day: row.diaSemana })));
  }
  return studentService.getStudentByCode(codigo);
}
