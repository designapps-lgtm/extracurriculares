import crypto from "crypto";
import { AppError } from "../../middlewares/errorHandler";
import { nowIso, normalizeDayName } from "../../utils/colombiaTime";
import type { PaginationParams } from "../../utils/pagination";
import { normalizeTime } from "../../utils/validators";
import {
  createScheduleRow,
  getAssignments as getDomainAssignments,
  getAttendance,
  getStays,
  type AppAssignment,
  type AppSchedule,
  type AppUser,
} from "../appsheet/appsheet.domain";
import {
  APPSHEET_TABLES,
  addRows,
  deleteRows,
  editRows,
  getTableRows,
  textCell,
} from "../appsheet/appsheet.repository";
import type { AppSheetRow } from "../appsheet/appsheet.service";
import { assignmentPayload, disciplineCodes, loadCoreData } from "../appsheet/appsheet.views";
import * as assignmentService from "../assignments/assignment.service";

export function getAssignments(query: { disciplina?: string; grado?: string; profesor?: string }, pagination: PaginationParams) {
  return assignmentService.getAssignments(query, pagination);
}

export function getAssignmentById(id: string) {
  return assignmentService.getAssignmentById(id);
}

async function resolveSchedules(input: any[] | undefined, fallback: string[] = []): Promise<AppSchedule[]> {
  if (input === undefined) {
    const data = await loadCoreData();
    return fallback.map((id) => data.scheduleById.get(id)).filter((row): row is AppSchedule => Boolean(row));
  }
  if (!Array.isArray(input) || input.length === 0) throw new AppError(400, "SCHEDULE_REQUIRED", "La asignación debe tener al menos un horario");
  const data = await loadCoreData({ fresh: true });
  const result: AppSchedule[] = [];
  for (const row of input) {
    if (row?.idHorario) {
      const schedule = data.scheduleById.get(String(row.idHorario));
      if (!schedule) throw new AppError(400, "INVALID_SCHEDULE", `Horario no válido: ${row.idHorario}`);
      result.push(schedule);
      continue;
    }
    const day = normalizeDayName(row?.diaSemana);
    const startTime = normalizeTime(row?.horaInicio);
    const endTime = row?.horaFin ? normalizeTime(row.horaFin) : null;
    if (!day || !startTime) throw new AppError(400, "INVALID_SCHEDULE", "Cada horario requiere día y hora de inicio válidos");
    const { schedule } = await createScheduleRow({ day, startTime, endTime, classroom: row?.aula ?? null });
    result.push(schedule);
  }
  return [...new Map(result.map((row) => [row.id, row])).values()];
}

function teacherScheduleRow(input: {
  assignmentId: string;
  schedule: AppSchedule;
  teacher: AppUser;
  disciplineCode: string;
  gradeId: number;
  primary: boolean;
  status: string;
  createdAt?: string | null;
}): AppSheetRow {
  const timestamp = nowIso();
  return {
    HorarioID: `${input.assignmentId}__${input.schedule.id}`,
    UsuarioID: input.teacher.id,
    CorreoProfesor: input.teacher.email,
    CodigoDisciplina: input.disciplineCode,
    IdGrado: input.gradeId,
    EsPrincipal: input.primary ? "Y" : "N",
    DiaSemana: input.schedule.day,
    HoraInicio: input.schedule.startTime ?? "",
    HoraFin: input.schedule.endTime ?? "",
    Aula: input.schedule.classroom ?? "",
    Estado: input.status,
    PuedeVerEstudiantes: input.teacher.permissions.canViewStudents ? "Y" : "N",
    PuedeGestionarNovedades: input.teacher.permissions.canManageNews ? "Y" : "N",
    PuedeGestionarAsistencia: input.teacher.permissions.canManageAttendance ? "Y" : "N",
    PuedeGestionarHorarios: input.teacher.permissions.canManageSchedules ? "Y" : "N",
    PuedeAdministrarUsuarios: input.teacher.permissions.canAdministerUsers ? "Y" : "N",
    CreatedAt: input.createdAt ?? timestamp,
    UpdatedAt: timestamp,
  };
}

