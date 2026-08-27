import { Request, Response } from "express";
import * as service from "./scheduleAdmin.service";
import { parsePagination } from "../../utils/pagination";

export async function listSchedules(req: Request, res: Response) {
  const pagination = parsePagination(req.query as Record<string, string>);
  const data = await service.listSchedules({
    dia: (req.query.dia as string | undefined) || undefined,
  }, pagination);
  res.json({ success: true, ...data });
}

export async function getScheduleById(req: Request, res: Response) {
  const data = await service.getScheduleById(req.params.id as string);
  res.json({ success: true, data });
}

export async function createSchedule(req: Request, res: Response) {
  const { diaSemana, horaInicio, horaFin, aula } = req.body;
  const { schedule, created } = await service.createSchedule({ diaSemana, horaInicio, horaFin, aula });
  res.status(created ? 201 : 200).json({ success: true, data: schedule, created });
}