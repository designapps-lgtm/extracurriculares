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
  fotoUrl?: string | null;
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
    `SELECT a."codigoEstudiante", st."nombre", st."apellido", st."grupo", st."fotoUrl", a."estado"
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
        fotoUrl: a.fotoUrl,
        estado: a.estado,
      })),
    },
  });
}

export async function getSupervisorFilters(req: Request, res: Response) {
  const disciplines = await sql`SELECT "codigoDisciplina", "nombre" FROM "Discipline" ORDER BY "nombre" ASC` as unknown as Array<{ codigoDisciplina: string; nombre: string }>;
  const assignments = await sql`SELECT ea."codigoDisciplina", g."nombre" FROM "ExtracurricularAssignment" ea LEFT JOIN "Grade" g ON g."idGrado" = ea."idGrado"` as unknown as Array<{ codigoDisciplina: string; nombre: string | null }>;
  const teachers = await sql`SELECT "idProfesor", "nombre", "apellido" FROM "Teacher" WHERE "estado" = 'activo' ORDER BY "apellido" ASC, "nombre" ASC` as unknown as Array<{ idProfesor: string; nombre: string; apellido: string }>;
  const grades = await sql`SELECT "nombre" FROM "Grade" WHERE "estado" = 'activo' ORDER BY "idGrado" ASC` as unknown as Array<{ nombre: string }>;

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

  res.json({ success: true, data: { disciplinas, profesores: teachers, grados: grades.map((g) => g.nombre) } });
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

function supervisorNowColombia() {
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

const SUP_DIA_MAP_COL: Record<string, string> = {
  0: "DOMINGO", 1: "LUNES", 2: "MARTES", 3: "MIERCOLES",
  4: "JUEVES", 5: "VIERNES", 6: "SABADO",
};

// Clases de todos los profesores. Con `today=1` devuelve solo las del día de
// hoy; si no, todas (el supervisor puede llamar a lista en cualquiera).
export async function getSupervisorClasses(req: Request, res: Response) {
  const todayOnly = String(req.query.today || "") === "1";
  const today = supervisorNowColombia();
  const todayStr = today.toISOString().split("T")[0];
  const todayDay = SUP_DIA_MAP_COL[today.getDay()];

  const assignmentRows = (await sql`
    SELECT
      ea."idAsignacion", ea."codigoDisciplina", ea."idGrado", ea."esPrincipal",
      d."nombre" AS "disciplinaNombre",
      g."idGrado" AS "gradoIdGrado", g."nombre" AS "gradoNombre",
      t."idProfesor", t."nombre" AS "profesorNombre", t."apellido" AS "profesorApellido",
      sc."idHorario", sc."diaSemana", sc."horaInicio", sc."horaFin", sc."aula"
    FROM "ExtracurricularAssignment" ea
    LEFT JOIN "Discipline" d ON d."codigoDisciplina" = ea."codigoDisciplina"
    LEFT JOIN "Grade" g ON g."idGrado" = ea."idGrado"
    LEFT JOIN "Teacher" t ON t."idProfesor" = ea."idProfesor"
    LEFT JOIN "AssignmentSchedule" asch ON asch."idAsignacion" = ea."idAsignacion"
    LEFT JOIN "Schedule" sc ON sc."idHorario" = asch."idHorario"
    WHERE ea."estado" = 'activo'
    ORDER BY sc."diaSemana" ASC, t."apellido" ASC, t."nombre" ASC
  `) as unknown as Array<{
    idAsignacion: string; codigoDisciplina: string; idGrado: number; esPrincipal: boolean;
    disciplinaNombre: string; gradoIdGrado: number; gradoNombre: string;
    idProfesor: string; profesorNombre: string; profesorApellido: string;
    idHorario: string | null; diaSemana: string | null; horaInicio: string | null;
    horaFin: string | null; aula: string | null;
  }>;

  // N+1 eliminado: en vez de 1 query por clase (~600 subrequests en Workers),
  // traemos conteos y sesiones del día con dos queries agrupadas y combinamos
  // en memoria. Cloudflare Workers limita los subrequests por invocación.
  const enrolledRows = (await sql`
    SELECT ss."codigoDisciplina", ss."diaSemana", st."idGrado", COUNT(*)::int AS cnt
    FROM "StudentSchedule" ss
    LEFT JOIN "Student" st ON st."codigoEstudiante" = ss."codigoEstudiante"
    GROUP BY ss."codigoDisciplina", ss."diaSemana", st."idGrado"
  `) as unknown as Array<{ codigoDisciplina: string; diaSemana: string; idGrado: number; cnt: number }>;

  const sessionRows = (await sql`
    SELECT cs."idAsignacion", cs."idHorario", cs."id", cs."estado",
           COUNT(ar."id")::int AS "attendanceCount"
    FROM "ClassSession" cs
    LEFT JOIN "AttendanceRecord" ar ON ar."sessionId" = cs."id"
    WHERE cs."fecha"::date = ${todayStr}::date
    GROUP BY cs."idAsignacion", cs."idHorario", cs."id", cs."estado"
  `) as unknown as Array<{
    idAsignacion: string; idHorario: string; id: string; estado: string; attendanceCount: number;
  }>;

  const enrolledKey = (d: string, dia: string) => `${d}|${dia}`;
  const enrolledMap = new Map<string, number>();
  for (const r of enrolledRows) {
    const key = enrolledKey(r.codigoDisciplina, r.diaSemana);
    enrolledMap.set(key, (enrolledMap.get(key) ?? 0) + r.cnt);
  }

  const sessionKey = (a: string, h: string) => `${a}|${h}`;
  const sessionMap = new Map<string, { id: string; estado: string; attendanceCount: number }>();
  for (const r of sessionRows) {
    const key = sessionKey(r.idAsignacion, r.idHorario);
    if (!sessionMap.has(key)) {
      sessionMap.set(key, { id: r.id, estado: r.estado, attendanceCount: r.attendanceCount });
    }
  }

  // Llamar lista es por CÓDIGO de disciplina: una tarjeta agrupa todos los grados
  // que un mismo profesor dicta bajo ese código en ese horario (ej: XC_23_Voleibol
  // con grados 2 y 3). La asignación "representante" es la de esPrincipal (o la de
  // menor grado) y ancla la sesión; el roster ya trae todos los grados del código.
  const groupKey = (a: { codigoDisciplina: string; idProfesor: string; idHorario: string | null }) =>
    `${a.codigoDisciplina}|${a.idProfesor}|${a.idHorario}`;

  const groups = new Map<string, any>();
  for (const a of assignmentRows) {
    if (a.idHorario === null) continue;
    const key = groupKey(a);
    let g = groups.get(key);
    if (!g) {
      g = {
        idAsignacion: a.idAsignacion,
        discipline: { codigoDisciplina: a.codigoDisciplina, nombre: a.disciplinaNombre },
        grades: [],
        teacher: { idProfesor: a.idProfesor, nombre: a.profesorNombre, apellido: a.profesorApellido },
        schedule: { idHorario: a.idHorario, diaSemana: a.diaSemana, horaInicio: a.horaInicio, horaFin: a.horaFin, aula: a.aula },
        isToday: a.diaSemana === todayDay,
        enrolledCount: enrolledMap.get(enrolledKey(a.codigoDisciplina, a.diaSemana!)) ?? 0,
        sessionId: null,
        sessionEstado: null,
        attendanceCount: 0,
      };
      groups.set(key, g);
    }
    if (!g.grades.some((x: { idGrado: number }) => x.idGrado === a.idGrado)) {
      g.grades.push({ idGrado: a.gradoIdGrado, nombre: a.gradoNombre });
    }
    const sessionRow = sessionMap.get(sessionKey(a.idAsignacion, a.idHorario!));
    if (sessionRow) {
      g.sessionId = sessionRow.id;
      g.sessionEstado = sessionRow.estado;
      g.attendanceCount = sessionRow.attendanceCount;
    }
  }

  for (const g of groups.values()) {
    g.grades.sort((x: { idGrado: number }, y: { idGrado: number }) => x.idGrado - y.idGrado);
  }

  const classes = Array.from(groups.values());

  const visibleClasses = todayOnly ? classes.filter((c) => c.isToday) : classes;

  res.json({
    success: true,
    data: {
      date: todayStr,
      dayName: todayDay,
      classes: visibleClasses,
    },
  });
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
    if (r.idHorario) {
      a.schedules.push({
        schedule: { idHorario: r.idHorario, diaSemana: r.diaSemana, horaInicio: r.horaInicio, horaFin: r.horaFin, aula: r.aula },
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
           st."nombre", st."apellido", st."idGrado", st."grupo", st."correo", st."fotoUrl",
           g."nombre" AS "gradoNombre"
    FROM "StudentSchedule" ss
    LEFT JOIN "Student" st ON st."codigoEstudiante" = ss."codigoEstudiante"
    LEFT JOIN "Grade" g ON g."idGrado" = st."idGrado"
    WHERE ss."codigoDisciplina" = ${assignment.codigoDisciplina}
      AND st."idGrado" = ${assignment.idGrado}
    ORDER BY st."apellido" ASC, st."nombre" ASC
  `) as unknown as Array<{
    diaSemana: string; codigoEstudiante: string; nombre: string; apellido: string;
    idGrado: number; gradoNombre: string | null; grupo: string | null; correo: string | null; fotoUrl: string | null;
  }>;

  const byDay = new Map<string, Array<{
    codigoEstudiante: string; nombre: string; apellido: string; idGrado: number;
    gradoNombre: string | null; grupo: string | null; correo: string | null; fotoUrl: string | null;
  }>>();
  for (const e of enrolled) {
    if (!byDay.has(e.diaSemana)) byDay.set(e.diaSemana, []);
    byDay.get(e.diaSemana)!.push({
      codigoEstudiante: e.codigoEstudiante,
      nombre: e.nombre,
      apellido: e.apellido,
      idGrado: e.idGrado,
      gradoNombre: e.gradoNombre,
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
  const supervisorId = req.supervisor!.supervisorId;
  const deleted = (await sql`
    DELETE FROM "SupervisorStay" WHERE "id" = ${stayId} AND "idSupervisor" = ${supervisorId}
    RETURNING "id"
  `) as unknown as Array<{ id: string }>;

  if (deleted.length === 0) {
    throw new AppError(404, "STAY_NOT_FOUND", "Registro no encontrado");
  }

  res.json({ success: true, data: { id: deleted[0].id } });
}

// ---- Toma de asistencia por el supervisor ----

export async function supervisorStartSession(req: Request, res: Response) {
  const { idAsignacion, idHorario } = req.body;

  if (!idAsignacion || !idHorario) {
    throw new AppError(400, "VALIDATION_ERROR", "idAsignacion e idHorario son requeridos");
  }

  const assignment = await first<{ idProfesor: string }>(
    (await sql`
      SELECT "idProfesor"
      FROM "ExtracurricularAssignment"
      WHERE "idAsignacion" = ${idAsignacion}
      LIMIT 1
    `) as unknown as Array<{ idProfesor: string }>
  );

  if (!assignment) {
    throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Asignación no encontrada");
  }

  const scheduleLink = await first<{ id: string }>(
    (await sql`
      SELECT "id"
      FROM "AssignmentSchedule"
      WHERE "idAsignacion" = ${idAsignacion} AND "idHorario" = ${idHorario}
      LIMIT 1
    `) as unknown as Array<{ id: string }>
  );

  if (!scheduleLink) {
    throw new AppError(400, "INVALID_SCHEDULE", "El horario no pertenece a esta asignación");
  }

  const today = supervisorNowColombia();

  let session = await first<{ id: string; estado: string }>(
    (await sql`
      SELECT "id", "estado"
      FROM "ClassSession"
      WHERE "idAsignacion" = ${idAsignacion}
        AND "idHorario" = ${idHorario}
        AND "fecha"::date = ${today.toISOString().split("T")[0]}::date
      LIMIT 1
    `) as unknown as Array<{ id: string; estado: string }>
  );

  if (!session) {
    const created = (await sql`
      INSERT INTO "ClassSession" ("id", "idAsignacion", "idHorario", "idProfesor", "fecha", "estado", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), ${idAsignacion}, ${idHorario}, ${assignment.idProfesor}, ${today}, 'en_curso', now(), now())
      RETURNING "id", "idAsignacion", "idHorario", "idProfesor", "fecha", "estado", "createdAt", "updatedAt"
    `) as unknown as Array<any>;
    session = created[0];
  } else if (session.estado === "programada") {
    const updated = (await sql`
      UPDATE "ClassSession"
      SET "estado" = 'en_curso', "updatedAt" = now()
      WHERE "id" = ${session.id}
      RETURNING "id", "idAsignacion", "idHorario", "idProfesor", "fecha", "estado", "createdAt", "updatedAt"
    `) as unknown as Array<any>;
    session = updated[0];
  }

  res.json({ success: true, data: session });
}

export async function getSupervisorAttendanceList(req: Request, res: Response) {
  const sessionId = param(req, "sessionId");

  const sessionRow = await first<any>(
    (await sql`
      SELECT
        cs."id", cs."estado", cs."fecha", cs."idProfesor",
        ea."idAsignacion", ea."codigoDisciplina",
        d."nombre" AS "discNombre",
        g."idGrado" AS "gradoIdGrado", g."nombre" AS "gradoNombre",
        sc."idHorario", sc."diaSemana", sc."horaInicio", sc."horaFin", sc."aula",
        t."nombre" AS "profesorNombre", t."apellido" AS "profesorApellido"
      FROM "ClassSession" cs
      LEFT JOIN "ExtracurricularAssignment" ea ON ea."idAsignacion" = cs."idAsignacion"
      LEFT JOIN "Discipline" d ON d."codigoDisciplina" = ea."codigoDisciplina"
      LEFT JOIN "Grade" g ON g."idGrado" = ea."idGrado"
      LEFT JOIN "Schedule" sc ON sc."idHorario" = cs."idHorario"
      LEFT JOIN "Teacher" t ON t."idProfesor" = cs."idProfesor"
      WHERE cs."id" = ${sessionId}
      LIMIT 1
    `) as unknown as Array<any>
  );

  if (!sessionRow) {
    throw new AppError(404, "SESSION_NOT_FOUND", "Sesión no encontrada");
  }

  const sessionFechaStr = new Date(sessionRow.fecha).toISOString().split("T")[0];

  // Llamar lista es por CÓDIGO de disciplina: la lista incluye todos los grados
  // que el mismo profesor dicta bajo ese código (ej: XC_23_Voleibol con grados
  // 2 y 3). El grado de la asignación que ancla la sesión ya no restringe el
  // roster: se toma el conjunto de grados del (código, profesor).
  const codeGrades = (await sql`
    SELECT DISTINCT ea."idGrado"
    FROM "ExtracurricularAssignment" ea
    WHERE ea."codigoDisciplina" = ${sessionRow.codigoDisciplina}
      AND ea."idProfesor" = ${sessionRow.idProfesor}
      AND ea."estado" = 'activo'
  `) as unknown as Array<{ idGrado: number }>;
  const gradeIds = codeGrades.map((g) => g.idGrado);

  const gradeNameRows = (await sql`
    SELECT "idGrado", "nombre" FROM "Grade" WHERE "idGrado" = ANY(${gradeIds})
  `) as unknown as Array<{ idGrado: number; nombre: string }>;
  const gradeNameMap = new Map(gradeNameRows.map((g) => [g.idGrado, g.nombre]));
  const sessionGrades = gradeIds
    .slice()
    .sort((a, b) => a - b)
    .map((idGrado) => ({ idGrado, nombre: gradeNameMap.get(idGrado) ?? String(idGrado) }));

  const enrolledStudents = (await sql`
    SELECT
      ss."codigoEstudiante",
      st."nombre", st."apellido", st."grupo", st."fotoUrl", st."idGrado"
    FROM "StudentSchedule" ss
    LEFT JOIN "Student" st ON st."codigoEstudiante" = ss."codigoEstudiante"
    WHERE ss."codigoDisciplina" = ${sessionRow.codigoDisciplina}
      AND ss."diaSemana" = ${sessionRow.diaSemana}
  `) as unknown as Array<{
    codigoEstudiante: string; nombre: string; apellido: string; grupo: string | null; fotoUrl: string | null; idGrado: number;
  }>;

  const transferredAway = (await sql`
    SELECT "codigoEstudiante"
    FROM "StudentTransfer"
    WHERE "idAsignacionOrigen" = ${sessionRow.idAsignacion}
      AND "fecha" <= ${sessionFechaStr}::date
      AND COALESCE("fechaFin", "fecha") >= ${sessionFechaStr}::date
  `) as unknown as Array<{ codigoEstudiante: string }>;

  const awaySet = new Set(transferredAway.map((t) => t.codigoEstudiante));

  const stays = (await sql`
    SELECT
      st."codigoEstudiante",
      s."nombre", s."apellido", s."grupo", s."fotoUrl"
    FROM "SupervisorStay" st
    LEFT JOIN "Student" s ON s."codigoEstudiante" = st."codigoEstudiante"
    WHERE st."idAsignacion" = ${sessionRow.idAsignacion}
      AND st."idHorario" = ${sessionRow.idHorario}
      AND st."fecha" = ${sessionRow.fecha}::date
  `) as unknown as Array<{
    codigoEstudiante: string; nombre: string; apellido: string; grupo: string | null; fotoUrl: string | null;
  }>;

  const transferredIn = (await sql`
    SELECT
      t."codigoEstudiante",
      s."nombre", s."apellido", s."grupo", s."fotoUrl",
      oa."codigoDisciplina", od."nombre" AS "origenDisciplinaNombre"
    FROM "StudentTransfer" t
    LEFT JOIN "Student" s ON s."codigoEstudiante" = t."codigoEstudiante"
    LEFT JOIN "ExtracurricularAssignment" oa ON oa."idAsignacion" = t."idAsignacionOrigen"
    LEFT JOIN "Discipline" od ON od."codigoDisciplina" = oa."codigoDisciplina"
    WHERE t."idAsignacionDestino" = ${sessionRow.idAsignacion}
      AND t."idHorarioDestino" = ${sessionRow.idHorario}
      AND t."fecha" <= ${sessionFechaStr}::date
      AND COALESCE(t."fechaFin", t."fecha") >= ${sessionFechaStr}::date
  `) as unknown as Array<{
    codigoEstudiante: string; nombre: string; apellido: string; grupo: string | null; fotoUrl: string | null;
    codigoDisciplina: string | null; origenDisciplinaNombre: string | null;
  }>;

  // Traslados activos ese día para el panel "Cambios de disciplina" de la toma
  // de lista: todos los que tocan esta clase (como origen o como destino).
  const dayTransfers = (await sql`
    SELECT
      t."id", t."codigoEstudiante", t."fecha", t."fechaFin", t."motivo",
      s."nombre", s."apellido", s."grupo",
      oa."codigoDisciplina" AS "origenCodigo", od."nombre" AS "origenNombre",
      da."codigoDisciplina" AS "destCodigo", dd."nombre" AS "destNombre"
    FROM "StudentTransfer" t
    LEFT JOIN "Student" s ON s."codigoEstudiante" = t."codigoEstudiante"
    LEFT JOIN "ExtracurricularAssignment" oa ON oa."idAsignacion" = t."idAsignacionOrigen"
    LEFT JOIN "Discipline" od ON od."codigoDisciplina" = oa."codigoDisciplina"
    LEFT JOIN "ExtracurricularAssignment" da ON da."idAsignacion" = t."idAsignacionDestino"
    LEFT JOIN "Discipline" dd ON dd."codigoDisciplina" = da."codigoDisciplina"
    WHERE t."fecha" <= ${sessionFechaStr}::date
      AND COALESCE(t."fechaFin", t."fecha") >= ${sessionFechaStr}::date
    ORDER BY t."fecha" DESC, t."createdAt" DESC
  `) as unknown as Array<{
    id: string; codigoEstudiante: string; fecha: string; fechaFin: string | null; motivo: string | null;
    nombre: string; apellido: string; grupo: string | null;
    origenCodigo: string | null; origenNombre: string | null;
    destCodigo: string | null; destNombre: string | null;
  }>;

  const allStudents = [
    ...enrolledStudents
      .filter((es) => !awaySet.has(es.codigoEstudiante))
      .map((es) => ({
        ...es,
        origen: "inscrito" as const,
        gradoNombre: gradeNameMap.get(es.idGrado) ?? String(es.idGrado),
      })),
    ...stays
      .filter((st) => !awaySet.has(st.codigoEstudiante) && !enrolledStudents.some((e) => e.codigoEstudiante === st.codigoEstudiante))
      .map((st) => ({ ...st, origen: "quedado" as const })),
    ...transferredIn.map((t) => ({
      codigoEstudiante: t.codigoEstudiante,
      nombre: t.nombre,
      apellido: t.apellido,
      grupo: t.grupo,
      fotoUrl: t.fotoUrl,
      origen: "trasladado" as const,
      origenDisciplina: t.origenDisciplinaNombre ?? t.codigoDisciplina ?? "",
    })),
  ];

  const existingAttendance = (await sql`
    SELECT "codigoEstudiante", "estado"
    FROM "AttendanceRecord"
    WHERE "sessionId" = ${sessionId}
  `) as unknown as Array<{ codigoEstudiante: string; estado: string }>;

  const attendanceMap = new Map(existingAttendance.map((a) => [a.codigoEstudiante, a.estado]));

  const students = allStudents.map((es) => ({
    codigoEstudiante: es.codigoEstudiante,
    nombre: es.nombre,
    apellido: es.apellido,
    grupo: es.grupo,
    fotoUrl: es.fotoUrl,
    origen: es.origen,
    origenDisciplina: (es as any).origenDisciplina,
    gradoNombre: (es as any).gradoNombre,
    estado: attendanceMap.get(es.codigoEstudiante) || "pendiente",
  }));

  res.json({
    success: true,
    data: {
      session: { id: sessionRow.id, estado: sessionRow.estado, fecha: sessionRow.fecha },
      assignment: {
        idAsignacion: sessionRow.idAsignacion,
        discipline: { codigoDisciplina: sessionRow.codigoDisciplina, nombre: sessionRow.discNombre },
        grade: { idGrado: sessionRow.gradoIdGrado, nombre: sessionRow.gradoNombre },
        grades: sessionGrades,
      },
      teacher: { idProfesor: sessionRow.idProfesor, nombre: sessionRow.profesorNombre, apellido: sessionRow.profesorApellido },
      schedule: { idHorario: sessionRow.idHorario, diaSemana: sessionRow.diaSemana, horaInicio: sessionRow.horaInicio, horaFin: sessionRow.horaFin, aula: sessionRow.aula },
      students,
      transfers: dayTransfers.map((t) => ({
        id: t.id,
        codigoEstudiante: t.codigoEstudiante,
        fecha: t.fecha,
        fechaFin: t.fechaFin,
        motivo: t.motivo,
        student: { nombre: t.nombre, apellido: t.apellido, grupo: t.grupo },
        origen: { codigoDisciplina: t.origenCodigo, nombre: t.origenNombre },
        destino: { codigoDisciplina: t.destCodigo, nombre: t.destNombre },
      })),
    },
  });
}

export async function supervisorSaveAttendance(req: Request, res: Response) {
  const sessionId = param(req, "sessionId");
  const { records } = req.body;

  if (!records || !Array.isArray(records)) {
    throw new AppError(400, "VALIDATION_ERROR", "records debe ser un array");
  }

  const session = await first<{ id: string }>(
    (await sql`
      SELECT "id"
      FROM "ClassSession"
      WHERE "id" = ${sessionId}
      LIMIT 1
    `) as unknown as Array<{ id: string }>
  );
  if (!session) {
    throw new AppError(404, "SESSION_NOT_FOUND", "Sesión no encontrada");
  }

  await sql`DELETE FROM "AttendanceRecord" WHERE "sessionId" = ${sessionId}`;

  const validRecords = records.filter((r: any) =>
    r.estado === "presente" || r.estado === "ausente" || r.estado === "justificado"
  );

  if (validRecords.length > 0) {
    await sql.transaction((tx) =>
      validRecords.map((r: any) =>
        tx`INSERT INTO "AttendanceRecord" ("id", "sessionId", "codigoEstudiante", "estado", "createdAt")
           VALUES (gen_random_uuid(), ${sessionId}, ${r.codigoEstudiante}, ${r.estado}, now())`
      )
    );
  }

  await sql`UPDATE "ClassSession" SET "estado" = 'finalizada', "updatedAt" = now() WHERE "id" = ${sessionId}`;

  res.json({ success: true, data: { message: "Asistencia guardada", total: validRecords.length } });
}

const TRANSFER_SELECT = `
  t."id", t."codigoEstudiante",
  st."nombre" AS "estNombre", st."apellido" AS "estApellido", st."grupo" AS "estGrupo",
  t."fecha", t."fechaFin", t."motivo", t."createdAt",
  oa."idAsignacion" AS "origenIdAsignacion", oa."codigoDisciplina" AS "origenCodigoDisciplina",
  od."nombre" AS "origenDisciplinaNombre", og."nombre" AS "origenGradoNombre",
  da."idAsignacion" AS "destIdAsignacion", da."codigoDisciplina" AS "destCodigoDisciplina",
  dd."nombre" AS "destDisciplinaNombre", dg."nombre" AS "destGradoNombre",
  dt."idProfesor" AS "destIdProfesor", dt."nombre" AS "destProfesorNombre", dt."apellido" AS "destProfesorApellido",
  ds."idHorario" AS "destIdHorario", ds."diaSemana" AS "destDiaSemana",
  ds."horaInicio" AS "destHoraInicio", ds."horaFin" AS "destHoraFin", ds."aula" AS "destAula",
  sup."idSupervisor" AS "supId", sup."nombre" AS "supNombre", sup."apellido" AS "supApellido"
`;

function shapeTransfer(r: any) {
  return {
    id: r.id,
    codigoEstudiante: r.codigoEstudiante,
    student: {
      codigoEstudiante: r.codigoEstudiante,
      nombre: r.estNombre,
      apellido: r.estApellido,
      grupo: r.estGrupo,
    },
    fecha: r.fecha,
    fechaFin: r.fechaFin,
    motivo: r.motivo,
    createdAt: r.createdAt,
    origen: {
      idAsignacion: r.origenIdAsignacion,
      codigoDisciplina: r.origenCodigoDisciplina,
      discipline: { nombre: r.origenDisciplinaNombre },
      grade: { nombre: r.origenGradoNombre },
    },
    destino: {
      idAsignacion: r.destIdAsignacion,
      idHorario: r.destIdHorario,
      discipline: { nombre: r.destDisciplinaNombre },
      grade: { nombre: r.destGradoNombre },
      teacher: {
        idProfesor: r.destIdProfesor,
        nombre: r.destProfesorNombre,
        apellido: r.destProfesorApellido,
      },
      schedule: {
        idHorario: r.destIdHorario,
        diaSemana: r.destDiaSemana,
        horaInicio: r.destHoraInicio,
        horaFin: r.destHoraFin,
        aula: r.destAula,
      },
    },
    supervisor: {
      idSupervisor: r.supId,
      nombre: r.supNombre,
      apellido: r.supApellido,
    },
  };
}

function transferDayLabel(fechaStr: string): string {
  const d = new Date(`${fechaStr}T00:00:00.000Z`);
  return SUP_DIA_MAP_COL[d.getUTCDay()];
}

// Crea un traslado de un estudiante: ese día (o ese rango de fechas) deja su
// clase de origen y pasa a la clase destino, dejando trazabilidad con el motivo.
// `fecha` es el inicio; `fechaFin` opcional define el último día (duración).
export async function createSupervisorTransfer(req: Request, res: Response) {
  const { codigoEstudiante, idAsignacionOrigen, idAsignacionDestino, idHorarioDestino, fecha, fechaFin, motivo } = req.body;
  const supervisorId = (req as any).supervisor?.supervisorId;

  const fechaStr = typeof fecha === "string" ? fecha : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
    throw new AppError(400, "VALIDATION_ERROR", "fecha debe tener formato YYYY-MM-DD");
  }
  const fechaFinStr = typeof fechaFin === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fechaFin) ? fechaFin : null;
  if (fechaFinStr && fechaFinStr < fechaStr) {
    throw new AppError(400, "VALIDATION_ERROR", "fechaFin no puede ser anterior a fecha");
  }
  if (!codigoEstudiante || !idAsignacionOrigen || !idAsignacionDestino || !idHorarioDestino) {
    throw new AppError(400, "VALIDATION_ERROR", "Faltan datos del traslado");
  }
  if (!motivo || !motivo.trim()) {
    throw new AppError(400, "VALIDATION_ERROR", "Debe indicar el motivo del traslado");
  }
  if (!supervisorId) {
    throw new AppError(401, "UNAUTHORIZED", "Supervisor no autenticado");
  }

  const student = await first<{ codigoEstudiante: string }>(
    (await sql`
      SELECT "codigoEstudiante" FROM "Student" WHERE "codigoEstudiante" = ${codigoEstudiante} LIMIT 1
    `) as unknown as Array<{ codigoEstudiante: string }>
  );
  if (!student) throw new AppError(404, "STUDENT_NOT_FOUND", "Estudiante no encontrado");

  const origen = await first<any>(
    (await sql`
      SELECT ea."idAsignacion", ea."codigoDisciplina", ea."idGrado"
      FROM "ExtracurricularAssignment" ea
      WHERE ea."idAsignacion" = ${idAsignacionOrigen} AND ea."estado" = 'activo' LIMIT 1
    `) as unknown as Array<any>
  );
  if (!origen) throw new AppError(404, "ORIGIN_NOT_FOUND", "Clase de origen no encontrada");

  const destino = await first<any>(
    (await sql`
      SELECT ea."idAsignacion", ea."codigoDisciplina", ea."idGrado", ea."idProfesor"
      FROM "ExtracurricularAssignment" ea
      WHERE ea."idAsignacion" = ${idAsignacionDestino} AND ea."estado" = 'activo' LIMIT 1
    `) as unknown as Array<any>
  );
  if (!destino) throw new AppError(404, "DEST_NOT_FOUND", "Clase de destino no encontrada");

  if (idAsignacionOrigen === idAsignacionDestino) {
    throw new AppError(400, "SAME_ASSIGNMENT", "La clase de destino debe ser distinta a la de origen");
  }

  const scheduleLink = await first<{ id: string; diaSemana: string }>(
    (await sql`
      SELECT asc2."id", sc."diaSemana"
      FROM "AssignmentSchedule" asc2
      JOIN "Schedule" sc ON sc."idHorario" = asc2."idHorario"
      WHERE asc2."idAsignacion" = ${idAsignacionDestino} AND asc2."idHorario" = ${idHorarioDestino} LIMIT 1
    `) as unknown as Array<{ id: string; diaSemana: string }>
  );
  if (!scheduleLink) {
    throw new AppError(400, "INVALID_SCHEDULE", "El horario de destino no pertenece a la clase de destino");
  }

  const fechaDay = transferDayLabel(fechaStr);
  if (scheduleLink.diaSemana !== fechaDay) {
    throw new AppError(400, "DAY_MISMATCH", `La clase de destino es de ${scheduleLink.diaSemana} y la fecha es ${fechaDay}`);
  }

  const enrolled = await first<{ codigoEstudiante: string }>(
    (await sql`
      SELECT ss."codigoEstudiante"
      FROM "StudentSchedule" ss
      WHERE ss."codigoEstudiante" = ${codigoEstudiante}
        AND ss."codigoDisciplina" = ${origen.codigoDisciplina}
        AND ss."diaSemana" = ${fechaDay} LIMIT 1
    `) as unknown as Array<{ codigoEstudiante: string }>
  );
  if (!enrolled) {
    throw new AppError(400, "NOT_ENROLLED_ORIGIN", "El estudiante no está inscrito en la clase de origen ese día");
  }

  // Solapamiento: el estudiante no puede tener un traslado que choque con este rango.
  const existing = await first<{ id: string }>(
    (await sql`
      SELECT "id" FROM "StudentTransfer"
      WHERE "codigoEstudiante" = ${codigoEstudiante}
        AND "fecha" <= ${fechaFinStr || fechaStr}::date
        AND COALESCE("fechaFin", "fecha") >= ${fechaStr}::date
      LIMIT 1
    `) as unknown as Array<{ id: string }>
  );
  if (existing) {
    throw new AppError(409, "TRANSFER_OVERLAP", "Ya existe un traslado que se solapa con este estudiante y estas fechas");
  }

  const created = (await sql`
    INSERT INTO "StudentTransfer"
      ("id", "codigoEstudiante", "idAsignacionOrigen", "idAsignacionDestino", "idHorarioDestino", "fecha", "fechaFin", "motivo", "idSupervisor", "createdAt")
    VALUES
      (gen_random_uuid(), ${codigoEstudiante}, ${idAsignacionOrigen}, ${idAsignacionDestino}, ${idHorarioDestino}, ${fechaStr}::date, ${fechaFinStr}::date, ${motivo.trim()}, ${supervisorId}, now())
    RETURNING "id", "codigoEstudiante", "fecha", "fechaFin", "motivo", "createdAt"
  `) as unknown as Array<any>;

  res.status(201).json({ success: true, data: created[0] });
}

