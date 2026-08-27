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
      include: { grade: true, studentSchedules: { include: { discipline: true } } },
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

const VALID_DAYS = new Set(["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"]);

export async function updateStudent(codigo: string, data: {
  nombre?: string;
  apellido?: string;
  idGrado?: number;
  grupo?: string;
  correo?: string;
  estado?: string;
  fotoUrl?: string;
  schedules?: { codigoDisciplina: string; diaSemana: string }[];
}) {
  const { nombre, apellido, idGrado, grupo, correo, estado, fotoUrl, schedules } = data;

  await getOr404(prisma.student.findUnique({ where: { codigoEstudiante: codigo } }), "STUDENT_NOT_FOUND", "No se encontró el estudiante");

  // Validate grade exists if provided
  if (idGrado) {
    const grade = await prisma.grade.findUnique({ where: { idGrado } });
    if (!grade) throw new AppError(400, "INVALID_GRADE", "Grado no válido");
  }

  // Validate schedules (discipline per day) if provided
  if (schedules !== undefined) {
    const seenDays = new Set<string>();
    for (const s of schedules) {
      if (!VALID_DAYS.has(s.diaSemana)) {
        throw new AppError(400, "VALIDATION_ERROR", `Día inválido: ${s.diaSemana}`);
      }
      if (seenDays.has(s.diaSemana)) {
        throw new AppError(400, "VALIDATION_ERROR", `Día duplicado: ${s.diaSemana}`);
      }
      seenDays.add(s.diaSemana);
    }

    const codes = [...new Set(schedules.map((s) => s.codigoDisciplina))];
    const disciplines = await prisma.discipline.findMany({
      where: { codigoDisciplina: { in: codes }, estado: "activa" },
      select: { codigoDisciplina: true },
    });
    const activeCodes = new Set(disciplines.map((d) => d.codigoDisciplina));
    for (const code of codes) {
      if (!activeCodes.has(code)) {
        throw new AppError(400, "INVALID_DISCIPLINE", `Disciplina no encontrada o inactiva: ${code}`);
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.student.update({
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
    });

    if (schedules !== undefined) {
      await tx.studentSchedule.deleteMany({ where: { codigoEstudiante: codigo } });
      if (schedules.length > 0) {
        await tx.studentSchedule.createMany({
          data: schedules.map((s) => ({
            codigoEstudiante: codigo,
            codigoDisciplina: s.codigoDisciplina,
            diaSemana: s.diaSemana,
          })),
        });
      }
    }
  });

  return getStudentByCode(codigo);
}