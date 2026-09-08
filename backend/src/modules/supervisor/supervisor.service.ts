import type { Request, Response } from "express";
import * as XLSX from "xlsx";
import { AppError } from "../../middlewares/errorHandler";
import { dayColombia, normalizeDateOnly, todayColombia } from "../../utils/colombiaTime";
import { parsePagination, paginatedResult } from "../../utils/pagination";
import { param } from "../../utils/reqParams";
import {
  createStay,
  getAttendance,
  getStays,
  removeStay,
  resolveSessionId,
  type AppAttendance,
} from "../appsheet/appsheet.domain";
import {
  assignmentPayload,
  disciplineCodes,
  disciplinePayload,
  gradePayload,
  loadCoreData,
  matchesTokens,
  schedulePayload,
  teacherPayload,
  type CoreData,
} from "../appsheet/appsheet.views";
import { getClassRoster, resolveLogicalClass, sessionState } from "../attendance/attendance.service";

interface SessionView {
  id: string;
  date: string;
  assignmentId: string;
  scheduleId: string;
  records: AppAttendance[];
}

function counts(records: AppAttendance[]) {
  return {
    total: records.length,
    presente: records.filter((row) => row.status === "presente").length,
    ausente: records.filter((row) => row.status === "ausente").length,
    justificado: records.filter((row) => row.status === "justificado").length,
  };
}

async function sessionViews(data: CoreData): Promise<SessionView[]> {
  const grouped = new Map<string, AppAttendance[]>();
  for (const row of await getAttendance()) {
    const list = grouped.get(row.sessionId) ?? [];
    list.push(row);
    grouped.set(row.sessionId, list);
  }
  const result: SessionView[] = [];
  for (const [id, records] of grouped) {
    const resolved = resolveSessionId(id, data.assignments);
    if (!resolved) continue;
    result.push({ id, date: resolved.date, assignmentId: resolved.assignment.id, scheduleId: resolved.scheduleId, records });
  }
  return result;
}

function shapeSession(view: SessionView, data: CoreData) {
  const assignment = data.assignments.find((row) => row.id === view.assignmentId)!;
  const shaped = assignmentPayload(assignment, data) as any;
  return {
    id: view.id,
    idAsignacion: assignment.id,
    idHorario: view.scheduleId,
    fecha: view.date,
    estado: "finalizada",
    assignment: shaped,
    schedule: schedulePayload(data.scheduleById.get(view.scheduleId)),
    teacher: teacherPayload(data.userById.get(assignment.teacherId)),
    counts: counts(view.records),
  };
}

function filterSessions(views: SessionView[], data: CoreData, query: Record<string, string>): SessionView[] {
  return views.filter((view) => {
    if (view.date !== todayColombia()) return false;
    const assignment = data.assignments.find((row) => row.id === view.assignmentId);
    if (!assignment) return false;
    const logical = data.assignments.filter((row) => row.disciplineCode === assignment.disciplineCode && row.scheduleIds.includes(view.scheduleId));
    if (query.disciplina && assignment.disciplineCode !== query.disciplina) return false;
    if (query.profesor && !logical.some((row) => row.teacherId === query.profesor)) return false;
    if (query.grado && !logical.some((row) => data.gradeById.get(row.gradeId)?.name === query.grado)) return false;
    return true;
  });
}

export async function getSupervisorSessions(req: Request, res: Response): Promise<void> {
  const pagination = parsePagination(req.query as Record<string, string>);
  const data = await loadCoreData();
  const rows = filterSessions(await sessionViews(data), data, req.query as Record<string, string>)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  res.json({ success: true, ...paginatedResult(rows.slice((pagination.page - 1) * pagination.limit, pagination.page * pagination.limit).map((row) => shapeSession(row, data)), rows.length, pagination) });
}

export async function getSupervisorSessionAttendance(req: Request, res: Response): Promise<void> {
  const sessionId = param(req, "sessionId");
  const data = await loadCoreData();
  const view = (await sessionViews(data)).find((row) => row.id === sessionId && row.date === todayColombia());
  if (!view) throw new AppError(404, "SESSION_NOT_FOUND", "Sesión no encontrada");
  const shaped = shapeSession(view, data);
  const records = view.records
    .map((row) => {
      const student = data.studentByCode.get(row.studentCode);
      return {
        codigoEstudiante: row.studentCode,
        nombre: student?.firstName ?? "",
        apellido: student?.lastName ?? "",
        grupo: student?.group ?? null,
        fotoUrl: student?.photoUrl ?? null,
        estado: row.status,
      };
    })
    .sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, "es"));
  res.json({ success: true, data: { ...shaped, records } });
}

