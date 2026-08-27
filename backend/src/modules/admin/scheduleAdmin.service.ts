import prisma from "../../config/prisma";
import { AppError } from "../../middlewares/errorHandler";
import { PaginationParams, paginatedResult } from "../../utils/pagination";
import { DIAS_VALIDOS, normalizeTime } from "../../utils/validators";

export async function listSchedules(query: { dia?: string }, pagination: PaginationParams) {
  const { dia } = query;

  const where: any = {};
  if (dia) where.diaSemana = dia as string;

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
  const schedule = await prisma.schedule.findUnique({ where: { idHorario: id } });
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

  const existing = await prisma.schedule.findFirst({ where: { diaSemana, horaInicio: hi, horaFin: hf } });
  if (existing) {
    return { schedule: existing, created: false };
  }

  const schedule = await prisma.schedule.create({
    data: { diaSemana, horaInicio: hi, horaFin: hf, aula },
  });

  return { schedule, created: true };
}