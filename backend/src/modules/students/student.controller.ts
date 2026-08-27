import { Request, Response, NextFunction } from "express";
import * as studentService from "./student.service";
import { parsePagination } from "../../utils/pagination";
import { StudentQuery } from "./student.types";

export async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(req.query as Record<string, string>);
    const query = req.query as StudentQuery;
    const result = await studentService.getStudents(query, pagination);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getByCode(req: Request, res: Response, next: NextFunction) {
  try {
    const student = await studentService.getStudentByCode(req.params.codigo);
    res.json({ success: true, data: student });
  } catch (err) {
    next(err);
  }
}

export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const profile = await studentService.getStudentProfile(req.params.codigo);
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
}