async function addAssignmentRows(input: {
  assignmentId: string;
  schedules: AppSchedule[];
  teacher: AppUser;
  disciplineCode: string;
  gradeId: number;
  primary: boolean;
  status: string;
}): Promise<void> {
  await addRows(APPSHEET_TABLES.teacherSchedules, input.schedules.map((schedule) => teacherScheduleRow({ ...input, schedule })));
  await addRows(APPSHEET_TABLES.assignmentSchedules, input.schedules.map((schedule) => ({
    AsignacionHorarioID: crypto.randomUUID(),
    AsignacionID: input.assignmentId,
    HorarioID: schedule.id,
    CreatedAt: nowIso(),
  })));
}

export async function createAssignment(input: {
  codigoDisciplina: string;
  idGrado?: number;
  idGrados?: number[];
  idProfesor: string;
  esPrincipal?: boolean;
  schedules?: any[];
}) {
  if (!input.codigoDisciplina || !input.idProfesor) throw new AppError(400, "VALIDATION_ERROR", "codigoDisciplina e idProfesor son requeridos");
  const data = await loadCoreData({ fresh: true });
  if (!disciplineCodes(data).includes(input.codigoDisciplina)) throw new AppError(400, "INVALID_DISCIPLINE", "Disciplina no válida");
  const teacher = data.users.find((user) => user.id === input.idProfesor && user.role === "teacher");
  if (!teacher) throw new AppError(400, "INVALID_TEACHER", "Profesor no válido");
  if (!teacher.active) throw new AppError(400, "TEACHER_INACTIVE", "El profesor está inactivo");
  let gradeIds = [...new Set((input.idGrados?.length ? input.idGrados : input.idGrado ? [input.idGrado] : []).map(Number).filter(Number.isInteger))];
  if (gradeIds.length === 0) {
    gradeIds = [...new Set(data.enrollments
      .filter((row) => row.disciplineCode === input.codigoDisciplina)
      .map((row) => data.studentByCode.get(row.studentCode)?.gradeId)
      .filter((id): id is number => Boolean(id)))];
  }
  if (gradeIds.length === 0) throw new AppError(400, "NO_GRADES", "La disciplina no tiene grados asociados");
  if (gradeIds.some((id) => !data.gradeById.has(id))) throw new AppError(400, "INVALID_GRADE", "Uno o más grados no son válidos");
  const schedules = await resolveSchedules(input.schedules);
  const createdIds: string[] = [];
  for (const gradeId of gradeIds.sort((a, b) => a - b)) {
    const existing = data.assignments.find((row) => row.teacherId === teacher.id && row.disciplineCode === input.codigoDisciplina && row.gradeId === gradeId);
    if (existing) {
      await updateAssignment(existing.id, { esPrincipal: input.esPrincipal, estado: "activo", schedules: input.schedules });
      createdIds.push(existing.id);
      continue;
    }
    const assignmentId = crypto.randomUUID();
    await addAssignmentRows({ assignmentId, schedules, teacher, disciplineCode: input.codigoDisciplina, gradeId, primary: input.esPrincipal === true, status: "activo" });
    createdIds.push(assignmentId);
  }
  return assignmentService.getAssignmentById(createdIds[0]);
}

function rawRowsForAssignment(rows: AppSheetRow[], assignmentId: string): AppSheetRow[] {
  return rows.filter((row) => textCell(row, "HorarioID").startsWith(`${assignmentId}__`));
}

