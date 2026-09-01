import { Request, Response } from "express";
import * as service from "./secretaryAdmin.service";
import { parsePagination } from "../../utils/pagination";

export async function getSecretaries(req: Request, res: Response) {
  const pagination = parsePagination(req.query as Record<string, string>);
  const data = await service.getSecretaries({
    search: (req.query.search as string | undefined) || undefined,
  }, pagination);
  res.json({ success: true, ...data });
}

export async function getSecretaryById(req: Request, res: Response) {
  const data = await service.getSecretaryById(req.params.id as string);
  res.json({ success: true, data });
}

export async function createSecretary(req: Request, res: Response) {
  const { codigoSecretary, nombre, apellido, correo, fotoUrl } = req.body;
  const data = await service.createSecretary({ codigoSecretary, nombre, apellido, correo, fotoUrl });
  res.status(201).json({ success: true, data });
}

export async function updateSecretary(req: Request, res: Response) {
  const { codigoSecretary, nombre, apellido, correo, fotoUrl, estado } = req.body;
  const data = await service.updateSecretary(req.params.id as string, { codigoSecretary, nombre, apellido, correo, fotoUrl, estado });
  res.json({ success: true, data });
}

export async function deleteSecretary(req: Request, res: Response) {
  await service.deleteSecretary(req.params.id as string);
  res.json({ success: true, data: { message: "Secretaria eliminada" } });
}
