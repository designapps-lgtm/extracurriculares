import { Request, Response } from "express";
import prisma from "../../config/prisma";
import { AppError } from "../../middlewares/errorHandler";
import { param } from "../../utils/reqParams";

function nowColombia() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "0";
  return new Date(`${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`);
}

const DIA_MAP_COL: Record<string, string> = {
  0: "DOMINGO", 1: "LUNES", 2: "MARTES", 3: "MIERCOLES",
  4: "JUEVES", 5: "VIERNES", 6: "SABADO",
};

export async function getTeacherClasses(req: Request, res: Response) {
  const teacherId = req.teacher!.teacherId;
  const today = nowColombia();
  const todayStr = today.toISOString().split("T")[0];

  const assignments = await prisma.extracurricularAssignment.findMany({
    where: { idProfesor: teacherId, estado: "activo" },
    include: {
      discipline: { select: { codigoDisciplina: true, nombre: true } },
      grade: { select: { idGrado: true, nombre: true } },
      schedules: { include: { schedule: true } },
    },
  });

  const classesWithStats = await Promise.all(
    assignments.flatMap((a) =>
      a.schedules.map(async (as) => {
        const enrolledCount = await prisma.studentSchedule.count({
          where: { codigoDisciplina: a.codigoDisciplina, diaSemana: as.schedule.diaSemana },
        });

        const session = await prisma.classSession.findUnique({
          where: { idAsignacion_idHorario_fecha: { idAsignacion: a.idAsignacion, idHorario: as.schedule.idHorario, fecha: today } },
          include: { attendances: true },
        });

        return {
          idAsignacion: a.idAsignacion,
          discipline: a.discipline,
          grade: a.grade,
          schedule: as.schedule,
          enrolledCount,
          sessionId: session?.id || null,
          sessionEstado: session?.estado || null,
          attendanceCount: session?.attendances.length || 0,
        };
      })
    )
  );

  const teacherProfile = await prisma.teacher.findUnique({
    where: { idProfesor: teacherId },
    select: { idProfesor: true, nombre: true, apellido: true },
  });

  res.json({
    success: true,
    data: {
      teacher: teacherProfile,
      date: todayStr,
      dayName: DIA_MAP_COL[today.getDay()],
      classes: classesWithStats,
    },
  });
}

export async function getTeacherAllAssignments(req: Request, res: Response) {
  const teacherId = req.teacher!.teacherId;

  const assignments = await prisma.extracurricularAssignment.findMany({
    where: { idProfesor: teacherId, estado: "activo" },
    include: {
      discipline: { select: { codigoDisciplina: true, nombre: true } },
      grade: { select: { idGrado: true, nombre: true } },
      schedules: { include: { schedule: true } },
    },
  });

  res.json({ success: true, data: assignments });
}

export async function startSession(req: Request, res: Response) {
  const teacherId = req.teacher!.teacherId;
  const { idAsignacion, idHorario } = req.body;

  if (!idAsignacion || !idHorario) {
    throw new AppError(400, "VALIDATION_ERROR", "idAsignacion e idHorario son requeridos");
  }

  const assignment = await prisma.extracurricularAssignment.findUnique({
    where: { idAsignacion },
    include: { schedules: { where: { idHorario } } },
  });

  if (!assignment || assignment.idProfesor !== teacherId) {
    throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Asignación no encontrada");
  }

  if (assignment.schedules.length === 0) {
    throw new AppError(400, "INVALID_SCHEDULE", "El horario no pertenece a esta asignación");
  }

  const today = nowColombia();

  let session = await prisma.classSession.findUnique({
    where: { idAsignacion_idHorario_fecha: { idAsignacion, idHorario, fecha: today } },
  });

  if (!session) {
    session = await prisma.classSession.create({
      data: { idAsignacion, idHorario, idProfesor: teacherId, fecha: today, estado: "en_curso" },
    });
  } else if (session.estado === "programada") {
    session = await prisma.classSession.update({
      where: { id: session.id },
      data: { estado: "en_curso" },
    });
  }

  res.json({ success: true, data: session });
}

export async function getAttendanceList(req: Request, res: Response) {
  const teacherId = req.teacher!.teacherId;
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
      schedule: true,
    },
  });

  if (!session || session.idProfesor !== teacherId) {
    throw new AppError(404, "SESSION_NOT_FOUND", "Sesión no encontrada");
  }

  const enrolledStudents = await prisma.studentSchedule.findMany({
    where: { codigoDisciplina: session.assignment.codigoDisciplina, diaSemana: session.schedule.diaSemana },
    include: {
      student: {
        select: { codigoEstudiante: true, nombre: true, apellido: true, grupo: true },
      },
    },
  });

  const existingAttendance = await prisma.attendanceRecord.findMany({
    where: { sessionId },
  });

  const attendanceMap = new Map(existingAttendance.map((a) => [a.codigoEstudiante, a.estado]));

  const students = enrolledStudents.map((es) => ({
    ...es.student,
    estado: attendanceMap.get(es.codigoEstudiante) || "pendiente",
  }));

  res.json({
    success: true,
    data: {
      session: { id: session.id, estado: session.estado, fecha: session.fecha },
      assignment: session.assignment,
      schedule: session.schedule,
      students,
    },
  });
}

export async function saveAttendance(req: Request, res: Response) {
  const teacherId = req.teacher!.teacherId;
  const sessionId = param(req, "sessionId");
  const { records } = req.body;

  if (!records || !Array.isArray(records)) {
    throw new AppError(400, "VALIDATION_ERROR", "records debe ser un array");
  }

  const session = await prisma.classSession.findUnique({ where: { id: sessionId } });
  if (!session || session.idProfesor !== teacherId) {
    throw new AppError(404, "SESSION_NOT_FOUND", "Sesión no encontrada");
  }

  await prisma.attendanceRecord.deleteMany({ where: { sessionId } });

  const validRecords = records.filter((r: any) => r.estado === "presente" || r.estado === "ausente" || r.estado === "justificado");

  if (validRecords.length > 0) {
    await prisma.attendanceRecord.createMany({
      data: validRecords.map((r: any) => ({
        sessionId,
        codigoEstudiante: r.codigoEstudiante,
        estado: r.estado,
      })),
    });
  }

  await prisma.classSession.update({
    where: { id: sessionId },
    data: { estado: "finalizada" },
  });

  res.json({ success: true, data: { message: "Asistencia guardada", total: validRecords.length } });
}
