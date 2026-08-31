import { sql, first } from "../../config/db";
import { AppError } from "../../middlewares/errorHandler";
import { PaginationParams, paginatedResult } from "../../utils/pagination";
import { ASSIGNMENT_SELECT, buildAssignmentList, AssignmentRow } from "../../utils/assignmentQueries";

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

  const DIAS_VALIDOS = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"];

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
    if (!diaSemana || !DIAS_VALIDOS.includes(diaSemana)) {
      throw new AppError(400, "INVALID_DAY", `Día inválido. Use uno de: ${DIAS_VALIDOS.join(", ")}`);
    }

    const normalizeTime = (value: any): string | null => {
      if (value === null || value === undefined || value === "") return null;
      const t = String(value).trim();
      const m = t.match(/^(\d{1,2}):(\d{2})$/);
      if (!m) throw new AppError(400, "INVALID_TIME", `Hora inválida: '${t}'. Use formato HH:mm`);
      return `${String(parseInt(m[1], 10)).padStart(2, "0")}:${String(parseInt(m[2], 10)).padStart(2, "0")}`;
    };

    const hi = normalizeTime(horaInicio);
    const hf = normalizeTime(horaFin);

    const existing = await first<any>(
      await sql`SELECT "idHorario" FROM "Schedule" WHERE "diaSemana" = ${diaSemana} AND "horaInicio" = ${hi} AND "horaFin" = ${hf} LIMIT 1` as any[]
    );
    if (existing) {
      links.push({ idHorario: existing.idHorario });
    } else {
      const rows = await sql`INSERT INTO "Schedule" ("idHorario", "diaSemana", "horaInicio", "horaFin", "aula") VALUES (gen_random_uuid(), ${diaSemana}, ${hi}, ${hf}, ${aula || null}) RETURNING "idHorario"` as any[];
      links.push({ idHorario: rows[0].idHorario });
    }
  }

  return links;
}

export async function createAssignment(data: {
  codigoDisciplina: string;
  idGrado: number;
  idProfesor: string;
  esPrincipal?: boolean;
  schedules?: any[];
}) {
  const { codigoDisciplina, idGrado, idProfesor, esPrincipal, schedules } = data;

  if (!codigoDisciplina || !idGrado || !idProfesor) {
    throw new AppError(400, "VALIDATION_ERROR", "codigoDisciplina, idGrado e idProfesor son requeridos");
  }

  const discipline = await first<any>(
    await sql`SELECT "codigoDisciplina" FROM "Discipline" WHERE "codigoDisciplina" = ${codigoDisciplina} LIMIT 1` as any[]
  );
  if (!discipline) throw new AppError(400, "INVALID_DISCIPLINE", "Disciplina no válida");

  const grade = await first<any>(
    await sql`SELECT "idGrado" FROM "Grade" WHERE "idGrado" = ${idGrado} LIMIT 1` as any[]
  );
  if (!grade) throw new AppError(400, "INVALID_GRADE", "Grado no válido");

  const teacher = await first<any>(
    await sql`SELECT "idProfesor", "estado" FROM "Teacher" WHERE "idProfesor" = ${idProfesor} LIMIT 1` as any[]
  );
  if (!teacher) throw new AppError(400, "INVALID_TEACHER", "Profesor no válido");
  if (teacher.estado !== "activo") throw new AppError(400, "TEACHER_INACTIVE", "El profesor está inactivo");

  const scheduleLinks = await resolveScheduleLinks(schedules);

  const idRows = await sql`SELECT gen_random_uuid() AS id` as any[];
  const newId = idRows[0].id;

  await sql.transaction((tx) => [
    tx`INSERT INTO "ExtracurricularAssignment" ("idAsignacion", "idProfesor", "codigoDisciplina", "idGrado", "esPrincipal") VALUES (${newId}, ${idProfesor}, ${codigoDisciplina}, ${idGrado}, ${esPrincipal || false})`,
    ...scheduleLinks.map((link) =>
      tx`INSERT INTO "AssignmentSchedule" ("id", "idAsignacion", "idHorario") VALUES (gen_random_uuid(), ${newId}, ${link.idHorario})`
    ),
  ]);

  return getAssignmentById(newId);
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
    await sql`SELECT "idAsignacion", "codigoDisciplina" FROM "ExtracurricularAssignment" WHERE "idAsignacion" = ${id} LIMIT 1` as any[]
  );
  if (!assignment) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "No se encontró la asignación");

  const enrolledRows = await sql`SELECT COUNT(*)::int AS count FROM "StudentSchedule" WHERE "codigoDisciplina" = ${assignment.codigoDisciplina}` as any[];

  if ((enrolledRows[0]?.count ?? 0) > 0) {
    await sql`UPDATE "ExtracurricularAssignment" SET "estado" = 'inactivo', "updatedAt" = now() WHERE "idAsignacion" = ${id}`;
    return { message: "Asignación desactivada (tiene estudiantes inscritos)" };
  } else {
    await sql`DELETE FROM "ExtracurricularAssignment" WHERE "idAsignacion" = ${id}`;
    return { message: "Asignación eliminada" };
  }
}
