import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../../config/prisma";
import { AppError } from "../../middlewares/errorHandler";
import { Prisma } from "@prisma/client";

export async function getTeachers(req: Request, res: Response) {
  const page = parseInt((req.query.page as string) || "1");
  const limit = Math.min(parseInt((req.query.limit as string) || "20"), 100);
  const { search } = req.query;

  const where: Prisma.TeacherWhereInput = {};
  if (search) {
    where.OR = [
      { nombre: { contains: search as string, mode: "insensitive" } },
      { apellido: { contains: search as string, mode: "insensitive" } },
      { correo: { contains: search as string, mode: "insensitive" } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.teacher.findMany({
      where,
      include: { _count: { select: { assignments: true } } },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
    }),
    prisma.teacher.count({ where }),
  ]);

  res.json({
    success: true,
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function getTeacherById(req: Request, res: Response) {
  const teacher = await prisma.teacher.findUnique({
    where: { idProfesor: req.params.id },
    include: { _count: { select: { assignments: true } } },
  });

  if (!teacher) throw new AppError(404, "TEACHER_NOT_FOUND", "No se encontró el profesor");
  res.json({ success: true, data: teacher });
}

export async function createTeacher(req: Request, res: Response) {
  const { nombre, apellido, correo, fotoUrl } = req.body;

  if (!nombre || !apellido) {
    throw new AppError(400, "VALIDATION_ERROR", "Nombre y apellido son requeridos");
  }

  const teacher = await prisma.teacher.create({
    data: { nombre, apellido, correo, fotoUrl },
  });

  res.status(201).json({ success: true, data: teacher });
}

export async function updateTeacher(req: Request, res: Response) {
  const { id } = req.params;
  const { nombre, apellido, correo, estado, fotoUrl } = req.body;

  const teacher = await prisma.teacher.findUnique({ where: { idProfesor: id } });
  if (!teacher) throw new AppError(404, "TEACHER_NOT_FOUND", "No se encontró el profesor");

  // Don't allow deactivating teacher with active assignments
  if (estado === "inactivo") {
    const activeAssignments = await prisma.extracurricularAssignment.count({
      where: { idProfesor: id, estado: "activo" },
    });
    if (activeAssignments > 0) {
      throw new AppError(400, "HAS_ACTIVE_ASSIGNMENTS", "No se puede desactivar un profesor con asignaciones activas");
    }
  }

  const updated = await prisma.teacher.update({
    where: { idProfesor: id },
    data: {
      ...(nombre !== undefined && { nombre }),
      ...(apellido !== undefined && { apellido }),
      ...(correo !== undefined && { correo }),
      ...(fotoUrl !== undefined && { fotoUrl }),
      ...(estado !== undefined && { estado }),
    },
  });

  res.json({ success: true, data: updated });
}

export async function deleteTeacher(req: Request, res: Response) {
  const { id } = req.params;

  const teacher = await prisma.teacher.findUnique({ where: { idProfesor: id } });
  if (!teacher) throw new AppError(404, "TEACHER_NOT_FOUND", "No se encontró el profesor");

  const activeAssignments = await prisma.extracurricularAssignment.count({
    where: { idProfesor: id, estado: "activo" },
  });
  if (activeAssignments > 0) {
    throw new AppError(400, "HAS_ACTIVE_ASSIGNMENTS", "No se puede eliminar un profesor con asignaciones activas");
  }

  await prisma.teacher.delete({ where: { idProfesor: id } });
  res.json({ success: true, data: { message: "Profesor eliminado" } });
}

export async function resetTeacherPassword(req: Request, res: Response) {
  const { id } = req.params;
  const { password } = req.body;

  if (!password || password.length < 6) {
    throw new AppError(400, "VALIDATION_ERROR", "La contraseña debe tener al menos 6 caracteres");
  }

  const teacher = await prisma.teacher.findUnique({ where: { idProfesor: id } });
  if (!teacher) throw new AppError(404, "TEACHER_NOT_FOUND", "No se encontró el profesor");

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.teacher.update({
    where: { idProfesor: id },
    data: { passwordHash },
  });

  res.json({ success: true, data: { message: "Contraseña actualizada" } });
}
