import type { AppEnrollment } from "./appsheet.domain";
import type { MappedStudent } from "../../import/excel/excelMapper";

export interface EnrollmentReconcileDiff {
  additions: Array<{ studentCode: string; disciplineCode: string; day: string }>;
  removals: AppEnrollment[];
  /** Estudiante con inscripciones en EC pero ausente del snapshot de Demograficos:
   *  posible baja o fila del Sheet incompleta. No se tocan, solo se reportan. */
  orphanCodes: string[];
  changedStudents: number;
}

function scheduleKey(disciplineCode: string, day: string): string {
  return `${disciplineCode}|${day}`;
}

/**
 * Compara el horario de extracurricular que el colegio mantiene en las
 * columnas CC_* de la tabla Demograficos (Autoridad) contra las filas
 * operativas de EC_Inscripciones (las que consume la app) y devuelve el
 * diff necesario para que EC_Inscripciones sea un espejo de CC_*.
 *
 * Reglas:
 * - CC_* manda: toda fila de EC_Inscripciones de un estudiante en el snapshot
 *   que no exista en CC_* se elimina.
 * - Toda combinación disciplina|día de CC_* sin su fila en EC se agrega.
 * - Filas de EC cuyo estudiante no está en el snapshot de Demograficos se
 *   REPORTAN como huérfanas (posible baja o fila del Sheet incompleta), pero
 *   no se borran: eliminar a ciegas arriesga perder silenciosamente una lista.
 */
export function computeEnrollmentReconcile(
  students: MappedStudent[],
  enrollments: AppEnrollment[],
): EnrollmentReconcileDiff {
  const desiredByStudent = new Map<string, Map<string, { disciplineCode: string; day: string }>>();
  for (const student of students) {
    const desired = new Map<string, { disciplineCode: string; day: string }>();
    for (const schedule of student.schedules) {
      desired.set(
        scheduleKey(schedule.codigoDisciplina, schedule.diaSemana),
        { disciplineCode: schedule.codigoDisciplina, day: schedule.diaSemana },
      );
    }
    desiredByStudent.set(student.codigoEstudiante, desired);
  }

  const currentKeys = new Set<string>();
  const removals: AppEnrollment[] = [];
  const orphanCodes: string[] = [];
  for (const enrollment of enrollments) {
    const desired = desiredByStudent.get(enrollment.studentCode);
    if (!desired) {
      if (!orphanCodes.includes(enrollment.studentCode)) orphanCodes.push(enrollment.studentCode);
      continue;
    }
    const currentKey = `${enrollment.studentCode}|${scheduleKey(enrollment.disciplineCode, enrollment.day)}`;
    currentKeys.add(currentKey);
    if (!desired.has(scheduleKey(enrollment.disciplineCode, enrollment.day))) {
      removals.push(enrollment);
    }
  }

  const additions: EnrollmentReconcileDiff["additions"] = [];
  const changedCodes = new Set<string>();
  for (const [studentCode, desired] of desiredByStudent) {
    for (const row of desired.values()) {
      if (!currentKeys.has(`${studentCode}|${scheduleKey(row.disciplineCode, row.day)}`)) {
        additions.push({ studentCode, disciplineCode: row.disciplineCode, day: row.day });
        changedCodes.add(studentCode);
      }
    }
  }
  for (const removal of removals) changedCodes.add(removal.studentCode);

  return {
    additions,
    removals,
    orphanCodes,
    changedStudents: changedCodes.size,
  };
}