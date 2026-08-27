import prisma from "../../config/prisma";
import { AppError } from "../../middlewares/errorHandler";
import { PaginationParams, PaginatedResult, paginatedResult } from "../../utils/pagination";
import { AssignmentQuery } from "./assignment.types";
import { Prisma } from "@prisma/client";

const assignmentInclude = {
  teacher: { select: { idProfesor: true, nombre: true, apellido: true } },
  discipline: { select: { codigoDisciplina: true, nombre: true } },
  grade: { select: { idGrado: true, nombre: true } },
  schedules: {
    include: {
      schedule: { select: { diaSemana: true, horaInicio: true, horaFin: true, aula: true } },
    },
  },
};

export async function getAssignments(query: AssignmentQuery, pagination: PaginationParams): Promise<PaginatedResult<unknown>> {
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
