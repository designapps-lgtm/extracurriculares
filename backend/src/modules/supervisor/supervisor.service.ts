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

interface SessionWhere {
  conditions: string[];
  params: any[];
}

// Las asistencias operativas siempre corresponden al día actual en Colombia.
// Sólo se muestran sesiones que el profesor cerró oficialmente.
function buildSessionWhereSQL(query: Record<string, string>): SessionWhere {
  const { grado, disciplina, profesor } = query;
  const conditions: string[] = [];
  const params: any[] = [];

  conditions.push(`cs."estado" = 'finalizada'`);
  params.push(todayColombiaDate());
  conditions.push(`cs."fecha"::date = $${params.length}::date`);

  if (disciplina) {
    params.push(disciplina);
    conditions.push(`ea."codigoDisciplina" = $${params.length}`);
  }
  if (profesor) {
    params.push(profesor);
    conditions.push(`EXISTS (
      SELECT 1
      FROM "ExtracurricularAssignment" professorAssignment
      INNER JOIN "AssignmentSchedule" professorSchedule
        ON professorSchedule."idAsignacion" = professorAssignment."idAsignacion"
      WHERE professorAssignment."idProfesor" = $${params.length}
        AND professorAssignment."codigoDisciplina" = ea."codigoDisciplina"
        AND professorAssignment."estado" = 'activo'
        AND professorSchedule."idHorario" = cs."idHorario"
    )`);
  }
  if (grado) {
    params.push(grado);
    conditions.push(`EXISTS (
      SELECT 1
      FROM "ExtracurricularAssignment" gradeAssignment
      INNER JOIN "AssignmentSchedule" gradeSchedule
        ON gradeSchedule."idAsignacion" = gradeAssignment."idAsignacion"
      INNER JOIN "Grade" filterGrade ON filterGrade."idGrado" = gradeAssignment."idGrado"
      WHERE gradeAssignment."codigoDisciplina" = ea."codigoDisciplina"
        AND gradeAssignment."estado" = 'activo'
        AND gradeSchedule."idHorario" = cs."idHorario"
        AND filterGrade."nombre" = $${params.length}
    )`);
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

// Las sesiones duplicadas históricas no se eliminan. Para lectura se conserva
// una sola sesión canónica por disciplina + horario + fecha, priorizando una
// finalizada y, entre equivalentes, la que tenga más registros.
const CANONICAL_SESSION_JOIN = `
  INNER JOIN (
    SELECT "sessionId"
    FROM (
      SELECT cs2."id" AS "sessionId",
             ROW_NUMBER() OVER (
               PARTITION BY ea2."codigoDisciplina", cs2."idHorario", cs2."fecha"::date
               ORDER BY
                 CASE WHEN cs2."estado" = 'finalizada' THEN 0 WHEN cs2."llamadaAt" IS NOT NULL THEN 1 ELSE 2 END,
                 (SELECT COUNT(*) FROM "AttendanceRecord" ar2 WHERE ar2."sessionId" = cs2."id") DESC,
                 cs2."updatedAt" DESC
             ) AS "sessionRank"
      FROM "ClassSession" cs2
      INNER JOIN "ExtracurricularAssignment" ea2 ON ea2."idAsignacion" = cs2."idAsignacion"
    ) rankedSessions
    WHERE "sessionRank" = 1
  ) canonicalSession ON canonicalSession."sessionId" = cs."id"
`;

export async function getSupervisorSessions(req: Request, res: Response) {
  const pagination = parsePagination(req.query as Record<string, string>);
  const { conditions, params } = buildSessionWhereSQL(req.query as Record<string, string>);

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countRows = await sql(
    `SELECT COUNT(DISTINCT cs."id")::int AS total FROM "ClassSession" cs
     LEFT JOIN "ExtracurricularAssignment" ea ON ea."idAsignacion" = cs."idAsignacion"
     LEFT JOIN "Grade" g ON g."idGrado" = ea."idGrado"
     ${CANONICAL_SESSION_JOIN}
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
     ${CANONICAL_SESSION_JOIN}
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
       WHERE cs."id" = $1 AND cs."fecha"::date = $2::date
       GROUP BY cs."id", ea."idAsignacion", d."codigoDisciplina", g."idGrado", sc."idHorario", t."idProfesor"`,
      [sessionId, todayColombiaDate()]
    ) as unknown as SessionRow[]
  );

  if (!session) {
    throw new AppError(404, "SESSION_NOT_FOUND", "Sesión no encontrada");
  }

  // Historial inmutable: se muestran exactamente los registros que guardó el
  // profesor, aunque hoy cambien las inscripciones o el grado del estudiante.
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
     ${CANONICAL_SESSION_JOIN}
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
       WHERE cs."id" = $1 AND cs."fecha"::date = $2::date
       GROUP BY cs."id", ea."idAsignacion", d."codigoDisciplina", g."idGrado", sc."idHorario", t."idProfesor"`,
      [sessionId, todayColombiaDate()]
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

function todayColombiaDate(): string {
  return toDateOnlyISO(supervisorNowColombia());
}

const SUP_DIA_MAP_COL: Record<string, string> = {
  0: "DOMINGO", 1: "LUNES", 2: "MARTES", 3: "MIERCOLES",
  4: "JUEVES", 5: "VIERNES", 6: "SABADO",
};

type CallStatus = "no_llamada" | "en_curso" | "finalizada";
type CallType = "teacher" | "supervisor" | "admin" | "historico";

function getCalledBy(row: {
  llamadaAt: Date | string | null;
  llamadaPorTipo: string | null;
  llamadaPorId: string | null;
  llamadaNombre: string | null;
  llamadaApellido: string | null;
}) {
  if (!row.llamadaAt) return null;
  const type: CallType = row.llamadaPorTipo === "teacher" || row.llamadaPorTipo === "supervisor" || row.llamadaPorTipo === "admin"
    ? row.llamadaPorTipo
    : "historico";
  if (type === "historico") {
    return { type, id: null, nombre: "Registro histórico", apellido: "" };
  }
  return {
    type,
    id: row.llamadaPorId,
    nombre: row.llamadaNombre || "Usuario no disponible",
    apellido: row.llamadaApellido || "",
  };
}

// Clases de todos los profesores. Con `today=1` devuelve solo las del día de
// hoy; si no, todas (el supervisor puede llamar a lista en cualquiera).
export async function getSupervisorClasses(req: Request, res: Response) {
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
    ORDER BY sc."diaSemana" ASC, t."apellido" ASC, t."nombre" ASC,
             ea."esPrincipal" DESC, ea."idGrado" ASC
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
  // Conteos del mismo roster que devuelve attendance.service: grados activos
  // de la clase lógica y stays compartidos no duplicados con los inscritos.
  const rosterStatsRows = (await sql`
    WITH logical_grades AS (
      SELECT DISTINCT ea."codigoDisciplina", asch."idHorario", sc."diaSemana", ea."idGrado"
      FROM "ExtracurricularAssignment" ea
      INNER JOIN "AssignmentSchedule" asch ON asch."idAsignacion" = ea."idAsignacion"
      INNER JOIN "Schedule" sc ON sc."idHorario" = asch."idHorario"
      WHERE ea."estado" = 'activo'
    ), enrolled AS (
      SELECT DISTINCT lg."codigoDisciplina", lg."idHorario", ss."codigoEstudiante"
      FROM logical_grades lg
      INNER JOIN "StudentSchedule" ss
        ON ss."codigoDisciplina" = lg."codigoDisciplina"
       AND ss."diaSemana" = lg."diaSemana"
      INNER JOIN "Student" st
        ON st."codigoEstudiante" = ss."codigoEstudiante"
       AND st."idGrado" = lg."idGrado"
      WHERE st."estado" = 'activo'
    ), extra_stays AS (
      SELECT DISTINCT stayAssignment."codigoDisciplina", stay."idHorario", stay."codigoEstudiante"
      FROM "SupervisorStay" stay
      INNER JOIN "ExtracurricularAssignment" stayAssignment
        ON stayAssignment."idAsignacion" = stay."idAsignacion"
      INNER JOIN "Student" st ON st."codigoEstudiante" = stay."codigoEstudiante"
      WHERE stay."fecha" = ${todayStr}::date
        AND st."estado" = 'activo'
        AND NOT EXISTS (
          SELECT 1
          FROM enrolled
          WHERE enrolled."codigoDisciplina" = stayAssignment."codigoDisciplina"
            AND enrolled."idHorario" = stay."idHorario"
            AND enrolled."codigoEstudiante" = stay."codigoEstudiante"
        )
    ), logical_classes AS (
      SELECT DISTINCT "codigoDisciplina", "idHorario" FROM logical_grades
    )
    SELECT lc."codigoDisciplina", lc."idHorario",
           (SELECT COUNT(*)::int FROM enrolled
             WHERE enrolled."codigoDisciplina" = lc."codigoDisciplina"
               AND enrolled."idHorario" = lc."idHorario") AS "enrolledCount",
           (SELECT COUNT(*)::int FROM extra_stays
             WHERE extra_stays."codigoDisciplina" = lc."codigoDisciplina"
               AND extra_stays."idHorario" = lc."idHorario") AS "stayCount",
           ARRAY(
             SELECT enrolled."codigoEstudiante" FROM enrolled
             WHERE enrolled."codigoDisciplina" = lc."codigoDisciplina"
               AND enrolled."idHorario" = lc."idHorario"
             UNION
             SELECT extra_stays."codigoEstudiante" FROM extra_stays
             WHERE extra_stays."codigoDisciplina" = lc."codigoDisciplina"
               AND extra_stays."idHorario" = lc."idHorario"
           ) AS "rosterCodes"
    FROM logical_classes lc
  `) as unknown as Array<{
    codigoDisciplina: string; idHorario: string; enrolledCount: number; stayCount: number; rosterCodes: string[];
  }>;

  const sessionRows = (await sql`
    SELECT sessionAssignment."codigoDisciplina", cs."idAsignacion", cs."idHorario", cs."id", cs."estado",
           cs."llamadaAt", cs."llamadaPorTipo", cs."llamadaPorId", cs."updatedAt",
           MAX(COALESCE(callTeacher."nombre", callSupervisor."nombre", callAdmin."nombre")) AS "llamadaNombre",
           MAX(COALESCE(callTeacher."apellido", callSupervisor."apellido", callAdmin."apellido")) AS "llamadaApellido",
           COUNT(ar."id")::int AS "attendanceCount"
    FROM "ClassSession" cs
    INNER JOIN "ExtracurricularAssignment" sessionAssignment
      ON sessionAssignment."idAsignacion" = cs."idAsignacion"
    LEFT JOIN "AttendanceRecord" ar ON ar."sessionId" = cs."id"
    LEFT JOIN "Teacher" callTeacher
      ON cs."llamadaPorTipo" = 'teacher' AND cs."llamadaPorId" = callTeacher."idProfesor"
    LEFT JOIN "Supervisor" callSupervisor
      ON cs."llamadaPorTipo" = 'supervisor' AND cs."llamadaPorId" = callSupervisor."idSupervisor"
    LEFT JOIN "AdminUser" callAdmin
      ON cs."llamadaPorTipo" = 'admin' AND cs."llamadaPorId" = callAdmin."id"
    WHERE cs."fecha"::date = ${todayStr}::date
    GROUP BY sessionAssignment."codigoDisciplina", cs."idAsignacion", cs."idHorario", cs."id", cs."estado",
             cs."llamadaAt", cs."llamadaPorTipo", cs."llamadaPorId", cs."updatedAt"
    ORDER BY
      CASE WHEN cs."estado" = 'finalizada' THEN 0 WHEN cs."llamadaAt" IS NOT NULL THEN 1 ELSE 2 END,
      COUNT(ar."id") DESC,
      cs."updatedAt" DESC
  `) as unknown as Array<{
    codigoDisciplina: string; idAsignacion: string; idHorario: string; id: string; estado: string;
    llamadaAt: Date | string | null; llamadaPorTipo: string | null; llamadaPorId: string | null;
    llamadaNombre: string | null; llamadaApellido: string | null; attendanceCount: number;
  }>;

  const classKey = (discipline: string, schedule: string) => `${discipline}|${schedule}`;
  const rosterStatsMap = new Map(
    rosterStatsRows.map((row) => [classKey(row.codigoDisciplina, row.idHorario), row]),
  );

  const sessionKey = classKey;
  const sessionMap = new Map<string, {
    id: string;
    estado: string;
    attendanceCount: number;
    llamadaAt: Date | string | null;
    llamadaPorTipo: string | null;
    llamadaPorId: string | null;
    calledBy: ReturnType<typeof getCalledBy>;
  }>();
  for (const r of sessionRows) {
    const key = sessionKey(r.codigoDisciplina, r.idHorario);
    if (!sessionMap.has(key)) {
      sessionMap.set(key, {
        id: r.id,
        estado: r.estado,
        attendanceCount: r.attendanceCount,
        llamadaAt: r.llamadaAt,
        llamadaPorTipo: r.llamadaPorTipo,
        llamadaPorId: r.llamadaPorId,
        calledBy: getCalledBy(r),
      });
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
      const rosterStats = rosterStatsMap.get(classKey(a.codigoDisciplina, a.idHorario));
      g = {
        idAsignacion: a.idAsignacion,
        discipline: { codigoDisciplina: a.codigoDisciplina, nombre: a.disciplinaNombre },
        grades: [],
        teacher: { idProfesor: a.idProfesor, nombre: a.profesorNombre, apellido: a.profesorApellido },
        schedule: { idHorario: a.idHorario, diaSemana: a.diaSemana, horaInicio: a.horaInicio, horaFin: a.horaFin, aula: a.aula },
        isToday: a.diaSemana === todayDay,
        enrolledCount: rosterStats?.enrolledCount ?? 0,
        stayCount: rosterStats?.stayCount ?? 0,
        sessionId: null,
        sessionEstado: null,
        attendanceCount: 0,
        llamadaAt: null,
        llamadaPorTipo: null,
        llamadaPorId: null,
        calledBy: null,
        callStatus: "no_llamada" as CallStatus,
      };
      groups.set(key, g);
    }
    if (!g.grades.some((x: { idGrado: number }) => x.idGrado === a.idGrado)) {
      g.grades.push({ idGrado: a.gradoIdGrado, nombre: a.gradoNombre });
    }
    const sessionRow = sessionMap.get(sessionKey(a.codigoDisciplina, a.idHorario!));
    if (sessionRow) {
      // El panel informa lo que se guardó. Cambios posteriores en estudiantes
      // o inscripciones no cambian ni el estado ni el conteo histórico.
      g.sessionId = sessionRow.id;
      g.attendanceCount = sessionRow.attendanceCount;
      g.llamadaAt = sessionRow.llamadaAt;
      g.llamadaPorTipo = sessionRow.llamadaPorTipo;
      g.llamadaPorId = sessionRow.llamadaPorId;
      g.calledBy = sessionRow.calledBy;
      g.callStatus = sessionRow.estado === "finalizada"
        ? "finalizada"
        : sessionRow.llamadaAt ? "en_curso" : "no_llamada";
      g.sessionEstado = g.callStatus;
    }
  }

  for (const g of groups.values()) {
    g.grades.sort((x: { idGrado: number }, y: { idGrado: number }) => x.idGrado - y.idGrado);
  }

  const classes = Array.from(groups.values());

  const visibleClasses = classes.filter((c) => c.isToday);

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
       AND cs."fecha"::date = $2::date
     GROUP BY cs."id"
     ORDER BY cs."fecha" DESC`,
    [asignacionId, todayColombiaDate()]
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
       AND cs."fecha"::date = $3::date
     GROUP BY cs."id"
     ORDER BY cs."fecha" DESC`,
    [asignacionId, horarioId, todayColombiaDate()]
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
        AND cs."fecha"::date = ${todayColombiaDate()}::date
      LIMIT 1
    `) as unknown as Array<any>
  );

  if (!sessionRow) {
    throw new AppError(404, "SESSION_NOT_FOUND", "Sesión no encontrada");
  }

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
      AND st."idGrado" = ANY(${gradeIds})
    ORDER BY st."idGrado" ASC, st."apellido" ASC, st."nombre" ASC
  `) as unknown as Array<{
    codigoEstudiante: string; nombre: string; apellido: string; grupo: string | null; fotoUrl: string | null; idGrado: number;
  }>;

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

  const allStudents = [
    ...enrolledStudents.map((es) => ({
      ...es,
      origen: "inscrito" as const,
      gradoNombre: gradeNameMap.get(es.idGrado) ?? String(es.idGrado),
    })),
    ...stays
      .filter((st) => !enrolledStudents.some((e) => e.codigoEstudiante === st.codigoEstudiante))
      .map((st) => ({ ...st, origen: "quedado" as const })),
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
        AND "fecha"::date = ${todayColombiaDate()}::date
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
