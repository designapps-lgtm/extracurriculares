import { Request, Response } from "express";
import * as service from "./supervisorAdmin.service";
import { parsePagination } from "../../utils/pagination";

export async function getSupervisors(req: Request, res: Response) {
  const pagination = parsePagination(req.query as Record<string, string>);
  const data = await service.getSupervisors({
    search: (req.query.search as string | undefined) || undefined,
  }, pagination);
  res.json({ success: true, ...data });
}

export async function getSupervisorById(req: Request, res: Response) {
  const data = await service.getSupervisorById(req.params.id as string);
  res.json({ success: true, data });
}

export async function createSupervisor(req: Request, res: Response) {
  const { codigoSupervisor, nombre, apellido, correo, fotoUrl } = req.body;
  const data = await service.createSupervisor({ codigoSupervisor, nombre, apellido, correo, fotoUrl });
  res.status(201).json({ success: true, data });
}

export async function updateSupervisor(req: Request, res: Response) {
  const { codigoSupervisor, nombre, apellido, correo, fotoUrl, estado } = req.body;
  const data = await service.updateSupervisor(req.params.id as string, { codigoSupervisor, nombre, apellido, correo, fotoUrl, estado });
  res.json({ success: true, data });
}

export async function deleteSupervisor(req: Request, res: Response) {
  await service.deleteSupervisor(req.params.id as string);
  res.json({ success: true, data: { message: "Supervisora eliminada" } });
}