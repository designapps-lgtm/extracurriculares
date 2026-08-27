import { Request, Response, NextFunction } from "express";
import * as teacherService from "./teacher.service";
import { parsePagination } from "../../utils/pagination";
import { TeacherQuery } from "./teacher.types";
import { param } from "../../utils/reqParams";

export async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(req.query as Record<string, string>);
    const query = req.query as TeacherQuery;
    const result = await teacherService.getTeachers(query, pagination);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const teacher = await teacherService.getTeacherById(param(req, "id"));
    res.json({ success: true, data: teacher });
  } catch (err) {
    next(err);
  }
}

export async function getAssignments(req: Request, res: Response, next: NextFunction) {
  try {
    const assignments = await teacherService.getTeacherAssignments(param(req, "id"));
    res.json({ success: true, data: assignments });
  } catch (err) {
    next(err);
  }
}
