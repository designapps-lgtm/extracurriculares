import { Request, Response } from "express";
import { sql, first } from "../../config/db";
import { AppError } from "../../middlewares/errorHandler";
import { param } from "../../utils/reqParams";

const DIA_COLOMBIA: Record<number, string> = {
  0: "DOMINGO",
  1: "LUNES",
  2: "MARTES",
  3: "MIERCOLES",
  4: "JUEVES",
  5: "VIERNES",
  6: "SABADO",
};

const ESTADOS_VALIDOS = new Set(["presente", "ausente", "justificado"]);

type AttendanceRecordInput = {
  codigoEstudiante?: unknown;
  estado?: unknown;
};

type AttendanceSessionRow = {
  id: string;
  estado: string;
  fecha: Date | string;
  idAsignacion: string;
  codigoDisciplina: string;
  discNombre: string;
  gradoIdGrado: number;
  gradoNombre: string;
  idHorario: string;
  diaSemana: string;
  horaInicio: string | null;
  horaFin: string | null;
  aula: string | null;
  idProfesor: string;
  profesorNombre: string;
  profesorApellido: string;
};

type RosterStudent = {
  codigoEstudiante: string;
  nombre: string;
  apellido: string;
  grupo: string | null;
  fotoUrl: string | null;
  origen: "inscrito" | "quedado";
  gradoNombre?: string;
};

type RosterResult = {
  students: RosterStudent[];
  grades: { idGrado: number; nombre: string }[];
};

function nowColombia(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "0";
  return new Date(`${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`);
}

function todayColombia(): string {
  return nowColombia().toISOString().slice(0, 10);
}

function sessionDate(session: AttendanceSessionRow): string {
  return typeof session.fecha === "string" ? session.fecha.slice(0, 10) : session.fecha.toISOString().slice(0, 10);
}

async function getAttendanceSession(sessionId: string): Promise<AttendanceSessionRow> {
  const row = await first<AttendanceSessionRow>(
    (await sql`
      SELECT
        cs."id", cs."estado", cs."fecha", cs."idAsignacion", cs."idProfesor",
        ea."codigoDisciplina",
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
        AND cs."fecha"::date = ${todayColombia()}::date
      LIMIT 1
    `) as unknown as AttendanceSessionRow[]
  );

  if (!row) {
    throw new AppError(404, "SESSION_NOT_FOUND", "Sesión de Asistencia Extracurriculares no encontrada");
  }
  return row;
}

async function getRoster(session: AttendanceSessionRow): Promise<RosterResult> {
  const gradeRows = (await sql`
    SELECT DISTINCT ea."idGrado"
    FROM "ExtracurricularAssignment" ea
    WHERE ea."codigoDisciplina" = ${session.codigoDisciplina}
      AND ea."idProfesor" = ${session.idProfesor}
      AND ea."estado" = 'activo'
  `) as unknown as Array<{ idGrado: number }>;
  const gradeIds = gradeRows.map((row) => row.idGrado);

  const gradeRowsWithNames = gradeIds.length
    ? ((await sql`
        SELECT "idGrado", "nombre"
        FROM "Grade"
        WHERE "idGrado" = ANY(${gradeIds})
      `) as unknown as Array<{ idGrado: number; nombre: string }>)
    : [];
  const gradeNameMap = new Map(gradeRowsWithNames.map((grade) => [grade.idGrado, grade.nombre]));

  const enrolled = gradeIds.length
    ? ((await sql`
        SELECT
          ss."codigoEstudiante",
          st."nombre", st."apellido", st."grupo", st."fotoUrl", st."idGrado"
        FROM "StudentSchedule" ss
        LEFT JOIN "Student" st ON st."codigoEstudiante" = ss."codigoEstudiante"
        WHERE ss."codigoDisciplina" = ${session.codigoDisciplina}
          AND ss."diaSemana" = ${session.diaSemana}
          AND st."idGrado" = ANY(${gradeIds})
          AND st."estado" = 'activo'
        ORDER BY st."idGrado" ASC, st."apellido" ASC, st."nombre" ASC
      `) as unknown as Array<{
        codigoEstudiante: string;
        nombre: string;
        apellido: string;
        grupo: string | null;
        fotoUrl: string | null;
        idGrado: number;
      }>)
    : [];

  const stays = (await sql`
    SELECT
      ss."codigoEstudiante",
      st."nombre", st."apellido", st."grupo", st."fotoUrl"
    FROM "SupervisorStay" ss
    LEFT JOIN "Student" st ON st."codigoEstudiante" = ss."codigoEstudiante"
    WHERE ss."idAsignacion" = ${session.idAsignacion}
      AND ss."idHorario" = ${session.idHorario}
      AND ss."fecha" = ${sessionDate(session)}::date
      AND st."estado" = 'activo'
  `) as unknown as Array<{
    codigoEstudiante: string;
    nombre: string;
    apellido: string;
    grupo: string | null;
    fotoUrl: string | null;
  }>;

  const result: RosterStudent[] = [];
  const seen = new Set<string>();
  for (const student of enrolled) {
    if (seen.has(student.codigoEstudiante)) continue;
    seen.add(student.codigoEstudiante);
    result.push({
      ...student,
      origen: "inscrito",
      gradoNombre: gradeNameMap.get(student.idGrado) ?? String(student.idGrado),
    });
  }
  for (const student of stays) {
    if (seen.has(student.codigoEstudiante)) continue;
    seen.add(student.codigoEstudiante);
    result.push({ ...student, origen: "quedado" });
  }
  return {
    students: result,
    grades: gradeIds
      .slice()
      .sort((a, b) => a - b)
      .map((idGrado) => ({ idGrado, nombre: gradeNameMap.get(idGrado) ?? String(idGrado) })),
  };
}

