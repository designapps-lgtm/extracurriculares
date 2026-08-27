import prisma from "../../config/prisma";

export async function listGrades() {
  return prisma.grade.findMany({
    include: { _count: { select: { students: true, assignments: true } } },
    orderBy: { nombre: "asc" },
  });
}