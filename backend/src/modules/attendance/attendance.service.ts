import type { Request, Response } from "express";
import { AppError } from "../../middlewares/errorHandler";
import { dayColombia, nowIso, todayColombia } from "../../utils/colombiaTime";
import { param } from "../../utils/reqParams";
import {
  buildSessionId,
  disciplineName,
  getAssignments,
  getAttendance,
  getStays,
  resolveSessionId,
  upsertAttendanceRows,
  type AppAssignment,
  type AppAttendance,
  type AppStay,
} from "../appsheet/appsheet.domain";
import {
  assignmentPayload,
  loadCoreData,
  schedulePayload,
  teacherPayload,
  type CoreData,
} from "../appsheet/appsheet.views";

const VALID_STATES = new Set(["presente", "ausente", "justificado"]);

export type AttendanceCaller = {
  type: "teacher" | "supervisor" | "admin";
  id: string;
};

type AttendanceRecordInput = { codigoEstudiante?: unknown; estado?: unknown; observacion?: unknown };

export interface LogicalClassContext {
  data: CoreData;
  assignment: AppAssignment;
  logicalAssignments: AppAssignment[];
  scheduleId: string;
  date: string;
  sessionId: string;
}

function canonicalAssignment(rows: AppAssignment[]): AppAssignment {
  return rows.slice().sort((a, b) => Number(b.primary) - Number(a.primary) || a.gradeId - b.gradeId || a.id.localeCompare(b.id))[0];
}

export function logicalAssignmentsFor(data: CoreData, assignment: AppAssignment, scheduleId: string): AppAssignment[] {
  return data.assignments.filter((row) => row.disciplineCode === assignment.disciplineCode && row.scheduleIds.includes(scheduleId));
}

export async function resolveLogicalClass(
  assignmentId: string,
  scheduleId: string,
  date = todayColombia(),
): Promise<LogicalClassContext> {
  const data = await loadCoreData();
  const requested = data.assignments.find((row) => row.id === assignmentId);
  if (!requested) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Asignación de Extracurriculares no encontrada");
  if (!requested.scheduleIds.includes(scheduleId)) {
    throw new AppError(400, "INVALID_SCHEDULE", "El horario no pertenece a esta asignación de Extracurriculares");
  }
  const logicalAssignments = logicalAssignmentsFor(data, requested, scheduleId);
  const assignment = canonicalAssignment(logicalAssignments.length ? logicalAssignments : [requested]);
  return { data, assignment, logicalAssignments, scheduleId, date, sessionId: buildSessionId(assignment.id, scheduleId, date) };
}

export async function resolveAttendanceSession(sessionId: string): Promise<LogicalClassContext> {
  const [data, assignments] = await Promise.all([loadCoreData(), getAssignments()]);
  const resolved = resolveSessionId(sessionId, assignments);
  if (!resolved || resolved.date !== todayColombia()) {
    throw new AppError(404, "SESSION_NOT_FOUND", "Sesión de Asistencia Extracurriculares no encontrada");
  }
  const assignment = data.assignments.find((row) => row.id === resolved.assignment.id);
  if (!assignment || !assignment.scheduleIds.includes(resolved.scheduleId)) {
    throw new AppError(404, "SESSION_NOT_FOUND", "Sesión de Asistencia Extracurriculares no encontrada");
  }
  return {
    data,
    assignment,
    logicalAssignments: logicalAssignmentsFor(data, assignment, resolved.scheduleId),
    scheduleId: resolved.scheduleId,
    date: resolved.date,
    sessionId,
  };
}

function staysForContext(context: LogicalClassContext, stays: AppStay[]): AppStay[] {
  const logicalIds = new Set(context.logicalAssignments.map((row) => row.id));
  return stays.filter((row) => logicalIds.has(row.assignmentId) && row.scheduleId === context.scheduleId && row.date === context.date);
}

