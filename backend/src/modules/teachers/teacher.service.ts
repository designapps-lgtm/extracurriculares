import { sql, first } from "../../config/db";
import { AppError } from "../../middlewares/errorHandler";
import { PaginationParams, PaginatedResult, paginatedResult } from "../../utils/pagination";
import { TeacherQuery } from "./teacher.types";

interface TeacherRow {
  idProfesor: string;
  codigoProfesor: string | null;
  nombre: string;
  apellido: string;
  correo: string | null;
  fotoUrl: string | null;
  estado: string;
  createdAt: Date;
  updatedAt: Date;
  count: number;
}

interface TeacherWithCount extends Omit<TeacherRow, "count" | "correo"> {
  _count: { assignments: number };
}

export async function getTeachers(query: TeacherQuery, pagination: PaginationParams): Promise<PaginatedResult<TeacherWithCount>> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 0;

  const nextParam = (value: any): string => {
    paramIndex += 1;
    params.push(value);
    return `$${paramIndex}`;
  };

  if (query.search) {
    const p = nextParam(`%${query.search}%`);
    conditions.push(`(t."nombre" ILIKE ${p} OR t."apellido" ILIKE ${p} OR t."codigoProfesor" ILIKE ${p})`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countRows = await sql(
    `SELECT COUNT(*)::int AS total FROM "Teacher" t ${where}`,
    params
  ) as unknown as Array<{ total: number }>;
  const total = countRows[0]?.total ?? 0;

  const offset = (pagination.page - 1) * pagination.limit;
  const limitIdx = params.length + 1;
  const offsetIdx = params.length + 2;
  const dataParams = [...params, pagination.limit, offset];

  const dataRaw = await sql(
    `SELECT
       t."idProfesor", t."codigoProfesor", t."nombre", t."apellido",
       t."correo", t."fotoUrl", t."estado", t."createdAt", t."updatedAt",
       COUNT(ea."idAsignacion")::int AS "count"
     FROM "Teacher" t
     LEFT JOIN "ExtracurricularAssignment" ea ON ea."idProfesor" = t."idProfesor"
     ${where}
     GROUP BY t."idProfesor", t."codigoProfesor", t."nombre", t."apellido",
              t."correo", t."fotoUrl", t."estado", t."createdAt", t."updatedAt"
     ORDER BY t."apellido" ASC, t."nombre" ASC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    dataParams
  ) as unknown as TeacherRow[];

  const data = dataRaw.map((t) => ({
    idProfesor: t.idProfesor,
    codigoProfesor: t.codigoProfesor,
    nombre: t.nombre,
    apellido: t.apellido,
    fotoUrl: t.fotoUrl,
    estado: t.estado,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    _count: { assignments: t.count },
  }));

  return paginatedResult(data, total, pagination);
}

export async function getTeacherById(id: string) {
  const teacher = await first<TeacherRow>(
    (await sql`
      SELECT
        t."idProfesor", t."codigoProfesor", t."nombre", t."apellido",
        t."correo", t."fotoUrl", t."estado", t."createdAt", t."updatedAt",
        COUNT(ea."idAsignacion")::int AS "count"
      FROM "Teacher" t
      LEFT JOIN "ExtracurricularAssignment" ea ON ea."idProfesor" = t."idProfesor"
      WHERE t."idProfesor" = ${id}
      GROUP BY t."idProfesor", t."codigoProfesor", t."nombre", t."apellido",
               t."correo", t."fotoUrl", t."estado", t."createdAt", t."updatedAt"
      LIMIT 1
    `) as unknown as TeacherRow[]
  );

  if (!teacher) {
    throw new AppError(404, "TEACHER_NOT_FOUND", "No se encontró el profesor");
  }

  return {
    idProfesor: teacher.idProfesor,
    codigoProfesor: teacher.codigoProfesor,
    nombre: teacher.nombre,
    apellido: teacher.apellido,
    fotoUrl: teacher.fotoUrl,
    estado: teacher.estado,
    createdAt: teacher.createdAt,
    updatedAt: teacher.updatedAt,
    _count: { assignments: teacher.count },
  };
}

export async function getTeacherAssignments(id: string) {
  const teacher = await first<{ idProfesor: string }>(
    (await sql`
      SELECT "idProfesor"
      FROM "Teacher"
      WHERE "idProfesor" = ${id}
      LIMIT 1
    `) as unknown as Array<{ idProfesor: string }>
  );
  if (!teacher) {
    throw new AppError(404, "TEACHER_NOT_FOUND", "No se encontró el profesor");
  }

  const assignments = (await sql`
    SELECT
      ea."idAsignacion", ea."idProfesor", ea."codigoDisciplina", ea."idGrado",
      ea."esPrincipal", ea."estado", ea."createdAt", ea."updatedAt",
      d."codigoDisciplina" AS "discCodigo", d."nombre" AS "discNombre",
      g."idGrado" AS "gradoIdGrado", g."nombre" AS "gradoNombre",
      sc."idHorario", sc."diaSemana", sc."horaInicio", sc."horaFin", sc."aula"
    FROM "ExtracurricularAssignment" ea
    LEFT JOIN "Discipline" d ON d."codigoDisciplina" = ea."codigoDisciplina"
    LEFT JOIN "Grade" g ON g."idGrado" = ea."idGrado"
    LEFT JOIN "AssignmentSchedule" asch ON asch."idAsignacion" = ea."idAsignacion"
    LEFT JOIN "Schedule" sc ON sc."idHorario" = asch."idHorario"
    WHERE ea."idProfesor" = ${id}
    ORDER BY ea."createdAt" ASC
  `) as unknown as Array<{
    idAsignacion: string; idProfesor: string; codigoDisciplina: string; idGrado: number;
    esPrincipal: boolean; estado: string; createdAt: Date; updatedAt: Date;
    discCodigo: string; discNombre: string; gradoIdGrado: number; gradoNombre: string;
    idHorario: string | null; diaSemana: string | null; horaInicio: string | null;
    horaFin: string | null; aula: string | null;
  }>;

  const grouped = assignments.reduce<Record<string, any>>((acc, row) => {
    if (!acc[row.idAsignacion]) {
      acc[row.idAsignacion] = {
        idAsignacion: row.idAsignacion,
        idProfesor: row.idProfesor,
        codigoDisciplina: row.codigoDisciplina,
        idGrado: row.idGrado,
        esPrincipal: row.esPrincipal,
        estado: row.estado,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        discipline: { codigoDisciplina: row.discCodigo, nombre: row.discNombre },
        grade: { idGrado: row.gradoIdGrado, nombre: row.gradoNombre },
        schedules: [],
      };
    }
    if (row.idHorario) {
      acc[row.idAsignacion].schedules.push({
        schedule: {
          idHorario: row.idHorario,
          diaSemana: row.diaSemana,
          horaInicio: row.horaInicio,
          horaFin: row.horaFin,
          aula: row.aula,
        },
      });
    }
    return acc;
  }, {});

  return Object.values(grouped);
}
