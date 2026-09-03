import crypto from "crypto";
import { sql, first } from "../../config/db";
import { AppError } from "../../middlewares/errorHandler";
import { PaginationParams, paginatedResult } from "../../utils/pagination";
import { ASSIGNMENT_SELECT, buildAssignmentList, AssignmentRow } from "../../utils/assignmentQueries";
import { DIAS_VALIDOS, normalizeDay, normalizeTime } from "../../utils/validators";

export async function getAssignments(query: {
  disciplina?: string;
  grado?: string;
  profesor?: string;
}, pagination: PaginationParams) {
  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 0;
  const next = (v: any): string => { idx++; params.push(v); return `$${idx}`; };

  if (query.disciplina) conditions.push(`ea."codigoDisciplina" = ${next(query.disciplina)}`);
  if (query.profesor) conditions.push(`ea."idProfesor" = ${next(query.profesor)}`);
  if (query.grado) {
    const gradeRow = await first<{ idGrado: number }>(
      await sql`SELECT "idGrado" FROM "Grade" WHERE "nombre" = ${query.grado} LIMIT 1` as any[]
    );
    if (gradeRow) conditions.push(`ea."idGrado" = ${next(gradeRow.idGrado)}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const countRows = await sql(`SELECT COUNT(*)::int AS total FROM "ExtracurricularAssignment" ea ${where}`, params) as any[];
  const total = countRows[0]?.total ?? 0;

  const offset = (pagination.page - 1) * pagination.limit;
  const lim = params.length + 1;
  const off = params.length + 2;
  const dataParams = [...params, pagination.limit, offset];

  const rows = await sql(
    `SELECT ${ASSIGNMENT_SELECT},
            t."nombre" AS "profesorNombre", t."apellido" AS "profesorApellido",
            d."nombre" AS "disciplinaNombre",
            g."nombre" AS "gradoNombre"
     FROM "ExtracurricularAssignment" ea
     LEFT JOIN "Teacher" t ON t."idProfesor" = ea."idProfesor"
     LEFT JOIN "Discipline" d ON d."codigoDisciplina" = ea."codigoDisciplina"
     LEFT JOIN "Grade" g ON g."idGrado" = ea."idGrado"
     ${where}
     ORDER BY ea."createdAt" ASC
     LIMIT $${lim} OFFSET $${off}`,
    dataParams
  ) as unknown as AssignmentRow[];

  const data = await buildAssignmentList(rows);
  return paginatedResult(data, total, pagination);
}

export async function getAssignmentById(id: string) {
  const row = await first<AssignmentRow>(
    await sql(
      `SELECT ${ASSIGNMENT_SELECT},
              t."nombre" AS "profesorNombre", t."apellido" AS "profesorApellido",
              d."nombre" AS "disciplinaNombre",
              g."nombre" AS "gradoNombre"
       FROM "ExtracurricularAssignment" ea
       LEFT JOIN "Teacher" t ON t."idProfesor" = ea."idProfesor"
       LEFT JOIN "Discipline" d ON d."codigoDisciplina" = ea."codigoDisciplina"
       LEFT JOIN "Grade" g ON g."idGrado" = ea."idGrado"
       WHERE ea."idAsignacion" = $1 LIMIT 1`,
      [id]
    ) as unknown as AssignmentRow[]
  );
  if (!row) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "No se encontró la asignación");

  const [result] = await buildAssignmentList([row]);
  return result;
}

async function resolveScheduleLinks(schedules: any): Promise<{ idHorario: string }[]> {
  if (!schedules || !Array.isArray(schedules) || schedules.length === 0) return [];

  const links: { idHorario: string }[] = [];
  for (const s of schedules) {
    if (s.idHorario) {
      const schedule = await first<any>(
        await sql`SELECT "idHorario" FROM "Schedule" WHERE "idHorario" = ${s.idHorario} LIMIT 1` as any[]
      );
      if (!schedule) throw new AppError(400, "INVALID_SCHEDULE", `Horario no válido: ${s.idHorario}`);
      links.push({ idHorario: s.idHorario });
      continue;
    }

    const { diaSemana, horaInicio, horaFin, aula } = s;
    const day = normalizeDay(diaSemana);
    if (!day) {
      throw new AppError(400, "INVALID_DAY", `Día inválido. Use uno de: ${DIAS_VALIDOS.join(", ")}`);
    }

    const hi = normalizeTime(horaInicio);
    const hf = normalizeTime(horaFin);

    const existing = await first<any>(
      await sql`SELECT "idHorario" FROM "Schedule" WHERE "diaSemana" = ${day} AND "horaInicio" IS NOT DISTINCT FROM ${hi} AND "horaFin" IS NOT DISTINCT FROM ${hf} LIMIT 1` as any[]
    );
    if (existing) {
      links.push({ idHorario: existing.idHorario });
    } else {
      const rows = await sql`INSERT INTO "Schedule" ("idHorario", "diaSemana", "horaInicio", "horaFin", "aula", "updatedAt") VALUES (gen_random_uuid(), ${day}, ${hi}, ${hf}, ${aula || null}, now()) RETURNING "idHorario"` as any[];
      links.push({ idHorario: rows[0].idHorario });
    }
  }

  return links;
}

export async function createAssignment(data: {
  codigoDisciplina: string;
  idGrado?: number;
  idGrados?: number[];
  idProfesor: string;
  esPrincipal?: boolean;
  schedules?: any[];
}) {
  const { codigoDisciplina, idGrado, idGrados, idProfesor, esPrincipal, schedules } = data;
  let gradeIds = Array.from(
    new Set(
      (idGrados && idGrados.length > 0 ? idGrados : idGrado ? [idGrado] : [])
        .map((g) => Number(g))
        .filter((g) => Number.isInteger(g) && g > 0),
    ),
  ).sort((a, b) => a - b);

  if (!codigoDisciplina || !idProfesor) {
    throw new AppError(400, "VALIDATION_ERROR", "codigoDisciplina e idProfesor son requeridos");
  }

  const discipline = await first<any>(
    await sql`SELECT "codigoDisciplina" FROM "Discipline" WHERE "codigoDisciplina" = ${codigoDisciplina} LIMIT 1` as any[]
  );
  if (!discipline) throw new AppError(400, "INVALID_DISCIPLINE", "Disciplina no válida");

  // Si no se indican grados, se derivan automáticamente de los grados que ya tienen
  // estudiantes inscritos en la disciplina. Así la asignación cubre todos los grados de la oferta.
  if (gradeIds.length === 0) {
    const derivedRows = (await sql`
      SELECT DISTINCT st."idGrado"
      FROM "StudentSchedule" ss
      JOIN "Student" st ON st."codigoEstudiante" = ss."codigoEstudiante"
      WHERE ss."codigoDisciplina" = ${codigoDisciplina}
      ORDER BY st."idGrado" ASC
    `) as unknown as Array<{ idGrado: number }>;
    gradeIds = derivedRows.map((r) => r.idGrado);
    if (gradeIds.length === 0) {
      throw new AppError(400, "NO_GRADES", "La disciplina no tiene estudiantes inscritos. Agregue estudiantes o indique grados explícitamente.");
    }
  }

  const gradeRows = (await sql`
    SELECT "idGrado"
    FROM "Grade"
    WHERE "idGrado" = ANY(${gradeIds})
  `) as unknown as Array<{ idGrado: number }>;
  if (gradeRows.length !== gradeIds.length) throw new AppError(400, "INVALID_GRADE", "Uno o más grados no son válidos");

  const teacher = await first<any>(
    await sql`SELECT "idProfesor", "estado" FROM "Teacher" WHERE "idProfesor" = ${idProfesor} LIMIT 1` as any[]
  );
  if (!teacher) throw new AppError(400, "INVALID_TEACHER", "Profesor no válido");
  if (teacher.estado !== "activo") throw new AppError(400, "TEACHER_INACTIVE", "El profesor está inactivo");

  const scheduleLinks = Array.from(
    new Map((await resolveScheduleLinks(schedules)).map((link) => [link.idHorario, link])).values(),
  );

  const existingRows = (await sql`
    SELECT "idAsignacion", "idGrado", "estado"
    FROM "ExtracurricularAssignment"
    WHERE "idProfesor" = ${idProfesor}
      AND "codigoDisciplina" = ${codigoDisciplina}
      AND "idGrado" = ANY(${gradeIds})
  `) as unknown as Array<{ idAsignacion: string; idGrado: number; estado: string }>;

  const existingByGrade = new Map(existingRows.map((row) => [row.idGrado, row]));
  const createdIds: string[] = [];

  await sql.transaction((tx) => {
    const ops: any[] = [];

    for (const gradeId of gradeIds) {
      const existing = existingByGrade.get(gradeId);
      const assignmentId = existing?.idAsignacion ?? crypto.randomUUID();
      createdIds.push(assignmentId);

      if (existing) {
        ops.push(
          tx`UPDATE "ExtracurricularAssignment" SET "esPrincipal" = ${esPrincipal || false}, "estado" = 'activo', "updatedAt" = now() WHERE "idAsignacion" = ${assignmentId}`,
        );
      } else {
        ops.push(
          tx`INSERT INTO "ExtracurricularAssignment" ("idAsignacion", "idProfesor", "codigoDisciplina", "idGrado", "esPrincipal", "updatedAt") VALUES (${assignmentId}, ${idProfesor}, ${codigoDisciplina}, ${gradeId}, ${esPrincipal || false}, now())`,
        );
      }

      ops.push(tx`DELETE FROM "AssignmentSchedule" WHERE "idAsignacion" = ${assignmentId}`);
      for (const link of scheduleLinks) {
        ops.push(
          tx`INSERT INTO "AssignmentSchedule" ("id", "idAsignacion", "idHorario") VALUES (gen_random_uuid(), ${assignmentId}, ${link.idHorario})`,
        );
      }
    }

    return ops;
  });

  return getAssignmentById(createdIds[0]);
}

export async function updateAssignment(id: string, data: { esPrincipal?: boolean; estado?: string; schedules?: any[] }) {
  const { esPrincipal, estado, schedules } = data;

  const existing = await first<any>(
    await sql`SELECT "idAsignacion" FROM "ExtracurricularAssignment" WHERE "idAsignacion" = ${id} LIMIT 1` as any[]
  );
  if (!existing) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "No se encontró la asignación");

  const sets: string[] = [];
  const vals: any[] = [];
  let idx = 0;
  const add = (v: any) => { idx++; vals.push(v); return `$${idx}`; };

  if (esPrincipal !== undefined) sets.push(`"esPrincipal" = ${add(esPrincipal)}`);
  if (estado !== undefined) sets.push(`"estado" = ${add(estado)}`);

  if (sets.length > 0) {
    vals.push(id);
    await sql(`UPDATE "ExtracurricularAssignment" SET ${sets.join(", ")}, "updatedAt" = now() WHERE "idAsignacion" = $${idx + 1}`, vals);
  }

  if (schedules) {
    const linkData = await resolveScheduleLinks(schedules);
    await sql`DELETE FROM "AssignmentSchedule" WHERE "idAsignacion" = ${id}`;
    for (const link of linkData) {
      await sql`INSERT INTO "AssignmentSchedule" ("id", "idAsignacion", "idHorario") VALUES (gen_random_uuid(), ${id}, ${link.idHorario})`;
    }
  }

  return getAssignmentById(id);
}

export async function deleteAssignment(id: string) {
  const assignment = await first<any>(
    await sql`SELECT "idAsignacion" FROM "ExtracurricularAssignment" WHERE "idAsignacion" = ${id} LIMIT 1` as any[]
  );
  if (!assignment) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "No se encontró la asignación");

  // Se borra SIEMPRE en cascada, aunque haya estudiantes inscritos.
  // ClassSession no tiene ON DELETE CASCADE, así que se limpia antes.
  // AssignmentSchedule tiene ON DELETE CASCADE desde la asignación.
  await sql.transaction((tx) => [
    tx`DELETE FROM "ClassSession" WHERE "idAsignacion" = ${id}`,
    tx`DELETE FROM "ExtracurricularAssignment" WHERE "idAsignacion" = ${id}`,
  ]);

  return { message: "Asignación eliminada" };
}