export async function updateAssignment(id: string, input: { esPrincipal?: boolean; estado?: string; schedules?: any[] }) {
  const data = await loadCoreData({ fresh: true });
  const current = data.assignments.find((row) => row.id === id);
  if (!current) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "No se encontró la asignación");
  const teacher = data.userById.get(current.teacherId);
  if (!teacher) throw new AppError(400, "INVALID_TEACHER", "Profesor no válido");
  const schedules = await resolveSchedules(input.schedules, current.scheduleIds);
  const desiredIds = new Set(schedules.map((row) => row.id));
  const [teacherRows, linkRows] = await Promise.all([
    getTableRows(APPSHEET_TABLES.teacherSchedules, { fresh: true }),
    getTableRows(APPSHEET_TABLES.assignmentSchedules, { fresh: true }),
  ]);
  const existingTeacherRows = rawRowsForAssignment(teacherRows, id);
  const existingBySchedule = new Map(existingTeacherRows.map((row) => {
    const key = textCell(row, "HorarioID");
    return [key.slice(`${id}__`.length), row];
  }));
  const removedTeacher = [...existingBySchedule].filter(([scheduleId]) => !desiredIds.has(scheduleId)).map(([, row]) => ({ HorarioID: textCell(row, "HorarioID") }));
  if (removedTeacher.length) await deleteRows(APPSHEET_TABLES.teacherSchedules, removedTeacher);
  const links = linkRows.filter((row) => textCell(row, "AsignacionID") === id);
  const removedLinks = links.filter((row) => !desiredIds.has(textCell(row, "HorarioID"))).map((row) => ({ AsignacionHorarioID: textCell(row, "AsignacionHorarioID") }));
  if (removedLinks.length) await deleteRows(APPSHEET_TABLES.assignmentSchedules, removedLinks);

  const primary = input.esPrincipal ?? current.primary;
  const status = input.estado ?? current.status;
  const existingSchedules = schedules.filter((row) => existingBySchedule.has(row.id));
  if (existingSchedules.length) {
    await editRows(APPSHEET_TABLES.teacherSchedules, existingSchedules.map((schedule) => teacherScheduleRow({
      assignmentId: id,
      schedule,
      teacher,
      disciplineCode: current.disciplineCode,
      gradeId: current.gradeId,
      primary,
      status,
      createdAt: current.createdAt,
    })));
  }
  const additions = schedules.filter((row) => !existingBySchedule.has(row.id));
  if (additions.length) await addAssignmentRows({
    assignmentId: id,
    schedules: additions,
    teacher,
    disciplineCode: current.disciplineCode,
    gradeId: current.gradeId,
    primary,
    status,
  });
  return assignmentService.getAssignmentById(id);
}

export async function deleteAssignment(id: string) {
  const assignment = (await getDomainAssignments({ fresh: true })).find((row) => row.id === id);
  if (!assignment) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "No se encontró la asignación");
  const [teacherRows, linkRows, attendance, stays] = await Promise.all([
    getTableRows(APPSHEET_TABLES.teacherSchedules, { fresh: true }),
    getTableRows(APPSHEET_TABLES.assignmentSchedules, { fresh: true }),
    getAttendance({ fresh: true }),
    getStays({ fresh: true }),
  ]);
  const teacherKeys = rawRowsForAssignment(teacherRows, id).map((row) => ({ HorarioID: textCell(row, "HorarioID") }));
  const linkKeys = linkRows.filter((row) => textCell(row, "AsignacionID") === id).map((row) => ({ AsignacionHorarioID: textCell(row, "AsignacionHorarioID") }));
  const attendanceKeys = attendance.filter((row) => row.sessionId.startsWith(`${id}__`)).map((row) => ({ AsistenciaID: row.id }));
  const stayKeys = stays.filter((row) => row.assignmentId === id).map((row) => ({ PermanenciaID: row.id }));
  if (attendanceKeys.length) await deleteRows(APPSHEET_TABLES.attendance, attendanceKeys);
  if (stayKeys.length) await deleteRows(APPSHEET_TABLES.stays, stayKeys);
  if (linkKeys.length) await deleteRows(APPSHEET_TABLES.assignmentSchedules, linkKeys);
  if (teacherKeys.length) await deleteRows(APPSHEET_TABLES.teacherSchedules, teacherKeys);
  return { message: "Asignación eliminada" };
}
