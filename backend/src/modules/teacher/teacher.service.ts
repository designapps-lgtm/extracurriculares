import { Request, Response } from "express";
import { sql, first } from "../../config/db";
import { AppError } from "../../middlewares/errorHandler";
import { param } from "../../utils/reqParams";
import {
  getAttendanceData,
  saveAttendance as saveAttendanceRecords,
  startAttendanceSession,
} from "../attendance/attendance.service";

function nowColombia() {
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

const DIA_MAP_COL: Record<string, string> = {
  0: "DOMINGO", 1: "LUNES", 2: "MARTES", 3: "MIERCOLES",
  4: "JUEVES", 5: "VIERNES", 6: "SABADO",
};

export async function getTeacherClasses(req: Request, res: Response) {
  const teacherId = req.teacher!.teacherId;
  const today = nowColombia();
  const todayStr = today.toISOString().split("T")[0];

  const assignmentRows = (await sql`
    SELECT
      ea."idAsignacion", ea."codigoDisciplina", ea."idGrado",
      d."nombre" AS "disciplinaNombre",
      g."idGrado" AS "gradoIdGrado", g."nombre" AS "gradoNombre",
      sc."idHorario", sc."diaSemana", sc."horaInicio", sc."horaFin", sc."aula"
    FROM "ExtracurricularAssignment" ea
    LEFT JOIN "Discipline" d ON d."codigoDisciplina" = ea."codigoDisciplina"
    LEFT JOIN "Grade" g ON g."idGrado" = ea."idGrado"
    LEFT JOIN "AssignmentSchedule" asch ON asch."idAsignacion" = ea."idAsignacion"
    LEFT JOIN "Schedule" sc ON sc."idHorario" = asch."idHorario"
    WHERE ea."idProfesor" = ${teacherId} AND ea."estado" = 'activo'
    ORDER BY sc."diaSemana" ASC
  `) as unknown as Array<{
    idAsignacion: string; codigoDisciplina: string; idGrado: number;
    disciplinaNombre: string; gradoIdGrado: number; gradoNombre: string;
    idHorario: string | null; diaSemana: string | null; horaInicio: string | null;
    horaFin: string | null; aula: string | null;
  }>;

  // Llamar lista es por CÓDIGO de disciplina: una tarjeta agrupa todos los grados
  // que este profesor dicta bajo ese código en ese horario (ej: XC_23_Voleibol con
  // grados 2 y 3). La asignación "representante" (menor grado) ancla la sesión.
  const groupKey = (a: { codigoDisciplina: string; idHorario: string | null }) =>
    `${a.codigoDisciplina}|${a.idHorario}`;

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
        schedule: { idHorario: a.idHorario, diaSemana: a.diaSemana, horaInicio: a.horaInicio, horaFin: a.horaFin, aula: a.aula },
        enrolledCount: 0,
        stayCount: 0,
        sessionId: null,
        sessionEstado: null,
        llamadaAt: null,
        llamadaPorTipo: null,
        llamadaPorId: null,
        callStatus: "no_llamada",
        attendanceCount: 0,
      };
      groups.set(key, g);
    }
    if (!g.grades.some((x: { idGrado: number }) => x.idGrado === a.idGrado)) {
      g.grades.push({ idGrado: a.gradoIdGrado, nombre: a.gradoNombre });
    }
  }

  const classesWithStats = await Promise.all(
    Array.from(groups.values()).map(async (g) => {
      const statsRow = await first<{ enrolledCount: number; stayCount: number; rosterCodes: string[] }>(
        (await sql`
          WITH enrolled AS (
            SELECT DISTINCT ss."codigoEstudiante"
            FROM "StudentSchedule" ss
            INNER JOIN "Student" st ON st."codigoEstudiante" = ss."codigoEstudiante"
            WHERE ss."codigoDisciplina" = ${g.discipline.codigoDisciplina}
              AND ss."diaSemana" = ${g.schedule.diaSemana}
              AND EXISTS (
                SELECT 1
                FROM "ExtracurricularAssignment" rosterAssignment
                INNER JOIN "AssignmentSchedule" rosterSchedule
                  ON rosterSchedule."idAsignacion" = rosterAssignment."idAsignacion"
                WHERE rosterAssignment."codigoDisciplina" = ${g.discipline.codigoDisciplina}
                  AND rosterAssignment."idGrado" = st."idGrado"
                  AND rosterAssignment."estado" = 'activo'
                  AND rosterSchedule."idHorario" = ${g.schedule.idHorario}
              )
          ), extra_stays AS (
            SELECT DISTINCT stay."codigoEstudiante"
            FROM "SupervisorStay" stay
            INNER JOIN "ExtracurricularAssignment" stayAssignment
              ON stayAssignment."idAsignacion" = stay."idAsignacion"
            INNER JOIN "Student" st ON st."codigoEstudiante" = stay."codigoEstudiante"
            WHERE stayAssignment."codigoDisciplina" = ${g.discipline.codigoDisciplina}
              AND stay."idHorario" = ${g.schedule.idHorario}
              AND stay."fecha" = ${todayStr}::date
              AND NOT EXISTS (
                SELECT 1 FROM enrolled WHERE enrolled."codigoEstudiante" = stay."codigoEstudiante"
              )
          )
          SELECT
            (SELECT COUNT(*)::int FROM enrolled) AS "enrolledCount",
            (SELECT COUNT(*)::int FROM extra_stays) AS "stayCount",
            ARRAY(
              SELECT "codigoEstudiante" FROM enrolled
              UNION
              SELECT "codigoEstudiante" FROM extra_stays
            ) AS "rosterCodes"
        `) as unknown as Array<{ enrolledCount: number; stayCount: number; rosterCodes: string[] }>
      );

      const sessionRow = await first<{
        id: string; estado: string; llamadaAt: Date | string | null;
        llamadaPorTipo: string | null; llamadaPorId: string | null; attendanceCount: number;
      }>((await sql`
        SELECT cs."id", cs."estado", cs."llamadaAt", cs."llamadaPorTipo", cs."llamadaPorId",
               COUNT(ar."id")::int AS "attendanceCount"
        FROM "ClassSession" cs
        INNER JOIN "ExtracurricularAssignment" sessionAssignment
          ON sessionAssignment."idAsignacion" = cs."idAsignacion"
        LEFT JOIN "AttendanceRecord" ar ON ar."sessionId" = cs."id"
        WHERE sessionAssignment."codigoDisciplina" = ${g.discipline.codigoDisciplina}
          AND cs."idHorario" = ${g.schedule.idHorario}
          AND cs."fecha"::date = ${todayStr}::date
        GROUP BY cs."id", cs."estado", cs."llamadaAt", cs."llamadaPorTipo", cs."llamadaPorId", cs."updatedAt"
        ORDER BY
          CASE WHEN cs."estado" = 'finalizada' THEN 0 WHEN cs."llamadaAt" IS NOT NULL THEN 1 ELSE 2 END,
          COUNT(ar."id") DESC,
          cs."updatedAt" DESC
        LIMIT 1
      `) as unknown as Array<{
        id: string; estado: string; llamadaAt: Date | string | null;
        llamadaPorTipo: string | null; llamadaPorId: string | null; attendanceCount: number;
      }>);

      g.enrolledCount = statsRow?.enrolledCount ?? 0;
      g.stayCount = statsRow?.stayCount ?? 0;
      g.sessionId = sessionRow?.id ?? null;
      g.llamadaAt = sessionRow?.llamadaAt ?? null;
      g.llamadaPorTipo = sessionRow?.llamadaPorTipo ?? null;
      g.llamadaPorId = sessionRow?.llamadaPorId ?? null;
      // Las asistencias guardadas son históricas: el estado de la llamada se
      // decide por la sesión almacenada, no por cambios posteriores del roster.
      g.attendanceCount = sessionRow?.attendanceCount ?? 0;
      g.callStatus = sessionRow?.estado === "finalizada"
        ? "finalizada"
        : sessionRow?.llamadaAt ? "en_curso" : "no_llamada";
      g.sessionEstado = g.callStatus;
      g.grades.sort((x: { idGrado: number }, y: { idGrado: number }) => x.idGrado - y.idGrado);
      return g;
    })
  );

  const teacherProfile = await first<{ idProfesor: string; nombre: string; apellido: string }>(
    (await sql`
      SELECT "idProfesor", "nombre", "apellido"
      FROM "Teacher"
      WHERE "idProfesor" = ${teacherId}
      LIMIT 1
    `) as unknown as Array<{ idProfesor: string; nombre: string; apellido: string }>
  );

  res.json({
    success: true,
    data: {
      teacher: teacherProfile,
      date: todayStr,
      dayName: DIA_MAP_COL[today.getDay()],
      classes: classesWithStats,
    },
  });
}

