import { Request, Response } from "express";
import * as service from "./studentAdmin.service";
import { parsePagination } from "../../utils/pagination";

export async function getStudents(req: Request, res: Response) {
  const { search, grado, inscrito } = req.query;
  const pagination = parsePagination(req.query as Record<string, string>);
  const data = await service.getStudents({
    search: search as string | undefined,
    grado: grado as string | undefined,
    inscrito: inscrito as string | undefined,
  }, pagination);
  res.json({ success: true, ...data });
}

export async function getStudentByCode(req: Request, res: Response) {
  const data = await service.getStudentByCode(req.params.codigo as string);
  res.json({ success: true, data });
}

export async function updateStudent(req: Request, res: Response) {
  const { nombre, apellido, idGrado, grupo, correo, estado, fotoUrl } = req.body;
  const data = await service.updateStudent(req.params.codigo as string, { nombre, apellido, idGrado, grupo, correo, estado, fotoUrl });
  res.json({ success: true, data });
}