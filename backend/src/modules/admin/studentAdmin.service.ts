import { Request, Response } from "express";
import prisma from "../../config/prisma";
import { AppError } from "../../middlewares/errorHandler";
import { PaginationParams } from "../../utils/pagination";
import { Prisma } from "@prisma/client";

export async function getStudents(req: Request, res: Response) {
  const page = parseInt((req.query.page as string) || "1");
  const limit = Math.min(parseInt((req.query.limit as string) || "20"), 100);
  const { search, grado, inscrito } = req.query;

  const where: Prisma.StudentWhereInput = {};

  if (search) {
    where.OR = [
      { codigoEstudiante: { contains: search as string, mode: "insensitive" } },
      { nombre: { contains: search as string, mode: "insensitive" } },
      { apellido: { contains: search as string, mode: "insensitive" } },
    ];
  }

  if (grado) {
    const grade = await prisma.grade.findFirst({ where: { nombre: grado as string } });
    if (grade) where.idGrado = grade.idGrado;
  }

  if (inscrito === "true") {
    where.studentSchedules = { some: {} };
  } else if (inscrito === "false") {
    where.studentSchedules = { none: {} };
  }

  const [data, total] = await Promise.all([
    prisma.student.findMany({
      where,
      include: { grade: true, studentSchedules: true },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
    }),
    prisma.student.count({ where }),
  ]);

  res.json({
    success: true,
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function getStudentByCode(req: Request, res: Response) {
  const student = await prisma.student.findUnique({
    where: { codigoEstudiante: req.params.codigo },
    include: { grade: true, studentSchedules: { include: { discipline: true } } },
  });

  if (!student) throw new AppError(404, "STUDENT_NOT_FOUND", "No se encontró el estudiante");
  res.json({ success: true, data: student });
}

export async function updateStudent(req: Request, res: Response) {
  const { codigo } = req.params;
  const { nombre, apellido, idGrado, grupo, correo, estado, fotoUrl } = req.body;

  const student = await prisma.student.findUnique({ where: { codigoEstudiante: codigo } });
  if (!student) throw new AppError(404, "STUDENT_NOT_FOUND", "No se encontró el estudiante");

  // Validate grade exists if provided
  if (idGrado) {
    const grade = await prisma.grade.findUnique({ where: { idGrado } });
    if (!grade) throw new AppError(400, "INVALID_GRADE", "Grado no válido");
  }

  const updated = await prisma.student.update({
    where: { codigoEstudiante: codigo },
    data: {
      ...(nombre !== undefined && { nombre }),
      ...(apellido !== undefined && { apellido }),
      ...(idGrado !== undefined && { idGrado }),
      ...(grupo !== undefined && { grupo }),
      ...(correo !== undefined && { correo }),
      ...(estado !== undefined && { estado }),
      ...(fotoUrl !== undefined && { fotoUrl }),
    },
    include: { grade: true },
  });

  res.json({ success: true, data: updated });
}
