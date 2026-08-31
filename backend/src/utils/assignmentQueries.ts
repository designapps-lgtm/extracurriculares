import { sql } from "../config/db";

// Helpers compartidos para construir el payload de una asignación con sus
// relaciones (teacher, discipline, grade, schedules[schedule]), replicando el
// `assignmentInclude` que antes definía Prisma.

export const ASSIGNMENT_SELECT = `ea."idAsignacion", ea."idProfesor", ea."codigoDisciplina", ea."idGrado", ea."esPrincipal", ea."estado", ea."createdAt", ea."updatedAt"`;

export interface AssignmentRow {
  idAsignacion: string;
  idProfesor: string;
  codigoDisciplina: string;
  idGrado: number;
  esPrincipal: boolean;
  estado: string;
  createdAt: Date;
  updatedAt: Date;
  profesorNombre: string | null;
  profesorApellido: string | null;
  disciplinaNombre: string | null;
  gradoNombre: string | null;
}

interface ScheduleLinkRow {
  idAsignacion: string;
  diaSemana: string;
  horaInicio: string | null;
  horaFin: string | null;
  aula: string | null;
}

// Convierte filas de la tabla de asignaciones (ya joined con profesor,
// disciplina y grado) a la estructura anidada que el frontend espera.
export async function buildAssignmentList(rows: AssignmentRow[]) {
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.idAsignacion);
  const scheduleLinks = await sql(
    `SELECT asch."idAsignacion", sc."diaSemana", sc."horaInicio", sc."horaFin", sc."aula"
     FROM "AssignmentSchedule" asch
     LEFT JOIN "Schedule" sc ON sc."idHorario" = asch."idHorario"
     WHERE asch."idAsignacion" = ANY($1)
     ORDER BY sc."diaSemana" ASC`,
    [ids]
  ) as unknown as ScheduleLinkRow[];

  const byAssignment: Record<string, ScheduleLinkRow[]> = {};
  for (const sl of scheduleLinks) {
    if (!byAssignment[sl.idAsignacion]) byAssignment[sl.idAsignacion] = [];
    byAssignment[sl.idAsignacion].push(sl);
  }

  return rows.map((r) => ({
    idAsignacion: r.idAsignacion,
    idProfesor: r.idProfesor,
    codigoDisciplina: r.codigoDisciplina,
    idGrado: r.idGrado,
    esPrincipal: r.esPrincipal,
    estado: r.estado,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    teacher: { idProfesor: r.idProfesor, nombre: r.profesorNombre, apellido: r.profesorApellido },
    discipline: { codigoDisciplina: r.codigoDisciplina, nombre: r.disciplinaNombre },
    grade: { idGrado: r.idGrado, nombre: r.gradoNombre },
    schedules: (byAssignment[r.idAsignacion] ?? []).map((sl) => ({
      schedule: { diaSemana: sl.diaSemana, horaInicio: sl.horaInicio, horaFin: sl.horaFin, aula: sl.aula },
    })),
  }));
}
