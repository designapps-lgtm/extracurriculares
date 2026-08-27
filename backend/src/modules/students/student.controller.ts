import { Request, Response, NextFunction } from "express";
import * as studentService from "./student.service";
import { parsePagination } from "../../utils/pagination";
import { param } from "../../utils/reqParams";
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
    const student = await studentService.getStudentByCode(param(req, "codigo"));
    res.json({ success: true, data: student });
  } catch (err) {
    next(err);
  }
}

export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const profile = await studentService.getStudentProfile(param(req, "codigo"));
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
}