export async function getSupervisorFilters(_req: Request, res: Response): Promise<void> {
  const data = await loadCoreData();
  const disciplinas = disciplineCodes(data).map((code) => ({
    codigoDisciplina: code,
    nombre: code,
    grados: [...new Set(data.assignments.filter((row) => row.disciplineCode === code).map((row) => data.gradeById.get(row.gradeId)?.name).filter((name): name is string => Boolean(name)))],
  }));
  const profesores = data.users
    .filter((user) => user.role === "teacher" && user.active)
    .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "es"))
    .map((user) => ({ idProfesor: user.id, nombre: user.firstName, apellido: user.lastName }));
  const grados = data.grades.slice().sort((a, b) => a.id - b.id).map((row) => row.name);
  res.json({ success: true, data: { disciplinas, profesores, grados } });
}

const STATE_LABEL: Record<string, string> = { presente: "Presente", ausente: "Ausente", justificado: "Justificado" };

function workbookRows(views: SessionView[], data: CoreData): Array<Record<string, string>> {
  const rows: Array<Record<string, string>> = [];
  for (const view of views) {
    const assignment = data.assignments.find((row) => row.id === view.assignmentId);
    const schedule = data.scheduleById.get(view.scheduleId);
    const teacher = assignment ? data.userById.get(assignment.teacherId) : undefined;
    for (const record of view.records) {
      const student = data.studentByCode.get(record.studentCode);
      rows.push({
        Fecha: view.date,
        "Día": schedule?.day ?? "",
        "Hora inicio": schedule?.startTime ?? "",
        "Hora fin": schedule?.endTime ?? "",
        Disciplina: assignment?.disciplineCode ?? "",
        Grado: student ? (data.gradeById.get(student.gradeId)?.name ?? student.gradeName) : "",
        Profesor: [teacher?.firstName, teacher?.lastName].filter(Boolean).join(" "),
        "Código": record.studentCode,
        "Nombre del estudiante": student?.firstName ?? "",
        Apellido: student?.lastName ?? "",
        Grupo: student?.group ?? "",
        Estado: STATE_LABEL[record.status] ?? record.status,
      });
    }
  }
  return rows;
}

function sendWorkbook(res: Response, rows: Array<Record<string, string>>): void {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Asistencias");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="asistencias.xlsx"');
  res.send(buffer);
}

export async function exportSupervisorAttendance(req: Request, res: Response): Promise<void> {
  const data = await loadCoreData();
  const views = filterSessions(await sessionViews(data), data, req.query as Record<string, string>);
  sendWorkbook(res, workbookRows(views, data));
}

export async function exportSupervisorSessionAttendance(req: Request, res: Response): Promise<void> {
  const data = await loadCoreData();
  const view = (await sessionViews(data)).find((row) => row.id === param(req, "sessionId") && row.date === todayColombia());
  if (!view) throw new AppError(404, "SESSION_NOT_FOUND", "Sesión no encontrada");
  sendWorkbook(res, workbookRows([view], data));
}

function callerInfo(data: CoreData, type: string | null, id: string | null) {
  if (!type || !id) return null;
  const user = data.userById.get(id);
  return {
    type: ["teacher", "supervisor", "admin"].includes(type) ? type : "historico",
    id: user ? id : null,
    nombre: user?.firstName ?? "Usuario no disponible",
    apellido: user?.lastName ?? "",
  };
}