export async function getClassRoster(context: LogicalClassContext): Promise<{
  students: Array<{
    codigoEstudiante: string;
    nombre: string;
    apellido: string;
    grupo: string | null;
    fotoUrl: string | null;
    origen: "inscrito" | "quedado";
    gradoNombre: string;
  }>;
  grades: Array<{ idGrado: number; nombre: string }>;
  enrolledCount: number;
  stayCount: number;
}> {
  const schedule = context.data.scheduleById.get(context.scheduleId);
  if (!schedule) throw new AppError(404, "SCHEDULE_NOT_FOUND", "Horario no encontrado");
  const gradeIds = new Set(context.logicalAssignments.map((row) => row.gradeId));
  const enrolledCodes = new Set(
    context.data.enrollments
      .filter((row) => row.disciplineCode === context.assignment.disciplineCode && row.day === schedule.day)
      .map((row) => row.studentCode),
  );
  for (const code of enrolledCodes) {
    const student = context.data.studentByCode.get(code);
    if (student && Number.isFinite(student.gradeId)) gradeIds.add(student.gradeId);
  }
  const stays = staysForContext(context, await getStays());
  const stayCodes = new Set(stays.map((row) => row.studentCode).filter((code) => !enrolledCodes.has(code)));
  const rows: Array<{
    codigoEstudiante: string;
    nombre: string;
    apellido: string;
    grupo: string | null;
    fotoUrl: string | null;
    origen: "inscrito" | "quedado";
    gradoNombre: string;
  }> = [];
  for (const code of [...enrolledCodes, ...stayCodes]) {
    const student = context.data.studentByCode.get(code);
    if (!student) continue;
    rows.push({
      codigoEstudiante: student.code,
      nombre: student.firstName,
      apellido: student.lastName,
      grupo: student.group,
      fotoUrl: student.photoUrl,
      origen: enrolledCodes.has(code) ? "inscrito" : "quedado",
      gradoNombre: context.data.gradeById.get(student.gradeId)?.name ?? student.gradeName,
    });
  }
  rows.sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, "es"));
  return {
    students: rows,
    grades: [...gradeIds].sort((a, b) => a - b).map((id) => ({ idGrado: id, nombre: context.data.gradeById.get(id)?.name ?? String(id) })),
    enrolledCount: enrolledCodes.size,
    stayCount: stayCodes.size,
  };
}

function firstAttendance(records: AppAttendance[]): AppAttendance | undefined {
  return records.slice().sort((a, b) => (a.registeredAt ?? a.createdAt ?? "").localeCompare(b.registeredAt ?? b.createdAt ?? ""))[0];
}

export async function sessionState(sessionId: string): Promise<{
  records: AppAttendance[];
  estado: "en_curso" | "finalizada";
  llamadaAt: string | null;
  llamadaPorTipo: string | null;
  llamadaPorId: string | null;
}> {
  const records = (await getAttendance()).filter((row) => row.sessionId === sessionId);
  const first = firstAttendance(records);
  return {
    records,
    estado: records.length ? "finalizada" : "en_curso",
    llamadaAt: first?.registeredAt ?? first?.createdAt ?? null,
    llamadaPorTipo: first?.registeredByType ?? null,
    llamadaPorId: first?.registeredById ?? null,
  };
}

export async function startAttendanceSession(
  idAsignacion: string,
  idHorario: string,
  options: { onlyToday?: boolean; caller?: AttendanceCaller } = {},
) {
  const context = await resolveLogicalClass(idAsignacion, idHorario);
  const schedule = context.data.scheduleById.get(idHorario);
  if (!schedule) throw new AppError(404, "SCHEDULE_NOT_FOUND", "Horario no encontrado");
  if (options.onlyToday && schedule.day !== dayColombia()) {
    throw new AppError(400, "SCHEDULE_NOT_TODAY", "Solo se puede tomar Asistencia Extracurriculares de una clase programada para hoy");
  }
  const state = await sessionState(context.sessionId);
  const teacher = context.data.userById.get(context.assignment.teacherId);
  return {
    id: context.sessionId,
    idAsignacion: context.assignment.id,
    idHorario,
    idProfesor: teacher?.id ?? context.assignment.teacherId,
    fecha: context.date,
    estado: state.estado,
    llamadaAt: state.llamadaAt ?? nowIso(),
    llamadaPorTipo: state.llamadaPorTipo ?? options.caller?.type ?? null,
    llamadaPorId: state.llamadaPorId ?? options.caller?.id ?? null,
  };
}

export async function getAttendanceData(sessionId: string) {
  const context = await resolveAttendanceSession(sessionId);
  const [roster, state] = await Promise.all([getClassRoster(context), sessionState(sessionId)]);
  const states = new Map(state.records.map((record) => [record.studentCode, record.status]));
  const assignment = assignmentPayload(context.assignment, context.data) as any;
  assignment.grades = roster.grades;
  const schedule = context.data.scheduleById.get(context.scheduleId);
  const teacher = context.data.userById.get(context.assignment.teacherId);
  return {
    session: {
      id: sessionId,
      estado: state.estado,
      fecha: context.date,
      llamadaAt: state.llamadaAt,
      llamadaPorTipo: state.llamadaPorTipo,
      llamadaPorId: state.llamadaPorId,
    },
    assignment,
    teacher: teacherPayload(teacher),
    schedule: schedulePayload(schedule),
    students: roster.students.map((student) => ({ ...student, estado: states.get(student.codigoEstudiante) ?? "pendiente" })),
  };
}

