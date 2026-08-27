import prisma from "../../config/prisma";
import { AppError } from "../../middlewares/errorHandler";
import { PaginationParams, PaginatedResult, paginatedResult } from "../../utils/pagination";
import { TeacherQuery } from "./teacher.types";
import { Prisma } from "@prisma/client";

const assignmentInclude = {
  discipline: { select: { codigoDisciplina: true, nombre: true } },
  grade: { select: { idGrado: true, nombre: true } },
  schedules: {
    include: {
      schedule: { select: { diaSemana: true, horaInicio: true, horaFin: true, aula: true } },
    },
  },
};

export async function getTeachers(query: TeacherQuery, pagination: PaginationParams): Promise<PaginatedResult<unknown>> {
  const where: Prisma.TeacherWhereInput = {};

  if (query.search) {
    where.OR = [
      { nombre: { contains: query.search, mode: "insensitive" } },
      { apellido: { contains: query.search, mode: "insensitive" } },
      { codigoProfesor: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.teacher.findMany({
      where,
      include: { _count: { select: { assignments: true } } },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
    }),
    prisma.teacher.count({ where }),
  ]);

  return paginatedResult(data, total, pagination);
}

export async function getTeacherById(id: string) {
  const teacher = await prisma.teacher.findUnique({
    where: { idProfesor: id },
    include: { _count: { select: { assignments: true } } },
  });

  if (!teacher) {
    throw new AppError(404, "TEACHER_NOT_FOUND", "No se encontró el profesor");
  }

  return teacher;
}

export async function getTeacherAssignments(id: string) {
  const teacher = await prisma.teacher.findUnique({ where: { idProfesor: id } });
  if (!teacher) {
    throw new AppError(404, "TEACHER_NOT_FOUND", "No se encontró el profesor");
  }

  return prisma.extracurricularAssignment.findMany({
    where: { idProfesor: id },
    include: assignmentInclude,
    orderBy: { createdAt: "asc" },
  });
}
