import { Request, Response } from "express";
import * as service from "./gradeAdmin.service";

export async function listGrades(_req: Request, res: Response) {
  const data = await service.listGrades();
  res.json({ success: true, data });
}