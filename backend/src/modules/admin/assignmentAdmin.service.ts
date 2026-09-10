import crypto from "crypto";
import { AppError } from "../../middlewares/errorHandler";
import { nowIso, normalizeDayName } from "../../utils/colombiaTime";
import type { PaginationParams } from "../../utils/pagination";
import { normalizeTime } from "../../utils/validators";
import { isoToMysql } from "../../db/dates";
import { query, transaction } from "../../db/mysql";
import {
  createScheduleRow,
  getAssignments as getDomainAssignments,
  type AppSchedule,
} from "../../db/domain";
import { disciplineCodes, loadCoreData } from "../../db/views";
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

interface AssignmentScheduleRow {
  assignment_id: string;
  schedule_id: string;
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
  await transaction(async (conn) => {
    for (const gradeId of gradeIds.sort((a, b) => a - b)) {
      const existing = data.assignments.find((row) => row.teacherId === teacher.id && row.disciplineCode === input.codigoDisciplina && row.gradeId === gradeId);
      if (existing) {
        await updateAssignment(existing.id, { esPrincipal: input.esPrincipal, estado: "activo", schedules: input.schedules });
        createdIds.push(existing.id);
        continue;
      }
      const assignmentId = crypto.randomUUID();
      const timestamp = nowIso();
      await conn.execute(
        `INSERT INTO assignments (id, teacher_id, teacher_email, discipline_code, grade_id, is_primary, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [assignmentId, teacher.id, teacher.email ?? null, input.codigoDisciplina, gradeId, input.esPrincipal === true ? 1 : 0, "activo", isoToMysql(timestamp), isoToMysql(timestamp)],
      );
      if (schedules.length) {
        await conn.execute(
          `INSERT INTO assignment_schedules (assignment_id, schedule_id) VALUES ${schedules.map(() => "(?, ?)").join(", ")}`,
          schedules.flatMap((schedule) => [assignmentId, schedule.id]),
        );
      }
      createdIds.push(assignmentId);
    }
  });
  return assignmentService.getAssignmentById(createdIds[0]);
}

function rawScheduleIds(rows: AssignmentScheduleRow[], assignmentId: string): Set<string> {
  return new Set(rows.filter((row) => row.assignment_id === assignmentId).map((row) => row.schedule_id));
}

export async function updateAssignment(id: string, input: { esPrincipal?: boolean; estado?: string; schedules?: any[] }) {
  const data = await loadCoreData({ fresh: true });
  const current = data.assignments.find((row) => row.id === id);
  if (!current) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "No se encontró la asignación");
  const teacher = data.userById.get(current.teacherId);
  if (!teacher) throw new AppError(400, "INVALID_TEACHER", "Profesor no válido");
  const schedules = await resolveSchedules(input.schedules, current.scheduleIds);
  const desiredIds = new Set(schedules.map((row) => row.id));
  const linkRows = await query<AssignmentScheduleRow[]>("SELECT assignment_id, schedule_id FROM assignment_schedules");
  const existingIds = rawScheduleIds(linkRows, id);

  const removedIds = [...existingIds].filter((scheduleId) => !desiredIds.has(scheduleId));
  const additions = schedules.filter((row) => !existingIds.has(row.id));
  const primary = input.esPrincipal ?? current.primary;
  const status = input.estado ?? current.status;

  await transaction(async (conn) => {
    if (removedIds.length) {
      await conn.execute(
        `DELETE FROM assignment_schedules WHERE assignment_id = ? AND schedule_id IN (${removedIds.map(() => "?").join(", ")})`,
        [id, ...removedIds],
      );
    }
    if (additions.length) {
      await conn.execute(
        `INSERT INTO assignment_schedules (assignment_id, schedule_id) VALUES ${additions.map(() => "(?, ?)").join(", ")}`,
        additions.flatMap((schedule) => [id, schedule.id]),
      );
    }
    const timestamp = nowIso();
    await conn.execute(
      "UPDATE assignments SET is_primary = ?, status = ?, teacher_email = ?, updated_at = ? WHERE id = ?",
      [primary ? 1 : 0, status, teacher.email ?? null, isoToMysql(timestamp), id],
    );
  });
  return assignmentService.getAssignmentById(id);
}

export async function deleteAssignment(id: string) {
  const assignment = (await getDomainAssignments({ fresh: true })).find((row) => row.id === id);
  if (!assignment) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "No se encontró la asignación");
  const sessionPrefix = `${id}__`;
  await transaction(async (conn) => {
    await conn.execute("DELETE FROM attendance WHERE session_id LIKE ?", [`${sessionPrefix}%`]);
    await conn.execute("DELETE FROM stays WHERE assignment_id = ?", [id]);
    await conn.execute("DELETE FROM assignment_schedules WHERE assignment_id = ?", [id]);
    await conn.execute("DELETE FROM assignments WHERE id = ?", [id]);
  });
  return { message: "Asignación eliminada" };
}