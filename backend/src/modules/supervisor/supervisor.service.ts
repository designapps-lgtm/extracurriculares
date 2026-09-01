import { Request, Response } from "express";
import * as XLSX from "xlsx";
import { sql, first } from "../../config/db";
import { parsePagination } from "../../utils/pagination";
import { param } from "../../utils/reqParams";
import { AppError } from "../../middlewares/errorHandler";

const STAY_ACCENT_FROM = "áéíóúüñÁÉÍÓÚÜÑ";
const STAY_ACCENT_TO = "aeiouunAEIOUUN";
function stayNormalizedExpr(expr: string): string {
  return `LOWER(TRANSLATE(${expr}, '${STAY_ACCENT_FROM}', '${STAY_ACCENT_TO}'))`;
}

function parseDateOnly(value?: string | null): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [, y, mo, d] = m;
  return new Date(`${y}-${mo}-${d}T00:00:00.000Z`);
}

function toDateOnlyISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

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

interface SessionWhere {
  conditions: string[];
  params: any[];
}

// Convierte los filtros de query en condiciones SQL + params.
function buildSessionWhereSQL(query: Record<string, string>): SessionWhere {
  const { fecha, disciplina, profesor } = query;
  const conditions: string[] = [];
  const params: any[] = [];

  conditions.push(`cs."estado" = 'finalizada'`);

  if (disciplina) {
    params.push(disciplina);
    conditions.push(`ea."codigoDisciplina" = $${params.length}`);
  }
  if (profesor) {
    params.push(profesor);
    conditions.push(`cs."idProfesor" = $${params.length}`);
  }
  const fechaStart = parseDateFilter(fecha);
  if (fechaStart) {
    params.push(fechaStart);
    const p1 = params.length;
    params.push(dayEnd(fechaStart));
    const p2 = params.length;
    conditions.push(`cs."fecha" >= $${p1} AND cs."fecha" <= $${p2}`);
  }

  return { conditions, params };
}

// Devuelve el shape completo de una sesión (con assignment/discipline/grade,
// schedule y teacher), igual que con el include de Prisma.
interface SessionRow {
  id: string;
  idAsignacion: string;
  idHorario: string;
  fecha: Date;
  estado: string;
  idProfesor: string;
  esPrincipal: boolean;
  codigoDisciplina: string;
  idGrado: number;
  eaEstado: string;
  eaCreatedAt: Date;
  eaUpdatedAt: Date;
  disciplinaNombre: string;
  gradoNombre: string;
  schIdHorario: string;
  diaSemana: string;
  horaInicio: string | null;
  horaFin: string | null;
  aula: string | null;
  profesorNombre: string;
  profesorApellido: string;
  total: number;
  presente: number;
  ausente: number;
  justificado: number;
}

const SESSION_SELECT = `
  cs."id", cs."idAsignacion", cs."idHorario", cs."fecha", cs."estado", cs."idProfesor",
  ea."esPrincipal", ea."codigoDisciplina", ea."idGrado", ea."estado" AS "eaEstado",
  ea."createdAt" AS "eaCreatedAt", ea."updatedAt" AS "eaUpdatedAt",
  d."nombre" AS "disciplinaNombre",
  g."nombre" AS "gradoNombre",
  sc."idHorario" AS "schIdHorario", sc."diaSemana", sc."horaInicio", sc."horaFin", sc."aula",
  t."nombre" AS "profesorNombre", t."apellido" AS "profesorApellido",
  COUNT(a."id")::int AS "total",
  COUNT(a."id") FILTER (WHERE a."estado" = 'presente')::int AS "presente",
  COUNT(a."id") FILTER (WHERE a."estado" = 'ausente')::int AS "ausente",
  COUNT(a."id") FILTER (WHERE a."estado" = 'justificado')::int AS "justificado"
`;