export async function getTeacherAllAssignments(req: Request, res: Response) {
  const teacherId = req.teacher!.teacherId;

  const assignments = (await sql`
    SELECT
      ea."idAsignacion", ea."idProfesor", ea."codigoDisciplina", ea."idGrado",
      ea."esPrincipal", ea."estado", ea."createdAt", ea."updatedAt",
      d."codigoDisciplina" AS "discCodigo", d."nombre" AS "discNombre",
      g."idGrado" AS "gradoIdGrado", g."nombre" AS "gradoNombre",
      sc."idHorario", sc."diaSemana", sc."horaInicio", sc."horaFin", sc."aula"
    FROM "ExtracurricularAssignment" ea
    LEFT JOIN "Discipline" d ON d."codigoDisciplina" = ea."codigoDisciplina"
    LEFT JOIN "Grade" g ON g."idGrado" = ea."idGrado"
    LEFT JOIN "AssignmentSchedule" asch ON asch."idAsignacion" = ea."idAsignacion"
    LEFT JOIN "Schedule" sc ON sc."idHorario" = asch."idHorario"
    WHERE ea."idProfesor" = ${teacherId} AND ea."estado" = 'activo'
    ORDER BY ea."createdAt" ASC
  `) as unknown as Array<{
    idAsignacion: string; idProfesor: string; codigoDisciplina: string; idGrado: number;
    esPrincipal: boolean; estado: string; createdAt: Date; updatedAt: Date;
    discCodigo: string; discNombre: string; gradoIdGrado: number; gradoNombre: string;
    idHorario: string | null; diaSemana: string | null; horaInicio: string | null;
    horaFin: string | null; aula: string | null;
  }>;

  const grouped = assignments.reduce<Record<string, any>>((acc, row) => {
    if (!acc[row.idAsignacion]) {
      acc[row.idAsignacion] = {
        idAsignacion: row.idAsignacion,
        idProfesor: row.idProfesor,
        codigoDisciplina: row.codigoDisciplina,
        idGrado: row.idGrado,
        esPrincipal: row.esPrincipal,
        estado: row.estado,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        discipline: { codigoDisciplina: row.discCodigo, nombre: row.discNombre },
        grade: { idGrado: row.gradoIdGrado, nombre: row.gradoNombre },
        schedules: [],
      };
    }
    if (row.idHorario) {
      acc[row.idAsignacion].schedules.push({
        schedule: {
          idHorario: row.idHorario,
          diaSemana: row.diaSemana,
          horaInicio: row.horaInicio,
          horaFin: row.horaFin,
          aula: row.aula,
        },
      });
    }
    return acc;
  }, {});

  res.json({ success: true, data: Object.values(grouped) });
}