export async function saveAttendance(
  sessionId: string,
  records: AttendanceRecordInput[],
  options: { allowFinalizedEdit?: boolean; caller?: AttendanceCaller } = {},
) {
  const context = await resolveAttendanceSession(sessionId);
  const [roster, state] = await Promise.all([getClassRoster(context), sessionState(sessionId)]);
  if (state.estado === "finalizada" && !options.allowFinalizedEdit) {
    throw new AppError(409, "SESSION_NOT_EDITABLE", "La Asistencia Extracurriculares ya fue finalizada");
  }
  if (roster.students.length === 0) throw new AppError(409, "ROSTER_EMPTY", "No hay estudiantes en el roster de esta clase");
  const allowed = new Set(roster.students.map((row) => row.codigoEstudiante));
  const unique = new Map<string, { status: string; observation: string | null }>();
  for (const record of records) {
    const code = typeof record?.codigoEstudiante === "string" ? record.codigoEstudiante.trim() : "";
    const status = typeof record?.estado === "string" ? record.estado.trim().toLowerCase() : "";
    if (!code) throw new AppError(400, "VALIDATION_ERROR", "Cada registro debe tener un código de estudiante");
    if (!VALID_STATES.has(status)) throw new AppError(400, "VALIDATION_ERROR", "Cada registro debe tener un estado de asistencia válido");
    if (!allowed.has(code)) throw new AppError(400, "INVALID_ROSTER", "La asistencia contiene estudiantes que no pertenecen al roster de la clase");
    unique.set(code, { status, observation: typeof record.observacion === "string" ? record.observacion : null });
  }
  if (unique.size !== roster.students.length) {
    throw new AppError(400, "INCOMPLETE_ROSTER", "Debe marcar la Asistencia Extracurriculares de todos los estudiantes antes de finalizar");
  }
  const caller = options.caller ?? { type: "admin" as const, id: "unknown" };
  await upsertAttendanceRows({
    sessionId,
    callerType: caller.type,
    callerId: caller.id,
    records: [...unique].map(([studentCode, value]) => ({ studentCode, status: value.status, observation: value.observation })),
  });
  return {
    id: sessionId,
    sessionId,
    idAsignacion: context.assignment.id,
    total: unique.size,
    resultado: state.estado === "finalizada" ? "actualizada" : "finalizada",
  };
}

export async function supervisorStartSession(req: Request, res: Response): Promise<void> {
  const { idAsignacion, idHorario } = req.body as { idAsignacion?: string; idHorario?: string };
  if (!idAsignacion || !idHorario) throw new AppError(400, "VALIDATION_ERROR", "idAsignacion e idHorario son requeridos");
  res.json({ success: true, data: await startAttendanceSession(idAsignacion, idHorario, { caller: { type: "supervisor", id: req.supervisor!.supervisorId } }) });
}

export async function adminStartSession(req: Request, res: Response): Promise<void> {
  const { idAsignacion, idHorario } = req.body as { idAsignacion?: string; idHorario?: string };
  if (!idAsignacion || !idHorario) throw new AppError(400, "VALIDATION_ERROR", "idAsignacion e idHorario son requeridos");
  res.json({ success: true, data: await startAttendanceSession(idAsignacion, idHorario, { onlyToday: true, caller: { type: "admin", id: req.admin!.adminId } }) });
}

export async function attendanceList(req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: await getAttendanceData(param(req, "sessionId")) });
}

export async function attendanceSave(req: Request, res: Response): Promise<void> {
  const records = req.body?.records;
  if (!Array.isArray(records)) throw new AppError(400, "VALIDATION_ERROR", "records debe ser un array");
  const caller: AttendanceCaller | undefined = req.teacher
    ? { type: "teacher", id: req.teacher.teacherId }
    : req.supervisor
      ? { type: "supervisor", id: req.supervisor.supervisorId }
      : req.admin
        ? { type: "admin", id: req.admin.adminId }
        : undefined;
  res.json({ success: true, data: await saveAttendance(param(req, "sessionId"), records, { caller }) });
}

export async function adminSaveAttendance(req: Request, res: Response): Promise<void> {
  const records = req.body?.records;
  if (!Array.isArray(records)) throw new AppError(400, "VALIDATION_ERROR", "records debe ser un array");
  res.json({ success: true, data: await saveAttendance(param(req, "sessionId"), records, { allowFinalizedEdit: true, caller: { type: "admin", id: req.admin!.adminId } }) });
}

export async function supervisorSaveAttendance(req: Request, res: Response): Promise<void> {
  const records = req.body?.records;
  if (!Array.isArray(records)) throw new AppError(400, "VALIDATION_ERROR", "records debe ser un array");
  res.json({ success: true, data: await saveAttendance(param(req, "sessionId"), records, { allowFinalizedEdit: true, caller: { type: "supervisor", id: req.supervisor!.supervisorId } }) });
}

export const getSupervisorAttendanceList = attendanceList;
