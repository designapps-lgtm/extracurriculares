import { Request, Response, NextFunction } from "express";
import * as gradeService from "./grade.service";
import { parsePagination } from "../../utils/pagination";
import { validateNumericId } from "../../utils/validators";
import { param } from "../../utils/reqParams";

export async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(req.query as Record<string, string>);
    const result = await gradeService.getGrades(pagination);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = validateNumericId(param(req, "id"), "idGrado");
    const grade = await gradeService.getGradeById(id);
    res.json({ success: true, data: grade });
  } catch (err) {
    next(err);
  }
}

export async function getStudents(req: Request, res: Response, next: NextFunction) {
  try {
    const id = validateNumericId(param(req, "id"), "idGrado");
    const pagination = parsePagination(req.query as Record<string, string>);
    const result = await gradeService.getGradeStudents(id, pagination);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getAssignments(req: Request, res: Response, next: NextFunction) {
  try {
    const id = validateNumericId(param(req, "id"), "idGrado");
    const assignments = await gradeService.getGradeAssignments(id);
    res.json({ success: true, data: assignments });
  } catch (err) {
    next(err);
  }
}
