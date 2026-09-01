import { Request, Response } from "express";
import { sql, first } from "../../config/db";
import { AppError } from "../../middlewares/errorHandler";
import { param } from "../../utils/reqParams";

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

  const classesWithStats = await Promise.all(
    assignmentRows
      .filter((a) => a.idHorario !== null)
      .map(async (a) => {
        const enrolledCountRow = (await sql`
          SELECT COUNT(*)::int AS cnt
          FROM "StudentSchedule" ss
          LEFT JOIN "Student" st ON st."codigoEstudiante" = ss."codigoEstudiante"
          WHERE ss."codigoDisciplina" = ${a.codigoDisciplina}
            AND ss."diaSemana" = ${a.diaSemana!}
            AND st."idGrado" = ${a.idGrado}
        `) as unknown as Array<{ cnt: number }>;

        const stayCountRow = (await sql`
          SELECT COUNT(*)::int AS cnt
          FROM "SupervisorStay" st
          WHERE st."idAsignacion" = ${a.idAsignacion}
            AND st."idHorario" = ${a.idHorario!}
            AND st."fecha" = ${todayStr}::date
        `) as unknown as Array<{ cnt: number }>;

        const sessionRow = await first<{
          id: string; estado: string; attendanceCount: number;
        }>((await sql`
          SELECT cs."id", cs."estado",
                 COUNT(ar."id")::int AS "attendanceCount"
          FROM "ClassSession" cs
          LEFT JOIN "AttendanceRecord" ar ON ar."sessionId" = cs."id"
          WHERE cs."idAsignacion" = ${a.idAsignacion}
            AND cs."idHorario" = ${a.idHorario!}
            AND cs."fecha"::date = ${todayStr}::date
          GROUP BY cs."id", cs."estado"
        `) as unknown as Array<{ id: string; estado: string; attendanceCount: number }>);

        return {
          idAsignacion: a.idAsignacion,
          discipline: { codigoDisciplina: a.codigoDisciplina, nombre: a.disciplinaNombre },
          grade: { idGrado: a.gradoIdGrado, nombre: a.gradoNombre },
          schedule: { idHorario: a.idHorario, diaSemana: a.diaSemana, horaInicio: a.horaInicio, horaFin: a.horaFin, aula: a.aula },
          enrolledCount: enrolledCountRow[0]?.cnt ?? 0,
          stayCount: stayCountRow[0]?.cnt ?? 0,
          sessionId: sessionRow?.id ?? null,
          sessionEstado: sessionRow?.estado ?? null,
          attendanceCount: sessionRow?.attendanceCount ?? 0,
        };
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

  const today = nowColombia();

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
      VALUES (gen_random_uuid(), ${idAsignacion}, ${idHorario}, ${teacherId}, ${today}, 'en_curso', now(), now())
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

export async function getAttendanceList(req: Request, res: Response) {
  const teacherId = req.teacher!.teacherId;
  const sessionId = param(req, "sessionId");

  const sessionRow = await first<any>(
    (await sql`
      SELECT
        cs."id", cs."estado", cs."fecha", cs."idProfesor",
        ea."idAsignacion", ea."codigoDisciplina",
        d."nombre" AS "discNombre",
        g."idGrado" AS "gradoIdGrado", g."nombre" AS "gradoNombre",
        sc."idHorario", sc."diaSemana", sc."horaInicio", sc."horaFin", sc."aula"
      FROM "ClassSession" cs
      LEFT JOIN "ExtracurricularAssignment" ea ON ea."idAsignacion" = cs."idAsignacion"
      LEFT JOIN "Discipline" d ON d."codigoDisciplina" = ea."codigoDisciplina"
      LEFT JOIN "Grade" g ON g."idGrado" = ea."idGrado"
      LEFT JOIN "Schedule" sc ON sc."idHorario" = cs."idHorario"
      WHERE cs."id" = ${sessionId}
      LIMIT 1
    `) as unknown as Array<any>
  );

  if (!sessionRow || sessionRow.idProfesor !== teacherId) {
    throw new AppError(404, "SESSION_NOT_FOUND", "Sesión no encontrada");
  }

  const enrolledStudents = (await sql`
    SELECT
      ss."codigoEstudiante",
      st."nombre", st."apellido", st."grupo", st."fotoUrl"
    FROM "StudentSchedule" ss
    LEFT JOIN "Student" st ON st."codigoEstudiante" = ss."codigoEstudiante"
    WHERE ss."codigoDisciplina" = ${sessionRow.codigoDisciplina}
      AND ss."diaSemana" = ${sessionRow.diaSemana}
      AND st."idGrado" = ${sessionRow.gradoIdGrado}
  `) as unknown as Array<{
    codigoEstudiante: string; nombre: string; apellido: string; grupo: string | null; fotoUrl: string | null;
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

  const stayCodes = new Set(stays.map((st) => st.codigoEstudiante));
  const allStudents = [
    ...enrolledStudents.map((es) => ({ ...es, origen: "inscrito" as const })),
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
      },
      schedule: { idHorario: sessionRow.idHorario, diaSemana: sessionRow.diaSemana, horaInicio: sessionRow.horaInicio, horaFin: sessionRow.horaFin, aula: sessionRow.aula },
      students,
    },
  });
}

export async function saveAttendance(req: Request, res: Response) {
  const teacherId = req.teacher!.teacherId;
  const sessionId = param(req, "sessionId");
  const { records } = req.body;

  if (!records || !Array.isArray(records)) {
    throw new AppError(400, "VALIDATION_ERROR", "records debe ser un array");
  }

  const session = await first<{ idProfesor: string }>(
    (await sql`
      SELECT "idProfesor"
      FROM "ClassSession"
      WHERE "id" = ${sessionId}
      LIMIT 1
    `) as unknown as Array<{ idProfesor: string }>
  );
  if (!session || session.idProfesor !== teacherId) {
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

  res.json({ success: true, data: { message: "Asistencia guardada", total: validRecords.length } });
}
