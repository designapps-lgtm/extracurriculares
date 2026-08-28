import prisma from "../../config/prisma";
import { AppError } from "../../middlewares/errorHandler";
import { PaginationParams, PaginatedResult, paginatedResult } from "../../utils/pagination";
import { StudentQuery } from "./student.types";
import { Prisma } from "@prisma/client";

export async function getStudents(query: StudentQuery, pagination: PaginationParams): Promise<PaginatedResult<Prisma.StudentGetPayload<{ include: { grade: true; studentSchedules: { include: { discipline: true } } } }>>> {
  const { search, grado, disciplina, inscrito } = query;

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
    if (grade) {
      where.idGrado = grade.idGrado;
    }
  }

  if (disciplina) {
    // Si viene inscrito=false junto con disciplina, se ignora la disciplina:
    // un estudiante sin inscripciones no puede filtrarse por disciplina.
    if (inscrito !== "false") {
      where.studentSchedules = { some: { codigoDisciplina: disciplina } };
    }
  }

  if (inscrito === "true") {
    where.studentSchedules = disciplina ? where.studentSchedules : { some: {} };
  } else if (inscrito === "false") {
    where.studentSchedules = { none: {} };
  }

  const [data, total] = await Promise.all([
    prisma.student.findMany({
      where,
      include: {
        grade: true,
        studentSchedules: { include: { discipline: true } },
      },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
    }),
    prisma.student.count({ where }),
  ]);

  return paginatedResult(data, total, pagination);
}

export async function getStudentByCode(codigo: string) {
  const student = await prisma.student.findUnique({
    where: { codigoEstudiante: codigo },
    include: {
      grade: true,
      studentSchedules: { include: { discipline: true } },
    },
  });

  if (!student) {
    throw new AppError(404, "STUDENT_NOT_FOUND", "No se encontró el estudiante");
  }

  return student;
}

export async function getStudentProfile(codigo: string) {
  const student = await prisma.student.findUnique({
    where: { codigoEstudiante: codigo },
    include: {
      grade: true,
      studentSchedules: {
        include: {
          discipline: { select: { codigoDisciplina: true, nombre: true } },
        },
        orderBy: { diaSemana: "asc" },
      },
    },
  });

  if (!student) {
    throw new AppError(404, "STUDENT_NOT_FOUND", "No se encontró el estudiante");
  }

  // Enrich each student schedule with offer info (teacher + schedule times)
  const extracurricular = await Promise.all(
    student.studentSchedules.map(async (ss) => {
      // Find the assignment for this discipline + grade combination
      const assignment = await prisma.extracurricularAssignment.findFirst({
        where: {
          codigoDisciplina: ss.codigoDisciplina,
          idGrado: student.idGrado,
        },
        include: {
          teacher: { select: { nombre: true, apellido: true } },
          schedules: {
            include: {
              schedule: { select: { diaSemana: true, horaInicio: true, horaFin: true } },
            },
          },
        },
      });

      // Find the specific schedule for this day
      let offerInfo: { profesor: string; horaInicio: string | null; horaFin: string | null } | null = null;
      if (assignment) {
        const daySchedule = assignment.schedules.find(
          (as) => as.schedule.diaSemana === ss.diaSemana
        );
        if (daySchedule) {
          offerInfo = {
            profesor: `${assignment.teacher.nombre} ${assignment.teacher.apellido}`,
            horaInicio: daySchedule.schedule.horaInicio,
            horaFin: daySchedule.schedule.horaFin,
          };
        }
      }

      return {
        dia: ss.diaSemana,
        disciplina: {
          codigo: ss.discipline.codigoDisciplina,
          nombre: ss.discipline.nombre,
        },
        oferta: offerInfo,
      };
    })
  );

  return {
    student: {
      codigoEstudiante: student.codigoEstudiante,
      nombre: student.nombre,
      apellido: student.apellido,
      grupo: student.grupo,
      grade: student.grade,
      correo: student.correo,
      estado: student.estado,
      fotoUrl: student.fotoUrl,
    },
    extracurricular: extracurricular.length > 0 ? extracurricular : null,
  };
}
