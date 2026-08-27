import { Request, Response, NextFunction } from "express";
import * as scheduleService from "./schedule.service";
import { parsePagination } from "../../utils/pagination";
import { ScheduleQuery } from "./schedule.types";

export async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(req.query as Record<string, string>);
    const query = req.query as ScheduleQuery;
    const result = await scheduleService.getSchedules(query, pagination);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const schedule = await scheduleService.getScheduleById(req.params.id);
    res.json({ success: true, data: schedule });
  } catch (err) {
    next(err);
  }
}