export async function getSupervisorClasses(_req: Request, res: Response): Promise<void> {
  const data = await loadCoreData();
  const today = todayColombia();
  const todayDay = dayColombia();
  const groups = new Map<string, { assignmentId: string; scheduleId: string; teacherId: string }>();
  for (const assignment of data.assignments) {
    for (const scheduleId of assignment.scheduleIds) {
      const schedule = data.scheduleById.get(scheduleId);
      if (!schedule || schedule.day !== todayDay) continue;
      const key = `${assignment.disciplineCode}|${assignment.teacherId}|${scheduleId}`;
      const current = groups.get(key);
      if (!current || assignment.primary || assignment.gradeId < (data.assignments.find((row) => row.id === current.assignmentId)?.gradeId ?? Infinity)) {
        groups.set(key, { assignmentId: assignment.id, scheduleId, teacherId: assignment.teacherId });
      }
    }
  }
  const classes = await Promise.all([...groups.values()].map(async (group) => {
    const context = await resolveLogicalClass(group.assignmentId, group.scheduleId, today);
    const [roster, state] = await Promise.all([getClassRoster(context), sessionState(context.sessionId)]);
    const representative = data.assignments.find((row) => row.id === group.assignmentId)!;
    const teacher = data.userById.get(group.teacherId);
    const hasAttendance = state.records.length > 0;
    return {
      idAsignacion: representative.id,
      discipline: { codigoDisciplina: representative.disciplineCode, nombre: representative.disciplineCode },
      grade: roster.grades[0] ?? { idGrado: representative.gradeId, nombre: data.gradeById.get(representative.gradeId)?.name ?? String(representative.gradeId) },
      grades: roster.grades,
      teacher: teacherPayload(teacher),
      schedule: schedulePayload(data.scheduleById.get(group.scheduleId)),
      isToday: true,
      enrolledCount: roster.enrolledCount,
      stayCount: roster.stayCount,
      sessionId: hasAttendance ? context.sessionId : null,
      sessionEstado: hasAttendance ? "finalizada" : null,
      llamadaAt: state.llamadaAt,
      llamadaPorTipo: state.llamadaPorTipo,
      llamadaPorId: state.llamadaPorId,
      calledBy: callerInfo(data, state.llamadaPorTipo, state.llamadaPorId),
      callStatus: hasAttendance ? "finalizada" : "no_llamada",
      attendanceCount: state.records.length,
    };
  }));
  classes.sort((a, b) => String((a.schedule as any).horaInicio ?? "").localeCompare(String((b.schedule as any).horaInicio ?? "")));
  res.json({ success: true, data: { date: today, dayName: todayDay, classes } });
}

export async function getSupervisorTeacherSchedules(_req: Request, res: Response): Promise<void> {
  const data = await loadCoreData();
  res.json({ success: true, data: scheduleClasses(data) });
}

// Una clase de Extracurriculares reúne todas las asignaciones del mismo
// profesor + disciplina + horario: aunque en AppSheet exista una fila por
// grado, la clase es UNA y cubre un rango continuo de grados (6 a 12 aquí).
// El rango sale de la unión de grados de asignaciones e inscripciones.
export function scheduleClasses(data: CoreData): Array<{
  idAsignacion: string;
  esPrincipal: boolean;
  teacher: ReturnType<typeof teacherPayload>;
  discipline: Record<string, unknown>;
  grade: Record<string, unknown>;
  grades: Array<{ idGrado: number; nombre: string }>;
  schedules: Array<ReturnType<typeof schedulePayload>>;
  enrolledCount: number;
}> {
  const byKey = new Map<string, { assignments: typeof data.assignments; scheduleId: string }>();
  for (const assignment of data.assignments) {
    if (assignment.status !== "activo") continue;
    for (const scheduleId of assignment.scheduleIds) {
      const key = `${assignment.teacherId}|${assignment.disciplineCode}|${scheduleId}`;
      const entry = byKey.get(key) ?? { assignments: [], scheduleId };
      entry.assignments.push(assignment);
      byKey.set(key, entry);
    }
  }

  const rows: Array<{ [K in keyof ReturnType<typeof scheduleClasses>[number]]: ReturnType<typeof scheduleClasses>[number][K] }> = [];
  for (const { assignments, scheduleId } of byKey.values()) {
    const schedule = data.scheduleById.get(scheduleId);
    if (!schedule) continue;
    const [code, teacherId] = [assignments[0].disciplineCode, assignments[0].teacherId];
    assignments.sort((a, b) => Number(b.primary) - Number(a.primary) || a.gradeId - b.gradeId || a.id.localeCompare(b.id));
    const canonical = assignments[0];

    const gradeIds = new Set(assignments.map((assignment) => assignment.gradeId));
    for (const row of data.enrollments) {
      if (row.disciplineCode !== code || row.day !== schedule.day) continue;
      const student = data.studentByCode.get(row.studentCode);
      if (student && Number.isFinite(student.gradeId)) gradeIds.add(student.gradeId);
    }
    const min = Math.min(...gradeIds);
    const max = Math.max(...gradeIds);
    const grades = Array.from({ length: max - min + 1 }, (_, index) => {
      const id = min + index;
      const named = data.gradeById.get(id);
      return { idGrado: id, nombre: named?.name ?? String(id) };
    });

    rows.push({
      idAsignacion: canonical.id,
      esPrincipal: canonical.primary,
      teacher: teacherPayload(data.userById.get(teacherId)),
      discipline: disciplinePayload(code),
      grade: gradePayload(data.gradeById.get(min), min),
      grades,
      schedules: [schedulePayload(schedule)],
      enrolledCount: data.enrollments.filter((row) => row.disciplineCode === code && row.day === schedule.day).length,
    });
  }
  return rows;
}

