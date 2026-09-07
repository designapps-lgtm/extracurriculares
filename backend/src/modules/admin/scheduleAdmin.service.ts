import { AppError } from "../../middlewares/errorHandler";
import { normalizeDayName } from "../../utils/colombiaTime";
import type { PaginationParams } from "../../utils/pagination";
import { normalizeTime } from "../../utils/validators";
import { createScheduleRow } from "../appsheet/appsheet.domain";
import * as scheduleService from "../schedules/schedule.service";

const VALID_DAYS = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];

export function listSchedules(query: { dia?: string }, pagination: PaginationParams) {
  return scheduleService.getSchedules(query, pagination);
}

export function getScheduleById(id: string) {
  return scheduleService.getScheduleById(id);
}

export async function createSchedule(input: { diaSemana: string; horaInicio: string; horaFin?: string | null; aula?: string | null }) {
  const day = normalizeDayName(input.diaSemana);
  if (!VALID_DAYS.includes(day)) throw new AppError(400, "INVALID_DAY", `Día inválido. Use uno de: ${VALID_DAYS.join(", ")}`);
  const startTime = normalizeTime(input.horaInicio);
  const endTime = input.horaFin === null || input.horaFin === undefined || input.horaFin === "" ? null : normalizeTime(input.horaFin);
  if (!startTime) throw new AppError(400, "VALIDATION_ERROR", "Hora de inicio inválida");
  return createScheduleRow({ day, startTime, endTime, classroom: input.aula ?? null });
}