// Historial de traslados (trazabilidad). Filtros opcionales: por estudiante y/o fecha.
export async function listSupervisorTransfers(req: Request, res: Response) {
  const { codigoEstudiante, fecha, fechaFin } = req.query as Record<string, string>;
  const conditions: string[] = [];
  const params: any[] = [];

  if (codigoEstudiante) {
    params.push(codigoEstudiante);
    conditions.push(`t."codigoEstudiante" = $${params.length}`);
  }
  if (fecha) {
    params.push(fecha);
    conditions.push(`t."fecha" >= $${params.length}::date`);
  }
  if (fechaFin) {
    params.push(fechaFin);
    conditions.push(`COALESCE(t."fechaFin", t."fecha") <= $${params.length}::date`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const query = `
    SELECT ${TRANSFER_SELECT}
    FROM "StudentTransfer" t
    LEFT JOIN "Student" st ON st."codigoEstudiante" = t."codigoEstudiante"
    LEFT JOIN "ExtracurricularAssignment" oa ON oa."idAsignacion" = t."idAsignacionOrigen"
    LEFT JOIN "Discipline" od ON od."codigoDisciplina" = oa."codigoDisciplina"
    LEFT JOIN "Grade" og ON og."idGrado" = oa."idGrado"
    LEFT JOIN "ExtracurricularAssignment" da ON da."idAsignacion" = t."idAsignacionDestino"
    LEFT JOIN "Discipline" dd ON dd."codigoDisciplina" = da."codigoDisciplina"
    LEFT JOIN "Grade" dg ON dg."idGrado" = da."idGrado"
    LEFT JOIN "Teacher" dt ON dt."idProfesor" = da."idProfesor"
    LEFT JOIN "Schedule" ds ON ds."idHorario" = t."idHorarioDestino"
    LEFT JOIN "Supervisor" sup ON sup."idSupervisor" = t."idSupervisor"
    ${where}
    ORDER BY t."fecha" DESC, t."createdAt" DESC
  `;

  const rows = (await sql(query, params)) as unknown as Array<any>;

  res.json({ success: true, data: rows.map(shapeTransfer) });
}

// Cancela un traslado (quita la trazabilidad activa de ese día).
export async function deleteSupervisorTransfer(req: Request, res: Response) {
  const transferId = param(req, "id");
  const supervisorId = req.supervisor!.supervisorId;
  const deleted = (await sql`
    DELETE FROM "StudentTransfer" WHERE "id" = ${transferId} AND "idSupervisor" = ${supervisorId} RETURNING "id"
  `) as unknown as Array<{ id: string }>;

  if (!deleted[0]) {
    throw new AppError(404, "TRANSFER_NOT_FOUND", "Traslado no encontrado");
  }
  res.json({ success: true, data: { id: deleted[0].id } });
}
