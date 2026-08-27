import { Request, Response } from "express";
import * as service from "./teacherAdmin.service";
import { parsePagination } from "../../utils/pagination";

export async function getTeachers(req: Request, res: Response) {
  const pagination = parsePagination(req.query as Record<string, string>);
  const data = await service.getTeachers({
    search: (req.query.search as string | undefined) || undefined,
  }, pagination);
  res.json({ success: true, ...data });
}

export async function getTeacherById(req: Request, res: Response) {
  const data = await service.getTeacherById(req.params.id as string);
  res.json({ success: true, data });
}

export async function createTeacher(req: Request, res: Response) {
  const { nombre, apellido, correo, fotoUrl } = req.body;
  const data = await service.createTeacher({ nombre, apellido, correo, fotoUrl });
  res.status(201).json({ success: true, data });
}

export async function updateTeacher(req: Request, res: Response) {
  const { nombre, apellido, correo, fotoUrl, estado } = req.body;
  const data = await service.updateTeacher(req.params.id as string, { nombre, apellido, correo, fotoUrl, estado });
  res.json({ success: true, data });
}

export async function deleteTeacher(req: Request, res: Response) {
  await service.deleteTeacher(req.params.id as string);
  res.json({ success: true, data: { message: "Profesor eliminado" } });
}