export async function startAttendanceSession(
  idAsignacion: string,
  idHorario: string,
  options: { onlyToday?: boolean } = {},
) {
  const assignment = await first<{ idProfesor: string; estado: string }>(
    (await sql`
      SELECT "idProfesor", "estado"
      FROM "ExtracurricularAssignment"
      WHERE "idAsignacion" = ${idAsignacion}
      LIMIT 1
    `) as unknown as Array<{ idProfesor: string; estado: string }>
  );

  if (!assignment) {
    throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Asignación de Extracurriculares no encontrada");
  }
  if (assignment.estado !== "activo") {
    throw new AppError(409, "ASSIGNMENT_INACTIVE", "La asignación de Extracurriculares no está activa");
  }

  const schedule = await first<{ id: string; diaSemana: string }>(
    (await sql`
      SELECT asch."id", sc."diaSemana"
      FROM "AssignmentSchedule" asch
      INNER JOIN "Schedule" sc ON sc."idHorario" = asch."idHorario"
      WHERE asch."idAsignacion" = ${idAsignacion}
        AND asch."idHorario" = ${idHorario}
      LIMIT 1
    `) as unknown as Array<{ id: string; diaSemana: string }>
  );
  if (!schedule) {
    throw new AppError(400, "INVALID_SCHEDULE", "El horario no pertenece a esta asignación de Extracurriculares");
  }

  const today = nowColombia();
  if (options.onlyToday && schedule.diaSemana !== DIA_COLOMBIA[today.getDay()]) {
    throw new AppError(400, "SCHEDULE_NOT_TODAY", "Solo se puede tomar Asistencia Extracurriculares de una clase programada para hoy");
  }

  const date = todayColombia();
  let session = await first<any>(
    (await sql`
      SELECT "id", "idAsignacion", "idHorario", "idProfesor", "fecha", "estado"
      FROM "ClassSession"
      WHERE "idAsignacion" = ${idAsignacion}
        AND "idHorario" = ${idHorario}
        AND "fecha"::date = ${date}::date
      LIMIT 1
    `) as unknown as Array<any>
  );

  if (session?.estado === "finalizada") {
    throw new AppError(409, "SESSION_FINALIZED", "La Asistencia Extracurriculares de esta clase ya fue finalizada");
  }

  if (!session) {
    const created = (await sql`
      INSERT INTO "ClassSession" ("id", "idAsignacion", "idHorario", "idProfesor", "fecha", "estado", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), ${idAsignacion}, ${idHorario}, ${assignment.idProfesor}, ${today}, 'en_curso', now(), now())
      RETURNING "id", "idAsignacion", "idHorario", "idProfesor", "fecha", "estado"
    `) as unknown as Array<any>;
    session = created[0];
  } else if (session.estado === "programada") {
    const updated = (await sql`
      UPDATE "ClassSession"
      SET "estado" = 'en_curso', "updatedAt" = now()
      WHERE "id" = ${session.id}
      RETURNING "id", "idAsignacion", "idHorario", "idProfesor", "fecha", "estado"
    `) as unknown as Array<any>;
    session = updated[0];
  }

  return session;
}

export async function getAttendanceData(sessionId: string) {
  const session = await getAttendanceSession(sessionId);
  const roster = await getRoster(session);
  const existingAttendance = (await sql`
    SELECT "codigoEstudiante", "estado"
    FROM "AttendanceRecord"
    WHERE "sessionId" = ${sessionId}
  `) as unknown as Array<{ codigoEstudiante: string; estado: string }>;
  const attendanceMap = new Map(existingAttendance.map((record) => [record.codigoEstudiante, record.estado]));

  return {
    session: { id: session.id, estado: session.estado, fecha: session.fecha },
    assignment: {
      idAsignacion: session.idAsignacion,
      discipline: { codigoDisciplina: session.codigoDisciplina, nombre: session.discNombre },
      grade: { idGrado: session.gradoIdGrado, nombre: session.gradoNombre },
      grades: roster.grades,
    },
    teacher: { idProfesor: session.idProfesor, nombre: session.profesorNombre, apellido: session.profesorApellido },
    schedule: {
      idHorario: session.idHorario,
      diaSemana: session.diaSemana,
      horaInicio: session.horaInicio,
      horaFin: session.horaFin,
      aula: session.aula,
    },
    students: roster.students.map((student) => ({
      ...student,
      estado: attendanceMap.get(student.codigoEstudiante) || "pendiente",
    })),
  };
}

