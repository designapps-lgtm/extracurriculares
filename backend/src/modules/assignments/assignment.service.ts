import prisma from "../../config/prisma";
import { AppError } from "../../middlewares/errorHandler";
import { PaginationParams, PaginatedResult, paginatedResult } from "../../utils/pagination";
import { assignmentInclude } from "../../utils/prismaIncludes";
import { AssignmentQuery } from "./assignment.types";
import { Prisma } from "@prisma/client";

export async function getAssignments(query: AssignmentQuery, pagination: PaginationParams): Promise<PaginatedResult<Prisma.ExtracurricularAssignmentGetPayload<{ include: typeof assignmentInclude }>>> {
  const where: Prisma.ExtracurricularAssignmentWhereInput = {};

  if (query.grado) {
    const grade = await prisma.grade.findFirst({ where: { nombre: query.grado } });
    if (grade) {
      where.idGrado = grade.idGrado;
    }
  }

  if (query.disciplina) {
    where.codigoDisciplina = query.disciplina;
  }

  if (query.profesor) {
    where.idProfesor = query.profesor;
  }

  const [data, total] = await Promise.all([
    prisma.extracurricularAssignment.findMany({
      where,
      include: assignmentInclude,
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      orderBy: { createdAt: "asc" },
    }),
    prisma.extracurricularAssignment.count({ where }),
  ]);

  return paginatedResult(data, total, pagination);
}

export async function getAssignmentById(id: string) {
  const assignment = await prisma.extracurricularAssignment.findUnique({
    where: { idAsignacion: id },
    include: assignmentInclude,
  });

  if (!assignment) {
    throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "No se encontró la asignación");
  }

  return assignment;
}
