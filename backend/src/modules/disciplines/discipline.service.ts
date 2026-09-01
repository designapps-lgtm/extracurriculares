import { sql, first } from "../../config/db";
import { AppError } from "../../middlewares/errorHandler";
import { PaginationParams, PaginatedResult, paginatedResult } from "../../utils/pagination";
import { DisciplineQuery } from "./discipline.types";
import { ASSIGNMENT_SELECT, buildAssignmentList, AssignmentRow } from "../../utils/assignmentQueries";

interface DisciplineCounts {
  codigoDisciplina: string;
  nombre: string;
  descripcion: string | null;
  estado: string;
  createdAt: Date;
  updatedAt: Date;
  _count_schedules: number;
  _count_assignments: number;
}

export async function getDisciplines(query: DisciplineQuery, pagination: PaginationParams): Promise<PaginatedResult<any>> {
  const conditions: string[] = [];
  const params: any[] = [];

  if (query.search) {
    params.push(`%${query.search}%`);
    conditions.push(`(d."codigoDisciplina" ILIKE $1 OR d."nombre" ILIKE $1)`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countRows = await sql(
    `SELECT COUNT(*)::int AS total FROM "Discipline" d ${where}`,
    params
  ) as unknown as Array<{ total: number }>;
  const total = countRows[0]?.total ?? 0;

  const dataParams = [...params, pagination.limit, (pagination.page - 1) * pagination.limit];
  const lim = params.length + 1;
  const off = params.length + 2;

  const data = await sql(
    `SELECT d."codigoDisciplina", d."nombre", d."descripcion", d."estado", d."createdAt", d."updatedAt",
            COUNT(DISTINCT ss."id")::int AS "_count_schedules",
            COUNT(DISTINCT ea."idAsignacion")::int AS "_count_assignments"
     FROM "Discipline" d
     LEFT JOIN "StudentSchedule" ss ON ss."codigoDisciplina" = d."codigoDisciplina"
     LEFT JOIN "ExtracurricularAssignment" ea ON ea."codigoDisciplina" = d."codigoDisciplina"
     ${where}
     GROUP BY d."codigoDisciplina"
     ORDER BY d."nombre" ASC
     LIMIT $${lim} OFFSET $${off}`,
    dataParams
  ) as unknown as DisciplineCounts[];

  const formatted = data.map((d) => ({
    codigoDisciplina: d.codigoDisciplina,
    nombre: d.nombre,
    descripcion: d.descripcion,
    estado: d.estado,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    _count: { studentSchedules: d._count_schedules, assignments: d._count_assignments },
  }));

  return paginatedResult(formatted, total, pagination);
}

export async function getDisciplineByCodigo(codigo: string) {
  const discipline = await first<DisciplineCounts>(
    await sql(
      `SELECT d."codigoDisciplina", d."nombre", d."descripcion", d."estado", d."createdAt", d."updatedAt",
              COUNT(DISTINCT ss."id")::int AS "_count_schedules",
              COUNT(DISTINCT ea."idAsignacion")::int AS "_count_assignments"
       FROM "Discipline" d
       LEFT JOIN "StudentSchedule" ss ON ss."codigoDisciplina" = d."codigoDisciplina"
       LEFT JOIN "ExtracurricularAssignment" ea ON ea."codigoDisciplina" = d."codigoDisciplina"
       WHERE d."codigoDisciplina" = $1
       GROUP BY d."codigoDisciplina"`,
      [codigo]
    ) as unknown as DisciplineCounts[]
  );

  if (!discipline) {
    throw new AppError(404, "DISCIPLINE_NOT_FOUND", "No se encontró la disciplina");
  }

  const assignments = await sql(
    `SELECT ${ASSIGNMENT_SELECT},
            t."nombre" AS "profesorNombre", t."apellido" AS "profesorApellido",
            d2."nombre" AS "disciplinaNombre",
            g."nombre" AS "gradoNombre"
     FROM "ExtracurricularAssignment" ea
     LEFT JOIN "Teacher" t ON t."idProfesor" = ea."idProfesor"
     LEFT JOIN "Discipline" d2 ON d2."codigoDisciplina" = ea."codigoDisciplina"
     LEFT JOIN "Grade" g ON g."idGrado" = ea."idGrado"
     WHERE ea."codigoDisciplina" = $1
     ORDER BY ea."createdAt" ASC`,
    [codigo]
  ) as unknown as AssignmentRow[];

  return {
    codigoDisciplina: discipline.codigoDisciplina,
    nombre: discipline.nombre,
    descripcion: discipline.descripcion,
    estado: discipline.estado,
    createdAt: discipline.createdAt,
    updatedAt: discipline.updatedAt,
    _count: { studentSchedules: discipline._count_schedules },
    assignments: await buildAssignmentList(assignments),
  };
}

export async function getDisciplineStudents(codigo: string, pagination: PaginationParams): Promise<PaginatedResult<any>> {
  const exists = await first<any>(
    await sql`SELECT "codigoDisciplina" FROM "Discipline" WHERE "codigoDisciplina" = ${codigo} LIMIT 1` as unknown as any[]
  );
  if (!exists) {
    throw new AppError(404, "DISCIPLINE_NOT_FOUND", "No se encontró la disciplina");
  }

  const totalRows = await sql(
    `SELECT COUNT(*)::int AS total FROM "Student" s
     WHERE EXISTS (SELECT 1 FROM "StudentSchedule" ss WHERE ss."codigoEstudiante" = s."codigoEstudiante" AND ss."codigoDisciplina" = $1)`,
    [codigo]
  ) as unknown as Array<{ total: number }>;
  const total = totalRows[0]?.total ?? 0;

  const data = await sql(
    `SELECT s."codigoEstudiante", s."nombre", s."apellido", s."idGrado", s."grupo",
            s."fotoUrl", s."estado", s."createdAt", s."updatedAt",
            g."idGrado" AS "idGradoRel", g."nombre" AS "nombreGrado", g."nivel"
     FROM "Student" s
     LEFT JOIN "Grade" g ON g."idGrado" = s."idGrado"
     WHERE EXISTS (SELECT 1 FROM "StudentSchedule" ss WHERE ss."codigoEstudiante" = s."codigoEstudiante" AND ss."codigoDisciplina" = $1)
     ORDER BY s."apellido" ASC, s."nombre" ASC
     LIMIT $2 OFFSET $3`,
    [codigo, pagination.limit, (pagination.page - 1) * pagination.limit]
  ) as unknown as any[];

  const formatted = data.map((s) => ({
    ...s,
    grade: { idGrado: s.idGradoRel, nombre: s.nombreGrado, nivel: s.nivel },
    idGradoRel: undefined,
    nombreGrado: undefined,
    nivel: undefined,
  }));

  return paginatedResult(formatted, total, pagination);
}

export async function getDisciplineTeachers(codigo: string) {
  const exists = await first<any>(
    await sql`SELECT "codigoDisciplina" FROM "Discipline" WHERE "codigoDisciplina" = ${codigo} LIMIT 1` as unknown as any[]
  );
  if (!exists) {
    throw new AppError(404, "DISCIPLINE_NOT_FOUND", "No se encontró la disciplina");
  }

  const rows = await sql(
    `SELECT DISTINCT ON (ea."idProfesor")
            t."idProfesor", t."nombre", t."apellido", t."correo",
            g."idGrado", g."nombre" AS "gradoNombre",
            sc."diaSemana", sc."horaInicio", sc."horaFin"
     FROM "ExtracurricularAssignment" ea
     LEFT JOIN "Teacher" t ON t."idProfesor" = ea."idProfesor"
     LEFT JOIN "Grade" g ON g."idGrado" = ea."idGrado"
     LEFT JOIN "AssignmentSchedule" asch ON asch."idAsignacion" = ea."idAsignacion"
     LEFT JOIN "Schedule" sc ON sc."idHorario" = asch."idHorario"
     WHERE ea."codigoDisciplina" = $1
     ORDER BY ea."idProfesor", sc."diaSemana" ASC`,
    [codigo]
  ) as unknown as any[];

  // Reconstruye: un objeto por profesor, con grade y schedules anidados
  const byTeacher = new Map<string, any>();
  for (const r of rows) {
    if (!byTeacher.has(r.idProfesor)) {
      byTeacher.set(r.idProfesor, {
        idProfesor: r.idProfesor,
        nombre: r.nombre,
        apellido: r.apellido,
        grade: { idGrado: r.idGrado, nombre: r.gradoNombre },
        schedules: [],
      });
    }
    const t = byTeacher.get(r.idProfesor)!;
    const scheduleExists = t.schedules.some(
      (s: any) => s.schedule.diaSemana === r.diaSemana && s.schedule.horaInicio === r.horaInicio
    );
    if (!scheduleExists) {
      t.schedules.push({
        schedule: { diaSemana: r.diaSemana, horaInicio: r.horaInicio, horaFin: r.horaFin },
      });
    }
  }

  return Array.from(byTeacher.values());
}
