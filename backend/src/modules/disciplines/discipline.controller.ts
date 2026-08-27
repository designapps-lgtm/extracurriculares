import { Request, Response, NextFunction } from "express";
import * as disciplineService from "./discipline.service";
import { parsePagination } from "../../utils/pagination";
import { DisciplineQuery } from "./discipline.types";

export async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(req.query as Record<string, string>);
    const query = req.query as DisciplineQuery;
    const result = await disciplineService.getDisciplines(query, pagination);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getByCodigo(req: Request, res: Response, next: NextFunction) {
  try {
    const discipline = await disciplineService.getDisciplineByCodigo(req.params.codigo);
    res.json({ success: true, data: discipline });
  } catch (err) {
    next(err);
  }
}

export async function getStudents(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(req.query as Record<string, string>);
    const result = await disciplineService.getDisciplineStudents(req.params.codigo, pagination);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getTeachers(req: Request, res: Response, next: NextFunction) {
  try {
    const teachers = await disciplineService.getDisciplineTeachers(req.params.codigo);
    res.json({ success: true, data: teachers });
  } catch (err) {
    next(err);
  }
}
