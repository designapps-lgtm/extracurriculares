import prisma from "../../config/prisma";
import { AppError } from "../../middlewares/errorHandler";
import { PaginationParams, PaginatedResult, paginatedResult } from "../../utils/pagination";
import { ScheduleQuery } from "./schedule.types";
import { Prisma } from "@prisma/client";

export async function getSchedules(query: ScheduleQuery, pagination: PaginationParams): Promise<PaginatedResult<Prisma.ScheduleGetPayload<{}>>> {
  const where: Prisma.ScheduleWhereInput = {};

  if (query.dia) {
    where.diaSemana = { contains: query.dia, mode: "insensitive" };
  }

  const [data, total] = await Promise.all([
    prisma.schedule.findMany({
      where,
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }],
    }),
    prisma.schedule.count({ where }),
  ]);

  return paginatedResult(data, total, pagination);
}

export async function getScheduleById(id: string) {
  const schedule = await prisma.schedule.findUnique({
    where: { idHorario: id },
  });

  if (!schedule) {
    throw new AppError(404, "SCHEDULE_NOT_FOUND", "No se encontró el horario");
  }

  return schedule;
}