function sessionsForClass(views: SessionView[], disciplineCode: string, scheduleId: string, data: CoreData) {
  return views
    .filter((view) => {
      const assignment = data.assignments.find((row) => row.id === view.assignmentId);
      return assignment?.disciplineCode === disciplineCode && view.scheduleId === scheduleId && view.date === todayColombia();
    })
    .map((view) => ({ id: view.id, fecha: view.date, estado: "finalizada", counts: counts(view.records) }));
}

export async function getSupervisorAssignmentHistory(req: Request, res: Response): Promise<void> {
  const data = await loadCoreData();
  const assignment = data.assignments.find((row) => row.id === param(req, "asignacionId"));
  if (!assignment) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Asignación no encontrada");
  const views = await sessionViews(data);
  const studentsFor = (scheduleId: string) => {
    const day = data.scheduleById.get(scheduleId)?.day;
    return data.enrollments
      .filter((row) => row.disciplineCode === assignment.disciplineCode && row.day === day)
      .map((row) => data.studentByCode.get(row.studentCode))
      .filter((student): student is NonNullable<typeof student> => Boolean(student))
      .map((student) => ({
        codigoEstudiante: student.code,
        nombre: student.firstName,
        apellido: student.lastName,
        idGrado: student.gradeId,
        gradoNombre: data.gradeById.get(student.gradeId)?.name ?? student.gradeName,
        grupo: student.group,
        correo: student.email,
        fotoUrl: student.photoUrl,
      }));
  };
  const classGradeIds = new Set<number>([assignment.gradeId]);
  for (const row of data.enrollments) {
    if (row.disciplineCode !== assignment.disciplineCode) continue;
    const student = data.studentByCode.get(row.studentCode);
    if (student && Number.isFinite(student.gradeId)) classGradeIds.add(student.gradeId);
  }
  const minGrade = Math.min(...classGradeIds);
  const maxGrade = Math.max(...classGradeIds);
  const classGrades = Array.from({ length: maxGrade - minGrade + 1 }, (_, index) => {
    const id = minGrade + index;
    const named = data.gradeById.get(id);
    return { idGrado: id, nombre: named?.name ?? String(id) };
  });

  res.json({
    success: true,
    data: {
      assignment: {
        teacher: teacherPayload(data.userById.get(assignment.teacherId)),
        discipline: { codigoDisciplina: assignment.disciplineCode, nombre: assignment.disciplineCode },
        grade: { idGrado: assignment.gradeId, nombre: data.gradeById.get(assignment.gradeId)?.name ?? String(assignment.gradeId) },
        grades: classGrades,
      },
      schedules: assignment.scheduleIds.map((id) => ({
        schedule: schedulePayload(data.scheduleById.get(id)),
        students: studentsFor(id),
        sessions: sessionsForClass(views, assignment.disciplineCode, id, data),
      })),
    },
  });
}

