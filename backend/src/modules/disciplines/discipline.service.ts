import prisma from "../../config/prisma";
import { AppError } from "../../middlewares/errorHandler";
import { PaginationParams, PaginatedResult, paginatedResult } from "../../utils/pagination";
import { DisciplineQuery } from "./discipline.types";
import { Prisma } from "@prisma/client";

const assignmentInclude = {
  teacher: { select: { idProfesor: true, nombre: true, apellido: true } },
  grade: { select: { idGrado: true, nombre: true } },
  schedules: {
    include: {
      schedule: { select: { diaSemana: true, horaInicio: true, horaFin: true, aula: true } },
    },
  },
};

export async function getDisciplines(query: DisciplineQuery, pagination: PaginationParams): Promise<PaginatedResult<unknown>> {
  const where: Prisma.DisciplineWhereInput = {};

  if (query.search) {
    where.OR = [
      { codigoDisciplina: { contains: query.search, mode: "insensitive" } },
      { nombre: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.discipline.findMany({
      where,
      include: {
        _count: { select: { studentSchedules: true, assignments: true } },
      },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      orderBy: { nombre: "asc" },
    }),
    prisma.discipline.count({ where }),
  ]);

  return paginatedResult(data, total, pagination);
}

export async function getDisciplineByCodigo(codigo: string) {
  const discipline = await prisma.discipline.findUnique({
    where: { codigoDisciplina: codigo },
    include: {
      assignments: { include: assignmentInclude },
      _count: { select: { studentSchedules: true } },
    },
  });

  if (!discipline) {
    throw new AppError(404, "DISCIPLINE_NOT_FOUND", "No se encontró la disciplina");
  }

  return discipline;
}

export async function getDisciplineStudents(codigo: string, pagination: PaginationParams): Promise<PaginatedResult<unknown>> {
  const discipline = await prisma.discipline.findUnique({ where: { codigoDisciplina: codigo } });
  if (!discipline) {
    throw new AppError(404, "DISCIPLINE_NOT_FOUND", "No se encontró la disciplina");
  }

  const where: Prisma.StudentWhereInput = {
    studentSchedules: { some: { codigoDisciplina: codigo } },
  };

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

export async function getDisciplineTeachers(codigo: string) {
  const discipline = await prisma.discipline.findUnique({ where: { codigoDisciplina: codigo } });
  if (!discipline) {
    throw new AppError(404, "DISCIPLINE_NOT_FOUND", "No se encontró la disciplina");
  }

  const assignments = await prisma.extracurricularAssignment.findMany({
    where: { codigoDisciplina: codigo },
    include: {
      teacher: { select: { idProfesor: true, nombre: true, apellido: true, correo: true } },
      grade: { select: { idGrado: true, nombre: true } },
      schedules: {
        include: {
          schedule: { select: { diaSemana: true, horaInicio: true, horaFin: true } },
        },
      },
    },
    distinct: ["idProfesor"],
  });

  return assignments;
}
