import prisma from "../../config/prisma";
import { AppError } from "../../middlewares/errorHandler";
import { getOr404 } from "../../utils/getOr404";
import { PaginationParams, paginatedResult } from "../../utils/pagination";
import { Prisma } from "@prisma/client";

export async function getStudents(query: { search?: string; grado?: string; inscrito?: string }, pagination: PaginationParams) {
  const { search, grado, inscrito } = query;

  const where: Prisma.StudentWhereInput = {};

  if (search) {
    where.OR = [
      { codigoEstudiante: { contains: search, mode: "insensitive" } },
      { nombre: { contains: search, mode: "insensitive" } },
      { apellido: { contains: search, mode: "insensitive" } },
    ];
  }

  if (grado) {
    const grade = await prisma.grade.findFirst({ where: { nombre: grado } });
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
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
    }),
    prisma.student.count({ where }),
  ]);

  return paginatedResult(data, total, pagination);
}

export async function getStudentByCode(codigo: string) {
  return getOr404(
    prisma.student.findUnique({
      where: { codigoEstudiante: codigo },
      include: { grade: true, studentSchedules: { include: { discipline: true } } },
    }),
    "STUDENT_NOT_FOUND",
    "No se encontró el estudiante",
  );
}

export async function updateStudent(codigo: string, data: {
  nombre?: string;
  apellido?: string;
  idGrado?: number;
  grupo?: string;
  correo?: string;
  estado?: string;
  fotoUrl?: string;
}) {
  const { nombre, apellido, idGrado, grupo, correo, estado, fotoUrl } = data;

  await getOr404(prisma.student.findUnique({ where: { codigoEstudiante: codigo } }), "STUDENT_NOT_FOUND", "No se encontró el estudiante");

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

  return updated;
}