import { sql, first } from "../../config/db";
import { AppError } from "../../middlewares/errorHandler";
import { PaginationParams, paginatedResult } from "../../utils/pagination";
import { DIAS_VALIDOS, normalizeTime } from "../../utils/validators";

export async function listSchedules(query: { dia?: string }, pagination: PaginationParams) {
  const { dia } = query;

  const conditions: string[] = [];
  const params: any[] = [];

  let idx = 0;
  const next = (v: any): string => { idx++; params.push(v); return `$${idx}`; };

  if (dia) conditions.push(`s."diaSemana" = ${next(dia)}`);

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const countRows = await sql(`SELECT COUNT(*)::int AS total FROM "Schedule" s ${where}`, params) as any[];
  const total = countRows[0]?.total ?? 0;

  const offset = (pagination.page - 1) * pagination.limit;
  const lim = params.length + 1;
  const off = params.length + 2;
  const dataParams = [...params, pagination.limit, offset];

  const data = await sql(
    `SELECT s."idHorario", s."diaSemana", s."horaInicio", s."horaFin", s."aula", s."estado", s."createdAt", s."updatedAt"
     FROM "Schedule" s ${where}
     ORDER BY s."diaSemana" ASC, s."horaInicio" ASC
     LIMIT $${lim} OFFSET $${off}`,
    dataParams
  ) as any[];

  return paginatedResult(data, total, pagination);
}

export async function getScheduleById(id: string) {
  const schedule = await first<any>(
    await sql`SELECT * FROM "Schedule" WHERE "idHorario" = ${id} LIMIT 1` as any[]
  );
  if (!schedule) throw new AppError(404, "SCHEDULE_NOT_FOUND", "No se encontró el horario");
  return schedule;
}

export async function createSchedule(data: {
  diaSemana: string;
  horaInicio: string;
  horaFin?: string | null;
  aula?: string | null;
}) {
  const { diaSemana, horaInicio, horaFin, aula } = data;

  if (!diaSemana || !DIAS_VALIDOS.includes(diaSemana)) {
    throw new AppError(400, "INVALID_DAY", `Día inválido. Use uno de: ${DIAS_VALIDOS.join(", ")}`);
  }
  const hi = normalizeTime(horaInicio);
  const hf = horaFin === null ? null : normalizeTime(horaFin);

  const existing = await first<any>(
    await sql`SELECT * FROM "Schedule" WHERE "diaSemana" = ${diaSemana} AND "horaInicio" = ${hi} AND "horaFin" = ${hf} LIMIT 1` as any[]
  );
  if (existing) {
    return { schedule: existing, created: false };
  }

  const rows = await sql`INSERT INTO "Schedule" ("idHorario", "diaSemana", "horaInicio", "horaFin", "aula", "updatedAt") VALUES (gen_random_uuid(), ${diaSemana}, ${hi}, ${hf}, ${aula}, now()) RETURNING *` as any[];

  return { schedule: rows[0], created: true };
}
