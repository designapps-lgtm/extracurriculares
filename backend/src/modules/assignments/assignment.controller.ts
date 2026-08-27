import { Request, Response, NextFunction } from "express";
import * as assignmentService from "./assignment.service";
import { parsePagination } from "../../utils/pagination";
import { AssignmentQuery } from "./assignment.types";

export async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(req.query as Record<string, string>);
    const query = req.query as AssignmentQuery;
    const result = await assignmentService.getAssignments(query, pagination);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const assignment = await assignmentService.getAssignmentById(req.params.id);
    res.json({ success: true, data: assignment });
  } catch (err) {
    next(err);
  }
}
