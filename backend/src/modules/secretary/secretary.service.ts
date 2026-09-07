import type { Request, Response } from "express";
import { param } from "../../utils/reqParams";
import { getClassRoster, resolveLogicalClass } from "../attendance/attendance.service";
import { schedulePayload, teacherPayload } from "../appsheet/appsheet.views";

/** Roster de solo lectura para secretaría; no crea ni modifica asistencia. */
export async function getSecretaryClassStudents(req: Request, res: Response): Promise<void> {
  const context = await resolveLogicalClass(param(req, "asignacionId"), param(req, "horarioId"));
  const roster = await getClassRoster(context);
  const teacher = context.data.userById.get(context.assignment.teacherId);
  res.json({
    success: true,
    data: {
      assignment: {
        idAsignacion: context.assignment.id,
        codigoDisciplina: context.assignment.disciplineCode,
        discipline: { codigoDisciplina: context.assignment.disciplineCode, nombre: context.assignment.disciplineCode },
        grades: roster.grades,
        teacher: teacherPayload(teacher),
      },
      schedule: schedulePayload(context.data.scheduleById.get(context.scheduleId)),
      date: context.date,
      students: roster.students,
    },
  });
}
