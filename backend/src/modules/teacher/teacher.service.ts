import type { Request, Response } from "express";
import { AppError } from "../../middlewares/errorHandler";
import { dayColombia, todayColombia } from "../../utils/colombiaTime";
import { param } from "../../utils/reqParams";
import {
  getAttendanceData,
  getClassRoster,
  resolveAttendanceSession,
  resolveLogicalClass,
  saveAttendance as saveAttendanceRecords,
  sessionState,
  startAttendanceSession,
} from "../attendance/attendance.service";
import { assignmentPayload, loadCoreData, schedulePayload, teacherPayload } from "../appsheet/appsheet.views";

export async function getTeacherClasses(req: Request, res: Response): Promise<void> {
  const teacherId = req.teacher!.teacherId;
  const data = await loadCoreData();
  const teacher = data.users.find((user) => user.id === teacherId && user.role === "teacher");
  if (!teacher) throw new AppError(404, "TEACHER_NOT_FOUND", "Profesor no encontrado");

  const groups = new Map<string, { assignmentId: string; scheduleId: string }>();
  for (const assignment of data.assignments.filter((row) => row.teacherId === teacherId)) {
    for (const scheduleId of assignment.scheduleIds) {
      const key = `${assignment.disciplineCode}|${scheduleId}`;
      if (!groups.has(key)) groups.set(key, { assignmentId: assignment.id, scheduleId });
    }
  }

  const classes = await Promise.all([...groups.values()].map(async ({ assignmentId, scheduleId }) => {
    const context = await resolveLogicalClass(assignmentId, scheduleId);
    const [roster, state] = await Promise.all([getClassRoster(context), sessionState(context.sessionId)]);
    const schedule = context.data.scheduleById.get(scheduleId);
    const hasAttendance = state.records.length > 0;
    const rosterGradeIds = roster.grades.map((row) => row.idGrado);
    const min = Math.min(...rosterGradeIds);
    const max = Math.max(...rosterGradeIds);
    const grades = Array.from({ length: max - min + 1 }, (_, index) => {
      const id = min + index;
      const named = context.data.gradeById.get(id);
      return { idGrado: id, nombre: named?.name ?? String(id) };
    });
    return {
      idAsignacion: context.assignment.id,
      discipline: { codigoDisciplina: context.assignment.disciplineCode, nombre: context.assignment.disciplineCode },
      grade: roster.grades[0] ?? { idGrado: context.assignment.gradeId, nombre: context.data.gradeById.get(context.assignment.gradeId)?.name ?? String(context.assignment.gradeId) },
      grades,
      schedule: schedulePayload(schedule),
      enrolledCount: roster.enrolledCount,
      stayCount: roster.stayCount,
      sessionId: hasAttendance ? context.sessionId : null,
      sessionEstado: hasAttendance ? "finalizada" : null,
      llamadaAt: state.llamadaAt,
      llamadaPorTipo: state.llamadaPorTipo,
      llamadaPorId: state.llamadaPorId,
      callStatus: hasAttendance ? "finalizada" : "no_llamada",
      attendanceCount: state.records.length,
    };
  }));

  res.json({
    success: true,
    data: {
      teacher: teacherPayload(teacher),
      date: todayColombia(),
      dayName: dayColombia(),
      classes,
    },
  });
}

export async function getTeacherAllAssignments(req: Request, res: Response): Promise<void> {
  const data = await loadCoreData();
  const assignments = data.assignments
    .filter((row) => row.teacherId === req.teacher!.teacherId)
    .map((row) => assignmentPayload(row, data));
  res.json({ success: true, data: assignments });
}

export async function startSession(req: Request, res: Response): Promise<void> {
  const teacherId = req.teacher!.teacherId;
  const { idAsignacion, idHorario } = req.body as { idAsignacion?: string; idHorario?: string };
  if (!idAsignacion || !idHorario) throw new AppError(400, "VALIDATION_ERROR", "idAsignacion e idHorario son requeridos");
  const data = await loadCoreData();
  const assignment = data.assignments.find((row) => row.id === idAsignacion);
  if (!assignment || assignment.teacherId !== teacherId || !assignment.scheduleIds.includes(idHorario)) {
    throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Asignación no encontrada");
  }
  const session = await startAttendanceSession(idAsignacion, idHorario, { caller: { type: "teacher", id: teacherId } });
  res.json({ success: true, data: session });
}

async function assertTeacherSessionAccess(teacherId: string, sessionId: string): Promise<void> {
  const context = await resolveAttendanceSession(sessionId);
  const allowed = context.data.assignments.some((assignment) =>
    assignment.teacherId === teacherId
      && assignment.disciplineCode === context.assignment.disciplineCode
      && assignment.scheduleIds.includes(context.scheduleId),
  );
  if (!allowed) throw new AppError(404, "SESSION_NOT_FOUND", "Sesión no encontrada");
}

export async function getAttendanceList(req: Request, res: Response): Promise<void> {
  const sessionId = param(req, "sessionId");
  await assertTeacherSessionAccess(req.teacher!.teacherId, sessionId);
  res.json({ success: true, data: await getAttendanceData(sessionId) });
}

export async function saveAttendance(req: Request, res: Response): Promise<void> {
  const sessionId = param(req, "sessionId");
  const teacherId = req.teacher!.teacherId;
  await assertTeacherSessionAccess(teacherId, sessionId);
  const records = req.body?.records;
  if (!Array.isArray(records)) throw new AppError(400, "VALIDATION_ERROR", "records debe ser un array");
  const result = await saveAttendanceRecords(sessionId, records, {
    allowFinalizedEdit: true,
    caller: { type: "teacher", id: teacherId },
  });
  res.json({ success: true, data: result });
}
