import { Request, Response } from "express";
import prisma from "../../config/prisma";
import { parsePagination } from "../../utils/pagination";
import { param } from "../../utils/reqParams";
import { AppError } from "../../middlewares/errorHandler";

function parseDateFilter(value?: string): Date | undefined {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [, y, m, d] = match;
  return new Date(`${y}-${m}-${d}T00:00:00.000Z`);
}

function dayEnd(date: Date): Date {
  return new Date(date.getTime() + 24 * 60 * 60 * 1000 - 1);
}

export async function getSupervisorSessions(req: Request, res: Response) {
  const pagination = parsePagination(req.query as Record<string, string>);
  const { fecha, disciplina, profesor } = req.query as Record<string, string>;

  const fechaStart = parseDateFilter(fecha);

  const where: Record<string, unknown> = { estado: "finalizada" };
  if (disciplina) where.assignment = { codigoDisciplina: disciplina };
  if (profesor) where.idProfesor = profesor;
  if (fechaStart) where.fecha = { gte: fechaStart, lte: dayEnd(fechaStart) };

  const [data, total] = await Promise.all([
    prisma.classSession.findMany({
      where,
      include: {
        assignment: {
          include: {
            discipline: { select: { codigoDisciplina: true, nombre: true } },
            grade: { select: { idGrado: true, nombre: true } },
          },
        },
        schedule: { select: { idHorario: true, diaSemana: true, horaInicio: true, horaFin: true, aula: true } },
        teacher: { select: { idProfesor: true, nombre: true, apellido: true } },
        attendances: true,
      },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      orderBy: [{ fecha: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.classSession.count({ where }),
  ]);

  const sessions = data.map((s) => ({
    id: s.id,
    fecha: s.fecha,
    estado: s.estado,
    assignment: s.assignment,
    schedule: s.schedule,
    teacher: s.teacher,
    counts: {
      total: s.attendances.length,
      presente: s.attendances.filter((a) => a.estado === "presente").length,
      ausente: s.attendances.filter((a) => a.estado === "ausente").length,
      justificado: s.attendances.filter((a) => a.estado === "justificado").length,
    },
  }));

  const paginated = {
    success: true,
    data: sessions,
    meta: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    },
  };
  res.json(paginated);
}

export async function getSupervisorSessionAttendance(req: Request, res: Response) {
  const sessionId = param(req, "sessionId");

  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    include: {
      assignment: {
        include: {
          discipline: { select: { codigoDisciplina: true, nombre: true } },
          grade: { select: { idGrado: true, nombre: true } },
        },
      },
      schedule: { select: { idHorario: true, diaSemana: true, horaInicio: true, horaFin: true, aula: true } },
      teacher: { select: { idProfesor: true, nombre: true, apellido: true } },
      attendances: {
        include: {
          student: {
            select: { codigoEstudiante: true, nombre: true, apellido: true, grupo: true, idGrado: true },
          },
        },
        orderBy: [{ student: { apellido: "asc" } }, { student: { nombre: "asc" } }],
      },
    },
  });

  if (!session) {
    throw new AppError(404, "SESSION_NOT_FOUND", "Sesión no encontrada");
  }

  res.json({
    success: true,
    data: {
      id: session.id,
      fecha: session.fecha,
      estado: session.estado,
      assignment: session.assignment,
      schedule: session.schedule,
      teacher: session.teacher,
      records: session.attendances.map((a) => ({
        codigoEstudiante: a.codigoEstudiante,
        nombre: a.student.nombre,
        apellido: a.student.apellido,
        grupo: a.student.grupo,
        estado: a.estado,
      })),
    },
  });
}