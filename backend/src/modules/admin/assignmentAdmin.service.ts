import { Request, Response } from "express";
import prisma from "../../config/prisma";
import { AppError } from "../../middlewares/errorHandler";
import { Prisma } from "@prisma/client";

export async function getAssignments(req: Request, res: Response) {
  const page = parseInt((req.query.page as string) || "1");
  const limit = Math.min(parseInt((req.query.limit as string) || "20"), 100);
  const { disciplina, grado, profesor } = req.query;

  const where: Prisma.ExtracurricularAssignmentWhereInput = {};
  if (disciplina) where.codigoDisciplina = disciplina as string;
  if (grado) {
    const grade = await prisma.grade.findFirst({ where: { nombre: grado as string } });
    if (grade) where.idGrado = grade.idGrado;
  }
  if (profesor) where.idProfesor = profesor as string;

  const [data, total] = await Promise.all([
    prisma.extracurricularAssignment.findMany({
      where,
      include: {
        teacher: { select: { idProfesor: true, nombre: true, apellido: true } },
        discipline: { select: { codigoDisciplina: true, nombre: true } },
        grade: { select: { idGrado: true, nombre: true } },
        schedules: { include: { schedule: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "asc" },
    }),
    prisma.extracurricularAssignment.count({ where }),
  ]);

  res.json({
    success: true,
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function getAssignmentById(req: Request, res: Response) {
  const assignment = await prisma.extracurricularAssignment.findUnique({
    where: { idAsignacion: req.params.id },
    include: {
      teacher: true,
      discipline: true,
      grade: true,
      schedules: { include: { schedule: true } },
    },
  });

  if (!assignment) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "No se encontró la asignación");
  res.json({ success: true, data: assignment });
}

export async function createAssignment(req: Request, res: Response) {
  const { codigoDisciplina, idGrado, idProfesor, esPrincipal, schedules } = req.body;

  // Validate required fields
  if (!codigoDisciplina || !idGrado || !idProfesor) {
    throw new AppError(400, "VALIDATION_ERROR", "codigoDisciplina, idGrado e idProfesor son requeridos");
  }

  // Validate discipline exists
  const discipline = await prisma.discipline.findUnique({ where: { codigoDisciplina } });
  if (!discipline) throw new AppError(400, "INVALID_DISCIPLINE", "Disciplina no válida");

  // Validate grade exists
  const grade = await prisma.grade.findUnique({ where: { idGrado } });
  if (!grade) throw new AppError(400, "INVALID_GRADE", "Grado no válido");

  // Validate teacher exists and is active
  const teacher = await prisma.teacher.findUnique({ where: { idProfesor } });
  if (!teacher) throw new AppError(400, "INVALID_TEACHER", "Profesor no válido");
  if (teacher.estado !== "activo") throw new AppError(400, "TEACHER_INACTIVE", "El profesor está inactivo");

  // Check duplicate
  const existing = await prisma.extracurricularAssignment.findUnique({
    where: { idProfesor_codigoDisciplina_idGrado: { idProfesor, codigoDisciplina, idGrado } },
  });
  if (existing) throw new AppError(409, "DUPLICATE_ASSIGNMENT", "Ya existe esta asignación");

  // Resolve schedules: each entry may be { idHorario } (existing) or {} with diaSemana/horaInicio/horaFin (create/find)
  const scheduleLinks = await resolveScheduleLinks(schedules);

  // Create assignment with schedules
  const assignment = await prisma.extracurricularAssignment.create({
    data: {
      idProfesor,
      codigoDisciplina,
      idGrado,
      esPrincipal: esPrincipal || false,
      schedules: scheduleLinks.length > 0 ? {
        create: scheduleLinks,
      } : undefined,
    },
    include: {
      teacher: true,
      discipline: true,
      grade: true,
      schedules: { include: { schedule: true } },
    },
  });

  res.status(201).json({ success: true, data: assignment });
}

async function resolveScheduleLinks(schedules: any): Promise<{ idHorario: string }[]> {
  if (!schedules || !Array.isArray(schedules) || schedules.length === 0) return [];

  const DIAS_VALIDOS = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"];

  const links: { idHorario: string }[] = [];
  for (const s of schedules) {
    // Existing schedule by id
    if (s.idHorario) {
      const schedule = await prisma.schedule.findUnique({ where: { idHorario: s.idHorario } });
      if (!schedule) throw new AppError(400, "INVALID_SCHEDULE", `Horario no válido: ${s.idHorario}`);
      links.push({ idHorario: s.idHorario });
      continue;
    }

    // New schedule: diaSemana + horaInicio + horaFin (+ aula)
    const { diaSemana, horaInicio, horaFin, aula } = s;
    if (!diaSemana || !DIAS_VALIDOS.includes(diaSemana)) {
      throw new AppError(400, "INVALID_DAY", `Día inválido. Use uno de: ${DIAS_VALIDOS.join(", ")}`);
    }

    const normalizeTime = (value: any): string | null => {
      if (value === null || value === undefined || value === "") return null;
      const t = String(value).trim();
      const m = t.match(/^(\d{1,2}):(\d{2})$/);
      if (!m) throw new AppError(400, "INVALID_TIME", `Hora inválida: '${t}'. Use formato HH:mm`);
      return `${String(parseInt(m[1], 10)).padStart(2, "0")}:${String(parseInt(m[2], 10)).padStart(2, "0")}`;
    };

    const hi = normalizeTime(horaInicio);
    const hf = normalizeTime(horaFin);

    // Find-or-create (same day + time pattern → same schedule)
    const existing = await prisma.schedule.findFirst({ where: { diaSemana, horaInicio: hi, horaFin: hf } });
    if (existing) {
      links.push({ idHorario: existing.idHorario });
    } else {
      const created = await prisma.schedule.create({ data: { diaSemana, horaInicio: hi, horaFin: hf, aula } });
      links.push({ idHorario: created.idHorario });
    }
  }

  return links;
}

export async function updateAssignment(req: Request, res: Response) {
  const { id } = req.params;
  const { esPrincipal, estado, schedules } = req.body;

  const assignment = await prisma.extracurricularAssignment.findUnique({ where: { idAsignacion: id } });
  if (!assignment) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "No se encontró la asignación");

  // Update assignment fields
  const updated = await prisma.extracurricularAssignment.update({
    where: { idAsignacion: id },
    data: {
      ...(esPrincipal !== undefined && { esPrincipal }),
      ...(estado !== undefined && { estado }),
    },
    include: {
      teacher: true,
      discipline: true,
      grade: true,
      schedules: { include: { schedule: true } },
    },
  });

  // Update schedules if provided
  if (schedules) {
    const linkData = await resolveScheduleLinks(schedules);
    // Remove existing links
    await prisma.assignmentSchedule.deleteMany({ where: { idAsignacion: id } });
    // Create new links
    if (linkData.length > 0) {
      await prisma.assignmentSchedule.createMany({
        data: linkData.map((l) => ({ idAsignacion: id, idHorario: l.idHorario })),
      });
    }
  }

  // Fetch updated assignment
  const result = await prisma.extracurricularAssignment.findUnique({
    where: { idAsignacion: id },
    include: {
      teacher: true,
      discipline: true,
      grade: true,
      schedules: { include: { schedule: true } },
    },
  });

  res.json({ success: true, data: result });
}

export async function deleteAssignment(req: Request, res: Response) {
  const { id } = req.params;

  const assignment = await prisma.extracurricularAssignment.findUnique({
    where: { idAsignacion: id },
  });

  if (!assignment) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "No se encontró la asignación");

  // Check if students are enrolled in this discipline
  const enrolledCount = await prisma.studentSchedule.count({
    where: { codigoDisciplina: assignment.codigoDisciplina },
  });

  if (enrolledCount > 0) {
    // Soft delete
    await prisma.extracurricularAssignment.update({
      where: { idAsignacion: id },
      data: { estado: "inactivo" },
    });
    res.json({ success: true, data: { message: "Asignación desactivada (tiene estudiantes inscritos)" } });
  } else {
    // Hard delete
    await prisma.extracurricularAssignment.delete({ where: { idAsignacion: id } });
    res.json({ success: true, data: { message: "Asignación eliminada" } });
  }
}
