import { Request, Response } from "express";
import * as service from "./dashboardAdmin.service";

export async function getStats(_req: Request, res: Response) {
  const data = await service.getStats();
  res.json({ success: true, data });
}