function sessionShape(s: SessionRow) {
  return {
    id: s.id,
    idAsignacion: s.idAsignacion,
    idHorario: s.idHorario,
    fecha: s.fecha,
    estado: s.estado,
    assignment: {
      idAsignacion: s.idAsignacion,
      idProfesor: s.idProfesor,
      codigoDisciplina: s.codigoDisciplina,
      idGrado: s.idGrado,
      esPrincipal: s.esPrincipal,
      estado: s.eaEstado,
      createdAt: s.eaCreatedAt,
      updatedAt: s.eaUpdatedAt,
      discipline: { codigoDisciplina: s.codigoDisciplina, nombre: s.disciplinaNombre },
      grade: { idGrado: s.idGrado, nombre: s.gradoNombre },
    },
    schedule: { idHorario: s.schIdHorario, diaSemana: s.diaSemana, horaInicio: s.horaInicio, horaFin: s.horaFin, aula: s.aula },
    teacher: { idProfesor: s.idProfesor, nombre: s.profesorNombre, apellido: s.profesorApellido },
    counts: {
      total: s.total,
      presente: s.presente,
      ausente: s.ausente,
      justificado: s.justificado,
    },
  };
}

const SESSION_JOIN = `
  FROM "ClassSession" cs
  LEFT JOIN "ExtracurricularAssignment" ea ON ea."idAsignacion" = cs."idAsignacion"
  LEFT JOIN "Discipline" d ON d."codigoDisciplina" = ea."codigoDisciplina"
  LEFT JOIN "Grade" g ON g."idGrado" = ea."idGrado"
  LEFT JOIN "Schedule" sc ON sc."idHorario" = cs."idHorario"
  LEFT JOIN "Teacher" t ON t."idProfesor" = cs."idProfesor"
  LEFT JOIN "AttendanceRecord" a ON a."sessionId" = cs."id"
`;

