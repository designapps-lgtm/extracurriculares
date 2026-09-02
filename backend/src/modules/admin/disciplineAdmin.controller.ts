import { Request, Response } from "express";
import * as service from "./disciplineAdmin.service";
import { parsePagination } from "../../utils/pagination";

export async function listDisciplines(req: Request, res: Response) {
  const pagination = parsePagination(req.query as Record<string, string>);
  const data = await service.getDisciplines({
    search: (req.query.search as string | undefined) || undefined,
  }, pagination);
  res.json({ success: true, ...data });
}

export async function getDisciplineGrades(req: Request, res: Response) {
  const codigo = String(req.params.codigo ?? "");
  const data = await service.getDisciplineGrades(codigo);
  res.json({ success: true, ...data });
}