export async function saveAttendance(
  sessionId: string,
  records: AttendanceRecordInput[],
  options: { allowFinalizedEdit?: boolean } = {},
) {
  const session = await getAttendanceSession(sessionId);
  const isFinalizedEdit = session.estado === "finalizada" && options.allowFinalizedEdit === true;
  if (session.estado !== "en_curso" && !isFinalizedEdit) {
    throw new AppError(409, "SESSION_NOT_EDITABLE", "La Asistencia Extracurriculares solo se puede guardar mientras la sesión está en curso");
  }

  const roster = await getRoster(session);
  if (roster.students.length === 0) {
    throw new AppError(409, "ROSTER_EMPTY", "No hay estudiantes activos en el roster de esta clase");
  }
  const allowedCodes = new Set(roster.students.map((student) => student.codigoEstudiante));
  const uniqueRecords = new Map<string, string>();

  for (const record of records) {
    if (!record || typeof record.codigoEstudiante !== "string" || !record.codigoEstudiante.trim()) {
      throw new AppError(400, "VALIDATION_ERROR", "Cada registro debe tener un código de estudiante");
    }
    if (typeof record.estado !== "string" || !ESTADOS_VALIDOS.has(record.estado)) {
      throw new AppError(400, "VALIDATION_ERROR", "Cada registro debe tener un estado de asistencia válido");
    }
    const codigo = record.codigoEstudiante.trim();
    if (!allowedCodes.has(codigo)) {
      throw new AppError(400, "INVALID_ROSTER", "La asistencia contiene estudiantes que no pertenecen al roster de la clase");
    }
    uniqueRecords.set(codigo, record.estado);
  }

  const normalizedRecords = Array.from(uniqueRecords, ([codigoEstudiante, estado]) => ({ codigoEstudiante, estado }));
  if (normalizedRecords.length !== roster.students.length) {
    throw new AppError(400, "INCOMPLETE_ROSTER", "Debe marcar la Asistencia Extracurriculares de todos los estudiantes antes de finalizar");
  }

  await sql.transaction((tx) => [
    tx`DELETE FROM "AttendanceRecord" WHERE "sessionId" = ${sessionId}`,
    ...normalizedRecords.map((record) => tx`
      INSERT INTO "AttendanceRecord" ("id", "sessionId", "codigoEstudiante", "estado", "createdAt")
      VALUES (gen_random_uuid(), ${sessionId}, ${record.codigoEstudiante}, ${record.estado}, now())
    `),
    tx`UPDATE "ClassSession" SET "estado" = 'finalizada', "updatedAt" = now() WHERE "id" = ${sessionId}`,
  ]);

  return {
    sessionId,
    idAsignacion: session.idAsignacion,
    total: normalizedRecords.length,
    resultado: isFinalizedEdit ? "actualizada" : "finalizada",
  };
}

export async function supervisorStartSession(req: Request, res: Response) {
  const { idAsignacion, idHorario } = req.body as { idAsignacion?: string; idHorario?: string };
  if (!idAsignacion || !idHorario) {
    throw new AppError(400, "VALIDATION_ERROR", "idAsignacion e idHorario son requeridos");
  }
  res.json({ success: true, data: await startAttendanceSession(idAsignacion, idHorario) });
}

export async function adminStartSession(req: Request, res: Response) {
  const { idAsignacion, idHorario } = req.body as { idAsignacion?: string; idHorario?: string };
  if (!idAsignacion || !idHorario) {
    throw new AppError(400, "VALIDATION_ERROR", "idAsignacion e idHorario son requeridos");
  }
  res.json({ success: true, data: await startAttendanceSession(idAsignacion, idHorario, { onlyToday: true }) });
}

export async function attendanceList(req: Request, res: Response) {
  res.json({ success: true, data: await getAttendanceData(param(req, "sessionId")) });
}

export async function attendanceSave(req: Request, res: Response) {
  const { records } = req.body as { records?: AttendanceRecordInput[] };
  if (!Array.isArray(records)) {
    throw new AppError(400, "VALIDATION_ERROR", "records debe ser un array");
  }
  res.json({ success: true, data: await saveAttendance(param(req, "sessionId"), records) });
}

export async function supervisorSaveAttendance(req: Request, res: Response) {
  const { records } = req.body as { records?: AttendanceRecordInput[] };
  if (!Array.isArray(records)) {
    throw new AppError(400, "VALIDATION_ERROR", "records debe ser un array");
  }
  res.json({
    success: true,
    data: await saveAttendance(param(req, "sessionId"), records, { allowFinalizedEdit: true }),
  });
}

export const getSupervisorAttendanceList = attendanceList;
