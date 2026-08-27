import prisma from "../../config/prisma";
import { AppError } from "../../middlewares/errorHandler";
import { getOr404 } from "../../utils/getOr404";
import { PaginationParams, paginatedResult } from "../../utils/pagination";
import { Prisma } from "@prisma/client";

const teacherAdminSelect = {
  idProfesor: true,
  codigoProfesor: true,
  nombre: true,
  apellido: true,
  correo: true,
  fotoUrl: true,
  estado: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function getTeachers(query: { search?: string }, pagination: PaginationParams) {
  const { search } = query;

  const where: Prisma.TeacherWhereInput = {};
  if (search) {
    where.OR = [
      { nombre: { contains: search, mode: "insensitive" } },
      { apellido: { contains: search, mode: "insensitive" } },
      { correo: { contains: search, mode: "insensitive" } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.teacher.findMany({
      where,
      select: { ...teacherAdminSelect, _count: { select: { assignments: true } } },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
    }),
    prisma.teacher.count({ where }),
  ]);

  return paginatedResult(data, total, pagination);
}

export async function getTeacherById(id: string) {
  return getOr404(
    prisma.teacher.findUnique({
      where: { idProfesor: id },
      select: { ...teacherAdminSelect, _count: { select: { assignments: true } } },
    }),
    "TEACHER_NOT_FOUND",
    "No se encontró el profesor",
  );
}

export async function createTeacher(data: { nombre: string; apellido: string; correo?: string; fotoUrl?: string }) {
  const { nombre, apellido, correo, fotoUrl } = data;

  if (!nombre || !apellido) {
    throw new AppError(400, "VALIDATION_ERROR", "Nombre y apellido son requeridos");
  }

  return prisma.teacher.create({
    data: { nombre, apellido, correo, fotoUrl },
    select: teacherAdminSelect,
  });
}

export async function updateTeacher(id: string, data: {
  nombre?: string;
  apellido?: string;
  correo?: string;
  fotoUrl?: string;
  estado?: string;
}) {
  const { nombre, apellido, correo, fotoUrl, estado } = data;

  const teacher = await getOr404(prisma.teacher.findUnique({ where: { idProfesor: id } }), "TEACHER_NOT_FOUND", "No se encontró el profesor");

  if (estado === "inactivo" && teacher.estado !== "inactivo") {
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
    select: teacherAdminSelect,
  });

  return updated;
}

export async function deleteTeacher(id: string) {
  const teacher = await getOr404(prisma.teacher.findUnique({ where: { idProfesor: id } }), "TEACHER_NOT_FOUND", "No se encontró el profesor");

  const activeAssignments = await prisma.extracurricularAssignment.count({
    where: { idProfesor: id, estado: "activo" },
  });
  if (activeAssignments > 0) {
    throw new AppError(400, "HAS_ACTIVE_ASSIGNMENTS", "No se puede eliminar un profesor con asignaciones activas");
  }

  await prisma.teacher.delete({ where: { idProfesor: id } });
}