export async function startSession(req: Request, res: Response) {
  const teacherId = req.teacher!.teacherId;
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

  if (!assignment || assignment.idProfesor !== teacherId) {
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

  const session = await startAttendanceSession(idAsignacion, idHorario, {
    caller: { type: "teacher", id: teacherId },
  });

  res.json({ success: true, data: session });
}

export async function getAttendanceList(req: Request, res: Response) {
  const teacherId = req.teacher!.teacherId;
  const sessionId = param(req, "sessionId");

  // El profesor puede abrir la sesión aunque la haya iniciado un co-profesor,
  // siempre que tenga una asignación activa para la misma clase lógica.
  const teacherAccess = await first<{ idAsignacion: string }>(
    (await sql`
      SELECT teacherAssignment."idAsignacion"
      FROM "ClassSession" cs
      INNER JOIN "ExtracurricularAssignment" sessionAssignment
        ON sessionAssignment."idAsignacion" = cs."idAsignacion"
      INNER JOIN "ExtracurricularAssignment" teacherAssignment
        ON teacherAssignment."codigoDisciplina" = sessionAssignment."codigoDisciplina"
      INNER JOIN "AssignmentSchedule" teacherSchedule
        ON teacherSchedule."idAsignacion" = teacherAssignment."idAsignacion"
       AND teacherSchedule."idHorario" = cs."idHorario"
      WHERE cs."id" = ${sessionId}
        AND teacherAssignment."idProfesor" = ${teacherId}
        AND teacherAssignment."estado" = 'activo'
      LIMIT 1
    `) as unknown as Array<{ idAsignacion: string }>
  );

  if (!teacherAccess) {
    throw new AppError(404, "SESSION_NOT_FOUND", "Sesión no encontrada");
  }

  // Una sola implementación construye grados, inscritos, stays y estados para
  // profesor, supervisor y administrador.
  res.json({ success: true, data: await getAttendanceData(sessionId) });
}

export async function saveAttendance(req: Request, res: Response) {
  const teacherId = req.teacher!.teacherId;
  const sessionId = param(req, "sessionId");
  const session = await first<{ id: string; codigoDisciplina: string; idHorario: string }>(
    (await sql`
      SELECT cs."id", ea."codigoDisciplina", cs."idHorario"
      FROM "ClassSession" cs
      INNER JOIN "ExtracurricularAssignment" ea ON ea."idAsignacion" = cs."idAsignacion"
      WHERE cs."id" = ${sessionId}
      LIMIT 1
    `) as unknown as Array<{ id: string; codigoDisciplina: string; idHorario: string }>
  );
  const teacherAccess = session
    ? await first<{ idAsignacion: string }>(
        (await sql`
          SELECT ea."idAsignacion"
          FROM "ExtracurricularAssignment" ea
          INNER JOIN "AssignmentSchedule" asch ON asch."idAsignacion" = ea."idAsignacion"
          WHERE ea."idProfesor" = ${teacherId}
            AND ea."codigoDisciplina" = ${session.codigoDisciplina}
            AND asch."idHorario" = ${session.idHorario}
            AND ea."estado" = 'activo'
          LIMIT 1
        `) as unknown as Array<{ idAsignacion: string }>
      )
    : null;
  if (!session || !teacherAccess) {
    throw new AppError(404, "SESSION_NOT_FOUND", "Sesión de Asistencia Extracurriculares no encontrada");
  }

  const { records } = req.body as { records?: Array<{ codigoEstudiante?: unknown; estado?: unknown }> };
  if (!Array.isArray(records)) {
    throw new AppError(400, "VALIDATION_ERROR", "records debe ser un array");
  }

  const result = await saveAttendanceRecords(sessionId, records, { allowFinalizedEdit: true });
  res.json({ success: true, data: result });
}
