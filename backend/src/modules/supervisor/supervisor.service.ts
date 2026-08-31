import { Request, Response } from "express";
import * as XLSX from "xlsx";
import prisma from "../../config/prisma";
import type { Prisma } from "@prisma/client";
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

function buildSessionWhere(query: Record<string, string>): Record<string, unknown> {
  const { fecha, disciplina, profesor } = query;
  const where: Record<string, unknown> = { estado: "finalizada" };
  if (disciplina) where.assignment = { codigoDisciplina: disciplina };
  if (profesor) where.idProfesor = profesor;
  const fechaStart = parseDateFilter(fecha);
  if (fechaStart) where.fecha = { gte: fechaStart, lte: dayEnd(fechaStart) };
  return where;
}

export async function getSupervisorSessions(req: Request, res: Response) {
  const pagination = parsePagination(req.query as Record<string, string>);
  const where = buildSessionWhere(req.query as Record<string, string>);

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

export async function getSupervisorFilters(req: Request, res: Response) {
  const [disciplines, assignments, teachers] = await Promise.all([
    prisma.discipline.findMany({
      select: { codigoDisciplina: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.extracurricularAssignment.findMany({
      select: {
        codigoDisciplina: true,
        grade: { select: { nombre: true } },
      },
    }),
    prisma.teacher.findMany({
      where: { estado: "activo" },
      select: { idProfesor: true, nombre: true, apellido: true },
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
    }),
  ]);

  const gradeNamesByCode = new Map<string, Set<string>>();
  for (const a of assignments) {
    const set = gradeNamesByCode.get(a.codigoDisciplina) ?? new Set<string>();
    set.add(a.grade.nombre);
    gradeNamesByCode.set(a.codigoDisciplina, set);
  }

  const disciplinas = disciplines.map((d) => ({
    codigoDisciplina: d.codigoDisciplina,
    nombre: d.nombre,
    grados: [...(gradeNamesByCode.get(d.codigoDisciplina) ?? [])].sort((a, b) => {
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      if (Number.isNaN(na) || Number.isNaN(nb)) return a.localeCompare(b);
      return na - nb;
    }),
  }));

  res.json({ success: true, data: { disciplinas, profesores: teachers } });
}

const ESTADO_ASISTENCIA_LABEL: Record<string, string> = {
  presente: "Presente",
  ausente: "Ausente",
  justificado: "Justificado",
};

const SESSION_INCLUDE = {
  assignment: {
    include: {
      discipline: { select: { codigoDisciplina: true, nombre: true } },
      grade: { select: { idGrado: true, nombre: true } },
    },
  },
  schedule: true,
  teacher: { select: { idProfesor: true, nombre: true, apellido: true } },
  attendances: {
    include: {
      student: {
        select: { codigoEstudiante: true, nombre: true, apellido: true, grupo: true },
      },
    },
    orderBy: [{ student: { apellido: "asc" } }, { student: { nombre: "asc" } }],
  },
} satisfies Prisma.ClassSessionInclude;

const SESSION_ORDER: Prisma.ClassSessionOrderByWithRelationInput[] = [
  { fecha: "desc" },
  { updatedAt: "desc" },
];

type AttendSession = Prisma.ClassSessionGetPayload<{ include: typeof SESSION_INCLUDE }>;
type AttendRecord = AttendSession["attendances"][number];

function dateOnly(d: Date): string {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
}

function attendanceRow(s: AttendSession, a: AttendRecord): Record<string, string> {
  return {
    Fecha: s.fecha.toISOString().slice(0, 10),
    "Día": s.schedule?.diaSemana ?? "",
    "Hora inicio": s.schedule?.horaInicio ?? "",
    "Hora fin": s.schedule?.horaFin ?? "",
    Disciplina: s.assignment.discipline.nombre,
    Grado: s.assignment.grade.nombre,
    Profesor: `${s.teacher.nombre} ${s.teacher.apellido}`,
    "Código": a.student.codigoEstudiante,
    "Nombre del estudiante": a.student.nombre,
    Apellido: a.student.apellido,
    Grupo: a.student.grupo ?? "",
    Estado: ESTADO_ASISTENCIA_LABEL[a.estado] ?? a.estado,
  };
}

function sendWorkbook(res: Response, rows: Record<string, string>[]): void {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Asistencias");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="asistencias.xlsx"');
  res.send(buffer);
}

export async function exportSupervisorAttendance(req: Request, res: Response) {
  const where = buildSessionWhere(req.query as Record<string, string>);

  const sessions = await prisma.classSession.findMany({
    where,
    include: SESSION_INCLUDE,
    orderBy: SESSION_ORDER,
  });

  const rows: Record<string, string>[] = [];
  for (const s of sessions) {
    for (const a of s.attendances) rows.push(attendanceRow(s, a));
  }

  sendWorkbook(res, rows);
}

export async function exportSupervisorSessionAttendance(req: Request, res: Response) {
  const sessionId = param(req, "sessionId");

  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    include: SESSION_INCLUDE,
  });

  if (!session) {
    throw new AppError(404, "SESSION_NOT_FOUND", "Sesión no encontrada");
  }

  const rows = session.attendances.map((a) => attendanceRow(session, a));
  sendWorkbook(res, rows);
}

export async function getSupervisorTeacherSchedules(req: Request, res: Response) {
  const assignments = await prisma.extracurricularAssignment.findMany({
    where: { estado: "activo" },
    include: {
      teacher: { select: { idProfesor: true, nombre: true, apellido: true } },
      discipline: { select: { codigoDisciplina: true, nombre: true } },
      grade: { select: { idGrado: true, nombre: true } },
      schedules: {
        include: {
          schedule: {
            select: { idHorario: true, diaSemana: true, horaInicio: true, horaFin: true, aula: true },
          },
        },
      },
    },
    orderBy: [{ teacher: { apellido: "asc" } }, { teacher: { nombre: "asc" } }, { codigoDisciplina: "asc" }],
  });

  const schedules = assignments
    .map((a) => ({
      idAsignacion: a.idAsignacion,
      esPrincipal: a.esPrincipal,
      teacher: a.teacher,
      discipline: a.discipline,
      grade: a.grade,
      schedules: a.schedules.map((as) => as.schedule),
    }))
    .filter((a) => a.schedules.length > 0);

  res.json({ success: true, data: schedules });
}

export async function getSupervisorAssignmentHistory(req: Request, res: Response) {
  const asignacionId = param(req, "asignacionId");

  const assignment = await prisma.extracurricularAssignment.findUnique({
    where: { idAsignacion: asignacionId },
    include: {
      teacher: { select: { idProfesor: true, nombre: true, apellido: true } },
      discipline: { select: { codigoDisciplina: true, nombre: true } },
      grade: { select: { idGrado: true, nombre: true } },
    },
  });
  if (!assignment) {
    throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Asignación no encontrada");
  }

  const assignmentsSchedules = await prisma.assignmentSchedule.findMany({
    where: { idAsignacion: asignacionId },
    include: {
      schedule: { select: { idHorario: true, diaSemana: true, horaInicio: true, horaFin: true, aula: true } },
    },
  });

  const sessions = await prisma.classSession.findMany({
    where: { idAsignacion: asignacionId },
    include: { attendances: true },
    orderBy: { fecha: "desc" },
  });

  const schedules = assignmentsSchedules.map((as) => ({
    schedule: as.schedule,
    sessions: sessions
      .filter((s) => s.idHorario === as.schedule.idHorario)
      .map((s) => ({
        id: s.id,
        fecha: s.fecha,
        estado: s.estado,
        counts: {
          total: s.attendances.length,
          presente: s.attendances.filter((a) => a.estado === "presente").length,
          ausente: s.attendances.filter((a) => a.estado === "ausente").length,
          justificado: s.attendances.filter((a) => a.estado === "justificado").length,
        },
      })),
  }));

  res.json({
    success: true,
    data: {
      assignment: {
        teacher: assignment.teacher,
        discipline: assignment.discipline,
        grade: assignment.grade,
      },
      schedules,
    },
  });
}

export async function getSupervisorScheduleHistory(req: Request, res: Response) {
  const asignacionId = param(req, "asignacionId");
  const horarioId = param(req, "horarioId");

  const assignment = await prisma.extracurricularAssignment.findUnique({
    where: { idAsignacion: asignacionId },
    include: {
      teacher: { select: { idProfesor: true, nombre: true, apellido: true } },
      discipline: { select: { codigoDisciplina: true, nombre: true } },
      grade: { select: { idGrado: true, nombre: true } },
    },
  });
  if (!assignment) {
    throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Asignación no encontrada");
  }

  const schedule = await prisma.schedule.findUnique({
    where: { idHorario: horarioId },
    select: { idHorario: true, diaSemana: true, horaInicio: true, horaFin: true, aula: true },
  });
  if (!schedule) {
    throw new AppError(404, "SCHEDULE_NOT_FOUND", "Horario no encontrado");
  }

  const sessions = await prisma.classSession.findMany({
    where: { idAsignacion: asignacionId, idHorario: horarioId },
    include: { attendances: true },
    orderBy: { fecha: "desc" },
  });

  res.json({
    success: true,
    data: {
      assignment: {
        teacher: assignment.teacher,
        discipline: assignment.discipline,
        grade: assignment.grade,
      },
      schedule,
      sessions: sessions.map((s) => ({
        id: s.id,
        fecha: s.fecha,
        estado: s.estado,
        counts: {
          total: s.attendances.length,
          presente: s.attendances.filter((a) => a.estado === "presente").length,
          ausente: s.attendances.filter((a) => a.estado === "ausente").length,
          justificado: s.attendances.filter((a) => a.estado === "justificado").length,
        },
      })),
    },
  });
}