export async function getSupervisorScheduleHistory(req: Request, res: Response): Promise<void> {
  const data = await loadCoreData();
  const assignment = data.assignments.find((row) => row.id === param(req, "asignacionId"));
  const scheduleId = param(req, "horarioId");
  if (!assignment) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Asignación no encontrada");
  if (!assignment.scheduleIds.includes(scheduleId) || !data.scheduleById.has(scheduleId)) throw new AppError(404, "SCHEDULE_NOT_FOUND", "Horario no encontrado");
  res.json({
    success: true,
    data: {
      assignment: {
        teacher: teacherPayload(data.userById.get(assignment.teacherId)),
        discipline: { codigoDisciplina: assignment.disciplineCode, nombre: assignment.disciplineCode },
        grade: { idGrado: assignment.gradeId, nombre: data.gradeById.get(assignment.gradeId)?.name ?? String(assignment.gradeId) },
      },
      schedule: schedulePayload(data.scheduleById.get(scheduleId)),
      sessions: sessionsForClass(await sessionViews(data), assignment.disciplineCode, scheduleId, data),
    },
  });
}

export async function searchSupervisorStudents(req: Request, res: Response): Promise<void> {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 3) {
    res.json({ success: true, data: [] });
    return;
  }
  const data = await loadCoreData();
  const enrolled = new Set(data.enrollments.map((row) => row.studentCode));
  const students = data.students
    .filter((row) => matchesTokens([row.code, row.firstName, row.lastName], q))
    .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "es"))
    .slice(0, 10)
    .map((row) => ({
      codigoEstudiante: row.code,
      nombre: row.firstName,
      apellido: row.lastName,
      idGrado: row.gradeId,
      grupo: row.group,
      fotoUrl: row.photoUrl,
      gradoNombre: data.gradeById.get(row.gradeId)?.name ?? row.gradeName,
      inscrito: enrolled.has(row.code),
    }));
  res.json({ success: true, data: students });
}

export async function getSupervisorStays(req: Request, res: Response): Promise<void> {
  const assignmentId = String(req.query.idAsignacion ?? "");
  const scheduleId = String(req.query.idHorario ?? "");
  const date = normalizeDateOnly(req.query.fecha);
  if (!assignmentId || !scheduleId || !date) throw new AppError(400, "VALIDATION_ERROR", "idAsignacion, idHorario y fecha son requeridos");
  const [data, stays] = await Promise.all([loadCoreData(), getStays()]);
  const rows = stays
    .filter((row) => row.assignmentId === assignmentId && row.scheduleId === scheduleId && row.date === date)
    .map((row) => {
      const student = data.studentByCode.get(row.studentCode);
      return {
        id: row.id,
        idAsignacion: row.assignmentId,
        idHorario: row.scheduleId,
        fecha: row.date,
        createdAt: row.createdAt,
        idSupervisor: row.supervisorId,
        student: {
          codigoEstudiante: row.studentCode,
          nombre: student?.firstName ?? "",
          apellido: student?.lastName ?? "",
          idGrado: student?.gradeId ?? 0,
          grupo: student?.group ?? null,
          fotoUrl: student?.photoUrl ?? null,
          gradoNombre: student ? (data.gradeById.get(student.gradeId)?.name ?? student.gradeName) : null,
        },
      };
    });
  res.json({ success: true, data: rows });
}

export async function createSupervisorStay(req: Request, res: Response): Promise<void> {
  const { idAsignacion, idHorario, codigoEstudiante, fecha } = req.body as Record<string, string | undefined>;
  const date = normalizeDateOnly(fecha);
  if (!idAsignacion || !idHorario || !codigoEstudiante || !date) {
    throw new AppError(400, "VALIDATION_ERROR", "idAsignacion, idHorario, codigoEstudiante y fecha son requeridos");
  }
  const data = await loadCoreData();
  if (!data.studentByCode.has(codigoEstudiante)) throw new AppError(404, "STUDENT_NOT_FOUND", "Estudiante no encontrado");
  const assignment = data.assignments.find((row) => row.id === idAsignacion);
  if (!assignment?.scheduleIds.includes(idHorario)) throw new AppError(400, "INVALID_SCHEDULE", "El horario no pertenece a esta asignación");
  const id = await createStay({ assignmentId: idAsignacion, scheduleId: idHorario, studentCode: codigoEstudiante, date, supervisorId: req.supervisor!.supervisorId });
  res.json({ success: true, data: { id } });
}

export async function deleteSupervisorStay(req: Request, res: Response): Promise<void> {
  const id = param(req, "stayId");
  if (!await removeStay(id, req.supervisor!.supervisorId)) throw new AppError(404, "STAY_NOT_FOUND", "Registro no encontrado");
  res.json({ success: true, data: { id } });
}
