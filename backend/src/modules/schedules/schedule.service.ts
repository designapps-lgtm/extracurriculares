import { sql, first } from "../../config/db";
import { AppError } from "../../middlewares/errorHandler";
import { PaginationParams, PaginatedResult, paginatedResult } from "../../utils/pagination";
import { ScheduleQuery } from "./schedule.types";

export async function getSchedules(query: ScheduleQuery, pagination: PaginationParams): Promise<PaginatedResult<any>> {
  const conditions: string[] = [];
  const params: any[] = [];

  if (query.dia) {
    params.push(`%${query.dia}%`);
    conditions.push(`"diaSemana" ILIKE $1`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countRows = await sql(
    `SELECT COUNT(*)::int AS total FROM "Schedule" ${where}`,
    params
  ) as unknown as Array<{ total: number }>;
  const total = countRows[0]?.total ?? 0;

  const offset = (pagination.page - 1) * pagination.limit;
  const dataParams = [...params, pagination.limit, offset];
  const lim = params.length + 1;
  const off = params.length + 2;

  const data = await sql(
    `SELECT * FROM "Schedule" ${where}
     ORDER BY "diaSemana" ASC, "horaInicio" ASC
     LIMIT $${lim} OFFSET $${off}`,
    dataParams
  );

  return paginatedResult(data as any[], total, pagination);
}

export async function getScheduleById(id: string) {
  const schedule = await first<any>(
    await sql`SELECT * FROM "Schedule" WHERE "idHorario" = ${id} LIMIT 1` as unknown as any[]
  );

  if (!schedule) {
    throw new AppError(404, "SCHEDULE_NOT_FOUND", "No se encontró el horario");
  }

  return schedule;
}
