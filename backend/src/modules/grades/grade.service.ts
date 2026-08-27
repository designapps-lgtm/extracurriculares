import prisma from "../../config/prisma";
import { AppError } from "../../middlewares/errorHandler";
import { PaginationParams, PaginatedResult, paginatedResult } from "../../utils/pagination";
import { assignmentInclude } from "../../utils/prismaIncludes";
import { Prisma } from "@prisma/client";

export async function getGrades(pagination: PaginationParams): Promise<PaginatedResult<Prisma.GradeGetPayload<{ include: { _count: { select: { students: true; assignments: true } } } }>>> {
  const [data, total] = await Promise.all([
    prisma.grade.findMany({
      include: { _count: { select: { students: true, assignments: true } } },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      orderBy: { nombre: "asc" },
    }),
    prisma.grade.count(),
  ]);

  return paginatedResult(data, total, pagination);
}

export async function getGradeById(id: number) {
  const grade = await prisma.grade.findUnique({
    where: { idGrado: id },
    include: { _count: { select: { students: true, assignments: true } } },
  });

  if (!grade) {
    throw new AppError(404, "GRADE_NOT_FOUND", "No se encontró el grado");
  }

  return grade;
}

export async function getGradeStudents(id: number, pagination: PaginationParams): Promise<PaginatedResult<Prisma.StudentGetPayload<{ include: { grade: true } }>>> {
  const grade = await prisma.grade.findUnique({ where: { idGrado: id } });
  if (!grade) {
    throw new AppError(404, "GRADE_NOT_FOUND", "No se encontró el grado");
  }

  const where = { idGrado: id };

  const [data, total] = await Promise.all([
    prisma.student.findMany({
      where,
      include: { grade: true },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
    }),
    prisma.student.count({ where }),
  ]);

  return paginatedResult(data, total, pagination);
}

export async function getGradeAssignments(id: number) {
  const grade = await prisma.grade.findUnique({ where: { idGrado: id } });
  if (!grade) {
    throw new AppError(404, "GRADE_NOT_FOUND", "No se encontró el grado");
  }

  return prisma.extracurricularAssignment.findMany({
    where: { idGrado: id },
    include: assignmentInclude,
    orderBy: { createdAt: "asc" },
  });
}
