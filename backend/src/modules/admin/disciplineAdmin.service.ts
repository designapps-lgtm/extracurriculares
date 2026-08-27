import prisma from "../../config/prisma";
import { PaginationParams, paginatedResult } from "../../utils/pagination";
import { Prisma } from "@prisma/client";

export async function getDisciplines(query: { search?: string }, pagination: PaginationParams) {
  const { search } = query;

  const where: Prisma.DisciplineWhereInput = {};
  if (search) {
    where.OR = [
      { codigoDisciplina: { contains: search, mode: "insensitive" } },
      { nombre: { contains: search, mode: "insensitive" } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.discipline.findMany({
      where,
      include: { _count: { select: { studentSchedules: true, assignments: true } } },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      orderBy: { nombre: "asc" },
    }),
    prisma.discipline.count({ where }),
  ]);

  return paginatedResult(data, total, pagination);
}