import { Request, Response } from "express";
import * as service from "./assignmentAdmin.service";
import { parsePagination } from "../../utils/pagination";

export async function getAssignments(req: Request, res: Response) {
  const { disciplina, grado, profesor } = req.query;
  const pagination = parsePagination(req.query as Record<string, string>);
  const data = await service.getAssignments({
    disciplina: disciplina as string | undefined,
    grado: grado as string | undefined,
    profesor: profesor as string | undefined,
  }, pagination);
  res.json({ success: true, ...data });
}

export async function getAssignmentById(req: Request, res: Response) {
  const data = await service.getAssignmentById(req.params.id as string);
  res.json({ success: true, data });
}

export async function createAssignment(req: Request, res: Response) {
  const data = await service.createAssignment(req.body);
  res.status(201).json({ success: true, data });
}

export async function updateAssignment(req: Request, res: Response) {
  const data = await service.updateAssignment(req.params.id as string, req.body);
  res.json({ success: true, data });
}

export async function deleteAssignment(req: Request, res: Response) {
  const data = await service.deleteAssignment(req.params.id as string);
  res.json({ success: true, data });
}