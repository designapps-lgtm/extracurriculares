import { AppError } from "../../middlewares/errorHandler";
import { type PaginatedResult, type PaginationParams, paginatedResult } from "../../utils/pagination";
import { loadCoreData, pageSlice, schedulePayload } from "../../db/views";
import type { ScheduleQuery } from "./schedule.types";

const DAY_ORDER = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"];

export async function getSchedules(query: ScheduleQuery, pagination: PaginationParams): Promise<PaginatedResult<any>> {
  const data = await loadCoreData();
  const rows = data.schedules
    .filter((row) => !query.dia || row.day.includes(query.dia.toUpperCase()))
    .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || (a.startTime ?? "").localeCompare(b.startTime ?? ""));
  return paginatedResult(pageSlice(rows, pagination.page, pagination.limit).map(schedulePayload), rows.length, pagination);
}

export async function getScheduleById(id: string) {
  const data = await loadCoreData();
  const schedule = data.scheduleById.get(id);
  if (!schedule) throw new AppError(404, "SCHEDULE_NOT_FOUND", "No se encontró el horario");
  return schedulePayload(schedule);
}