export async function getSupervisorSessions(req: Request, res: Response) {
  const pagination = parsePagination(req.query as Record<string, string>);
  const { conditions, params } = buildSessionWhereSQL(req.query as Record<string, string>);

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countRows = await sql(
    `SELECT COUNT(DISTINCT cs."id")::int AS total FROM "ClassSession" cs
     LEFT JOIN "ExtracurricularAssignment" ea ON ea."idAsignacion" = cs."idAsignacion"
     ${where}`,
    params
  ) as unknown as Array<{ total: number }>;
  const total = countRows[0]?.total ?? 0;

  const dataParams = [...params, pagination.limit, (pagination.page - 1) * pagination.limit];
  const lim = params.length + 1;
  const off = params.length + 2;

  const rows = await sql(
    `SELECT ${SESSION_SELECT}
     ${SESSION_JOIN}
     ${where}
     GROUP BY cs."id", ea."idAsignacion", d."codigoDisciplina", g."idGrado", sc."idHorario", t."idProfesor"
     ORDER BY cs."fecha" DESC, cs."updatedAt" DESC
     LIMIT $${lim} OFFSET $${off}`,
    dataParams
  ) as unknown as SessionRow[];

  const sessions = rows.map(sessionShape);

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

interface AttendanceRow {
  codigoEstudiante: string;
  nombre: string;
  apellido: string;
  grupo: string | null;
  estado: string;
}

export async function getSupervisorSessionAttendance(req: Request, res: Response) {
  const sessionId = param(req, "sessionId");

  const session = await first<SessionRow>(
    await sql(
      `SELECT ${SESSION_SELECT}
       ${SESSION_JOIN}
       WHERE cs."id" = $1
       GROUP BY cs."id", ea."idAsignacion", d."codigoDisciplina", g."idGrado", sc."idHorario", t."idProfesor"`,
      [sessionId]
    ) as unknown as SessionRow[]
  );

  if (!session) {
    throw new AppError(404, "SESSION_NOT_FOUND", "Sesión no encontrada");
  }

  const records = await sql(
    `SELECT a."codigoEstudiante", st."nombre", st."apellido", st."grupo", a."estado"
     FROM "AttendanceRecord" a
     LEFT JOIN "Student" st ON st."codigoEstudiante" = a."codigoEstudiante"
     WHERE a."sessionId" = $1
     ORDER BY st."apellido" ASC, st."nombre" ASC`,
    [sessionId]
  ) as unknown as AttendanceRow[];

  const shaped = sessionShape(session);

  res.json({
    success: true,
    data: {
      id: session.id,
      fecha: session.fecha,
      estado: session.estado,
      assignment: shaped.assignment,
      schedule: shaped.schedule,
      teacher: shaped.teacher,
      records: records.map((a) => ({
        codigoEstudiante: a.codigoEstudiante,
        nombre: a.nombre,
        apellido: a.apellido,
        grupo: a.grupo,
        estado: a.estado,
      })),
    },
  });
}

export async function getSupervisorFilters(req: Request, res: Response) {
  const disciplines = await sql`SELECT "codigoDisciplina", "nombre" FROM "Discipline" ORDER BY "nombre" ASC` as unknown as Array<{ codigoDisciplina: string; nombre: string }>;
  const assignments = await sql`SELECT ea."codigoDisciplina", g."nombre" FROM "ExtracurricularAssignment" ea LEFT JOIN "Grade" g ON g."idGrado" = ea."idGrado"` as unknown as Array<{ codigoDisciplina: string; nombre: string | null }>;
  const teachers = await sql`SELECT "idProfesor", "nombre", "apellido" FROM "Teacher" WHERE "estado" = 'activo' ORDER BY "apellido" ASC, "nombre" ASC` as unknown as Array<{ idProfesor: string; nombre: string; apellido: string }>;

  const gradeNamesByCode = new Map<string, Set<string>>();
  for (const a of assignments) {
    const set = gradeNamesByCode.get(a.codigoDisciplina) ?? new Set<string>();
    if (a.nombre) set.add(a.nombre);
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

type ExportRow = {
  Fecha: string;
  "Día": string;
  "Hora inicio": string;
  "Hora fin": string;
  Disciplina: string;
  Grado: string;
  Profesor: string;
  Código: string;
  "Nombre del estudiante": string;
  Apellido: string;
  Grupo: string;
  Estado: string;
};

function attendanceRow(s: SessionRow, a: AttendanceRow): ExportRow {
  return {
    Fecha: s.fecha.toISOString().slice(0, 10),
    "Día": s.diaSemana ?? "",
    "Hora inicio": s.horaInicio ?? "",
    "Hora fin": s.horaFin ?? "",
    Disciplina: s.disciplinaNombre,
    Grado: String(s.gradoNombre),
    Profesor: `${s.profesorNombre} ${s.profesorApellido}`,
    "Código": a.codigoEstudiante,
    "Nombre del estudiante": a.nombre,
    Apellido: a.apellido,
    Grupo: a.grupo ?? "",
    Estado: ESTADO_ASISTENCIA_LABEL[a.estado] ?? a.estado,
  };
}

function sendWorkbook(res: Response, rows: ExportRow[]): void {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Asistencias");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="asistencias.xlsx"');
  res.send(buffer);
}

// Devuelve sesiones (sin paginar) con TODAS sus asistencias unidas por fila.
async function sessionsWithAttendances(conditions: string[], params: any[]): Promise<{ session: SessionRow; records: AttendanceRow[] }[]> {
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const baseParams = [...params];
  // Primero obtiene las sesiones
  const sessions = await sql(
    `SELECT ${SESSION_SELECT}
     ${SESSION_JOIN}
     ${where}
     GROUP BY cs."id", ea."idAsignacion", d."codigoDisciplina", g."idGrado", sc."idHorario", t."idProfesor"
     ORDER BY cs."fecha" DESC, cs."updatedAt" DESC`,
    baseParams
  ) as unknown as SessionRow[];

  if (sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);
  const records = await sql(
    `SELECT a."sessionId", a."codigoEstudiante", st."nombre", st."apellido", st."grupo", a."estado"
     FROM "AttendanceRecord" a
     LEFT JOIN "Student" st ON st."codigoEstudiante" = a."codigoEstudiante"
     WHERE a."sessionId" = ANY($1)
     ORDER BY st."apellido" ASC, st."nombre" ASC`,
    [sessionIds]
  ) as unknown as Array<AttendanceRow & { sessionId: string }>;

  const bySession = new Map<string, AttendanceRow[]>();
  for (const r of records) {
    if (!bySession.has(r.sessionId)) bySession.set(r.sessionId, []);
    bySession.get(r.sessionId)!.push({
      codigoEstudiante: r.codigoEstudiante,
      nombre: r.nombre,
      apellido: r.apellido,
      grupo: r.grupo,
      estado: r.estado,
    });
  }

  return sessions.map((s) => ({ session: s, records: bySession.get(s.id) ?? [] }));
}

export async function exportSupervisorAttendance(req: Request, res: Response) {
  const { conditions, params } = buildSessionWhereSQL(req.query as Record<string, string>);
  const pairs = await sessionsWithAttendances(conditions, params);

  const rows: ExportRow[] = [];
  for (const p of pairs) {
    for (const a of p.records) rows.push(attendanceRow(p.session, a));
  }

  sendWorkbook(res, rows);
}

export async function exportSupervisorSessionAttendance(req: Request, res: Response) {
  const sessionId = param(req, "sessionId");

  const session = await first<SessionRow>(
    await sql(
      `SELECT ${SESSION_SELECT}
       ${SESSION_JOIN}
       WHERE cs."id" = $1
       GROUP BY cs."id", ea."idAsignacion", d."codigoDisciplina", g."idGrado", sc."idHorario", t."idProfesor"`,
      [sessionId]
    ) as unknown as SessionRow[]
  );

  if (!session) {
    throw new AppError(404, "SESSION_NOT_FOUND", "Sesión no encontrada");
  }

  const records = await sql(
    `SELECT a."sessionId", a."codigoEstudiante", st."nombre", st."apellido", st."grupo", a."estado"
     FROM "AttendanceRecord" a
     LEFT JOIN "Student" st ON st."codigoEstudiante" = a."codigoEstudiante"
     WHERE a."sessionId" = $1
     ORDER BY st."apellido" ASC, st."nombre" ASC`,
    [sessionId]
  ) as unknown as Array<AttendanceRow & { sessionId: string }>;

  const rows = records.map((a) =>
    attendanceRow(session, {
      codigoEstudiante: a.codigoEstudiante,
      nombre: a.nombre,
      apellido: a.apellido,
      grupo: a.grupo,
      estado: a.estado,
    })
  );
  sendWorkbook(res, rows);
}

export async function getSupervisorTeacherSchedules(req: Request, res: Response) {
  const rows = await sql(
    `SELECT ea."idAsignacion", ea."esPrincipal",
            t."idProfesor", t."nombre", t."apellido",
            ea."codigoDisciplina", d."nombre" AS "disciplinaNombre",
            ea."idGrado", g."nombre" AS "gradoNombre",
            sc."idHorario", sc."diaSemana", sc."horaInicio", sc."horaFin", sc."aula"
     FROM "ExtracurricularAssignment" ea
     LEFT JOIN "Teacher" t ON t."idProfesor" = ea."idProfesor"
     LEFT JOIN "Discipline" d ON d."codigoDisciplina" = ea."codigoDisciplina"
     LEFT JOIN "Grade" g ON g."idGrado" = ea."idGrado"
     LEFT JOIN "AssignmentSchedule" asch ON asch."idAsignacion" = ea."idAsignacion"
     LEFT JOIN "Schedule" sc ON sc."idHorario" = asch."idHorario"
     WHERE ea."estado" = 'activo'
     ORDER BY t."apellido" ASC, t."nombre" ASC, ea."codigoDisciplina" ASC`
  ) as unknown as any[];

  const byAssign = new Map<string, any>();
  for (const r of rows) {
    if (!byAssign.has(r.idAsignacion)) {
      byAssign.set(r.idAsignacion, {
        idAsignacion: r.idAsignacion,
        esPrincipal: r.esPrincipal,
        teacher: { idProfesor: r.idProfesor, nombre: r.nombre, apellido: r.apellido },
        discipline: { codigoDisciplina: r.codigoDisciplina, nombre: r.disciplinaNombre },
        grade: { idGrado: r.idGrado, nombre: r.gradoNombre },
        schedules: [],
      });
    }
    const a = byAssign.get(r.idAsignacion)!;
    if (r.schIdHorario) {
      a.schedules.push({
        schedule: { idHorario: r.schIdHorario, diaSemana: r.diaSemana, horaInicio: r.horaInicio, horaFin: r.horaFin, aula: r.aula },
      });
    }
  }

  const schedules = Array.from(byAssign.values()).filter((a) => a.schedules.length > 0);
  res.json({ success: true, data: schedules });
}

export async function getSupervisorAssignmentHistory(req: Request, res: Response) {
  const asignacionId = param(req, "asignacionId");

  const assignment = await first<any>(
    await sql(
      `SELECT t."idProfesor", t."nombre", t."apellido",
              ea."codigoDisciplina", d."nombre" AS "disciplinaNombre",
              ea."idGrado", g."nombre" AS "gradoNombre"
       FROM "ExtracurricularAssignment" ea
       LEFT JOIN "Teacher" t ON t."idProfesor" = ea."idProfesor"
       LEFT JOIN "Discipline" d ON d."codigoDisciplina" = ea."codigoDisciplina"
       LEFT JOIN "Grade" g ON g."idGrado" = ea."idGrado"
       WHERE ea."idAsignacion" = $1 LIMIT 1`,
      [asignacionId]
    ) as unknown as any[]
  );
  if (!assignment) {
    throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Asignación no encontrada");
  }

  const assignmentsSchedules = await sql(
    `SELECT sc."idHorario", sc."diaSemana", sc."horaInicio", sc."horaFin", sc."aula"
     FROM "AssignmentSchedule" asch
     LEFT JOIN "Schedule" sc ON sc."idHorario" = asch."idHorario"
     WHERE asch."idAsignacion" = $1`,
    [asignacionId]
  ) as unknown as Array<{ idHorario: string; diaSemana: string; horaInicio: string | null; horaFin: string | null; aula: string | null }>;

  const sessions = await sql(
    `SELECT cs."id", cs."idHorario", cs."fecha", cs."estado",
            COUNT(a."id")::int AS "total",
            COUNT(a."id") FILTER (WHERE a."estado" = 'presente')::int AS "presente",
            COUNT(a."id") FILTER (WHERE a."estado" = 'ausente')::int AS "ausente",
            COUNT(a."id") FILTER (WHERE a."estado" = 'justificado')::int AS "justificado"
     FROM "ClassSession" cs
     LEFT JOIN "AttendanceRecord" a ON a."sessionId" = cs."id"
     WHERE cs."idAsignacion" = $1
     GROUP BY cs."id"
     ORDER BY cs."fecha" DESC`,
    [asignacionId]
  ) as unknown as any[];

  const schedules = assignmentsSchedules.map((sch) => ({
    schedule: sch,
    sessions: sessions
      .filter((s) => s.idHorario === sch.idHorario)
      .map((s) => ({ id: s.id, fecha: s.fecha, estado: s.estado, counts: { total: s.total, presente: s.presente, ausente: s.ausente, justificado: s.justificado } })),
  }));

  const enrolled = (await sql`
    SELECT ss."diaSemana", ss."codigoEstudiante",
           st."nombre", st."apellido", st."idGrado", st."grupo", st."correo", st."fotoUrl"
    FROM "StudentSchedule" ss
    LEFT JOIN "Student" st ON st."codigoEstudiante" = ss."codigoEstudiante"
    WHERE ss."codigoDisciplina" = ${assignment.codigoDisciplina}
      AND st."idGrado" = ${assignment.idGrado}
    ORDER BY st."apellido" ASC, st."nombre" ASC
  `) as unknown as Array<{
    diaSemana: string; codigoEstudiante: string; nombre: string; apellido: string;
    idGrado: number; grupo: string | null; correo: string | null; fotoUrl: string | null;
  }>;

  const byDay = new Map<string, Array<{
    codigoEstudiante: string; nombre: string; apellido: string; idGrado: number;
    grupo: string | null; correo: string | null; fotoUrl: string | null;
  }>>();
  for (const e of enrolled) {
    if (!byDay.has(e.diaSemana)) byDay.set(e.diaSemana, []);
    byDay.get(e.diaSemana)!.push({
      codigoEstudiante: e.codigoEstudiante,
      nombre: e.nombre,
      apellido: e.apellido,
      idGrado: e.idGrado,
      grupo: e.grupo,
      correo: e.correo,
      fotoUrl: e.fotoUrl,
    });
  }

  const schedulesWithStudents = schedules.map((sch) => ({
    ...sch,
    students: byDay.get(sch.schedule.diaSemana) ?? [],
  }));

  res.json({
    success: true,
    data: {
      assignment: {
        teacher: { idProfesor: assignment.idProfesor, nombre: assignment.nombre, apellido: assignment.apellido },
        discipline: { codigoDisciplina: assignment.codigoDisciplina, nombre: assignment.disciplinaNombre },
        grade: { idGrado: assignment.idGrado, nombre: assignment.gradoNombre },
      },
      schedules: schedulesWithStudents,
    },
  });
}

export async function getSupervisorScheduleHistory(req: Request, res: Response) {
  const asignacionId = param(req, "asignacionId");
  const horarioId = param(req, "horarioId");

  const assignment = await first<any>(
    await sql(
      `SELECT t."idProfesor", t."nombre", t."apellido",
              ea."codigoDisciplina", d."nombre" AS "disciplinaNombre",
              ea."idGrado", g."nombre" AS "gradoNombre"
       FROM "ExtracurricularAssignment" ea
       LEFT JOIN "Teacher" t ON t."idProfesor" = ea."idProfesor"
       LEFT JOIN "Discipline" d ON d."codigoDisciplina" = ea."codigoDisciplina"
       LEFT JOIN "Grade" g ON g."idGrado" = ea."idGrado"
       WHERE ea."idAsignacion" = $1 LIMIT 1`,
      [asignacionId]
    ) as unknown as any[]
  );
  if (!assignment) {
    throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Asignación no encontrada");
  }

  const schedule = await first<any>(
    await sql`SELECT "idHorario", "diaSemana", "horaInicio", "horaFin", "aula" FROM "Schedule" WHERE "idHorario" = ${horarioId} LIMIT 1` as unknown as any[]
  );
  if (!schedule) {
    throw new AppError(404, "SCHEDULE_NOT_FOUND", "Horario no encontrado");
  }

  const sessions = await sql(
    `SELECT cs."id", cs."fecha", cs."estado",
            COUNT(a."id")::int AS "total",
            COUNT(a."id") FILTER (WHERE a."estado" = 'presente')::int AS "presente",
            COUNT(a."id") FILTER (WHERE a."estado" = 'ausente')::int AS "ausente",
            COUNT(a."id") FILTER (WHERE a."estado" = 'justificado')::int AS "justificado"
     FROM "ClassSession" cs
     LEFT JOIN "AttendanceRecord" a ON a."sessionId" = cs."id"
     WHERE cs."idAsignacion" = $1 AND cs."idHorario" = $2
     GROUP BY cs."id"
     ORDER BY cs."fecha" DESC`,
    [asignacionId, horarioId]
  ) as unknown as any[];

  res.json({
    success: true,
    data: {
      assignment: {
        teacher: { idProfesor: assignment.idProfesor, nombre: assignment.nombre, apellido: assignment.apellido },
        discipline: { codigoDisciplina: assignment.codigoDisciplina, nombre: assignment.disciplinaNombre },
        grade: { idGrado: assignment.idGrado, nombre: assignment.gradoNombre },
      },
      schedule,
      sessions: sessions.map((s) => ({
        id: s.id,
        fecha: s.fecha,
        estado: s.estado,
        counts: { total: s.total, presente: s.presente, ausente: s.ausente, justificado: s.justificado },
      })),
    },
  });
}

// ---- Novedades de "quedarse" (niños no inscritos que se quedan) ----

export async function searchSupervisorStudents(req: Request, res: Response) {
  const q = String(req.query.q || "").trim();

  if (q.length === 0 || q.length < 3) {
    res.json({ success: true, data: [] });
    return;
  }

  const fullName = stayNormalizedExpr(`COALESCE(s."nombre", '') || ' ' || COALESCE(s."apellido", '')`);
  const code = stayNormalizedExpr(`s."codigoEstudiante"`);
  const tokens = q.split(/\s+/).filter(Boolean);
  const params: any[] = [];
  let idx = 0;
  const conditions = tokens.map((token) => {
    idx++;
    params.push(`%${token}%`);
    return `(${fullName} LIKE $${idx} OR ${code} LIKE $${idx})`;
  });
  idx++;
  params.push(10);

  const students = (await sql(
    `SELECT
       s."codigoEstudiante", s."nombre", s."apellido", s."idGrado", s."grupo", s."fotoUrl",
       g."nombre" AS "gradoNombre",
       EXISTS (SELECT 1 FROM "StudentSchedule" ss WHERE ss."codigoEstudiante" = s."codigoEstudiante") AS "inscrito"
     FROM "Student" s
     LEFT JOIN "Grade" g ON g."idGrado" = s."idGrado"
     WHERE s."estado" = 'activo' AND (${conditions.join(" AND ")})
     ORDER BY s."apellido" ASC, s."nombre" ASC
     LIMIT $${idx}`,
    params
  )) as unknown as Array<{
    codigoEstudiante: string;
    nombre: string;
    apellido: string;
    idGrado: number;
    grupo: string | null;
    fotoUrl: string | null;
    gradoNombre: string | null;
    inscrito: boolean;
  }>;

  res.json({
    success: true,
    data: students.map((s) => ({
      codigoEstudiante: s.codigoEstudiante,
      nombre: s.nombre,
      apellido: s.apellido,
      idGrado: s.idGrado,
      grupo: s.grupo,
      fotoUrl: s.fotoUrl,
      gradoNombre: s.gradoNombre,
      inscrito: s.inscrito,
    })),
  });
}

export async function getSupervisorStays(req: Request, res: Response) {
  const { idAsignacion, idHorario, fecha } = req.query as Record<string, string>;
  const fechaDate = parseDateOnly(fecha);

  if (!idAsignacion || !idHorario || !fechaDate) {
    throw new AppError(400, "VALIDATION_ERROR", "idAsignacion, idHorario y fecha son requeridos");
  }

  const stays = (await sql`
    SELECT st."id", st."idAsignacion", st."idHorario", st."fecha",
           st."codigoEstudiante", st."idSupervisor", st."createdAt",
           s."nombre", s."apellido", s."idGrado", s."grupo", s."fotoUrl",
           g."nombre" AS "gradoNombre"
    FROM "SupervisorStay" st
    LEFT JOIN "Student" s ON s."codigoEstudiante" = st."codigoEstudiante"
    LEFT JOIN "Grade" g ON g."idGrado" = s."idGrado"
    WHERE st."idAsignacion" = ${idAsignacion}
      AND st."idHorario" = ${idHorario}
      AND st."fecha" = ${fechaDate}::date
    ORDER BY s."apellido" ASC, s."nombre" ASC
  `) as unknown as any[];

  res.json({
    success: true,
    data: stays.map((st) => ({
      id: st.id,
      idAsignacion: st.idAsignacion,
      idHorario: st.idHorario,
      fecha: toDateOnlyISO(st.fecha),
      createdAt: st.createdAt,
      idSupervisor: st.idSupervisor,
      student: {
        codigoEstudiante: st.codigoEstudiante,
        nombre: st.nombre,
        apellido: st.apellido,
        idGrado: st.idGrado,
        grupo: st.grupo,
        fotoUrl: st.fotoUrl,
        gradoNombre: st.gradoNombre,
      },
    })),
  });
}

export async function createSupervisorStay(req: Request, res: Response) {
  const supervisorId = req.supervisor!.supervisorId;
  const { idAsignacion, idHorario, codigoEstudiante, fecha } = req.body as {
    idAsignacion?: string;
    idHorario?: string;
    codigoEstudiante?: string;
    fecha?: string;
  };
  const fechaDate = parseDateOnly(fecha);

  if (!idAsignacion || !idHorario || !codigoEstudiante || !fechaDate) {
    throw new AppError(400, "VALIDATION_ERROR", "idAsignacion, idHorario, codigoEstudiante y fecha son requeridos");
  }

  const student = await first<any>(
    (await sql`SELECT "codigoEstudiante" FROM "Student" WHERE "codigoEstudiante" = ${codigoEstudiante} LIMIT 1`) as any[]
  );
  if (!student) {
    throw new AppError(404, "STUDENT_NOT_FOUND", "Estudiante no encontrado");
  }

  const scheduleLink = await first<any>(
    (await sql`
      SELECT "id" FROM "AssignmentSchedule"
      WHERE "idAsignacion" = ${idAsignacion} AND "idHorario" = ${idHorario} LIMIT 1
    `) as any[]
  );
  if (!scheduleLink) {
    throw new AppError(400, "INVALID_SCHEDULE", "El horario no pertenece a esta asignación");
  }

  const created = (await sql`
    INSERT INTO "SupervisorStay" ("id", "idAsignacion", "idHorario", "codigoEstudiante", "fecha", "idSupervisor", "createdAt")
    VALUES (gen_random_uuid(), ${idAsignacion}, ${idHorario}, ${codigoEstudiante}, ${fechaDate}::date, ${supervisorId}, now())
    ON CONFLICT ("idAsignacion", "idHorario", "codigoEstudiante", "fecha") DO NOTHING
    RETURNING "id"
  `) as unknown as Array<{ id: string }>;

  res.json({ success: true, data: { id: created[0]?.id ?? null } });
}

export async function deleteSupervisorStay(req: Request, res: Response) {
  const stayId = param(req, "stayId");
  const deleted = (await sql`
    DELETE FROM "SupervisorStay" WHERE "id" = ${stayId}
    RETURNING "id"
  `) as unknown as Array<{ id: string }>;

  if (deleted.length === 0) {
    throw new AppError(404, "STAY_NOT_FOUND", "Registro no encontrado");
  }

  res.json({ success: true, data: { id: deleted[0].id } });
}
