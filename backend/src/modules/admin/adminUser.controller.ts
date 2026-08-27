import { Request, Response } from "express";
import * as service from "./adminUser.service";

export async function listAdmins(_req: Request, res: Response) {
  const data = await service.listAdmins();
  res.json({ success: true, data });
}

export async function createAdmin(req: Request, res: Response) {
  const { email, nombre, apellido, password } = req.body;
  const data = await service.createAdmin({ email, nombre, apellido, password });
  res.status(201).json({ success: true, data });
}

export async function updateAdmin(req: Request, res: Response) {
  const { nombre, apellido, estado } = req.body;
  const data = await service.updateAdmin(req.params.id as string, req.admin?.adminId, { nombre, apellido, estado });
  res.json({ success: true, data });
}

export async function resetPassword(req: Request, res: Response) {
  await service.resetPassword(req.params.id as string, req.body.password);
  res.json({ success: true, data: { message: "Contraseña actualizada" } });
}

export async function deleteAdmin(req: Request, res: Response) {
  await service.deleteAdmin(req.params.id as string, req.admin?.adminId);
  res.json({ success: true, data: { message: "Admin eliminado" } });
}