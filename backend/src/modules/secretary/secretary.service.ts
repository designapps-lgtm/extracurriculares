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

// Roster de SOLO LECTURA para la secretaria: dados una asignación y un horario,
// devuelve los estudiantes de TODOS los grados del código que dicta ese profesor
// para el día de la clase, sin crear sesión ni poder marcar asistencia.
export async function getSecretaryClassStudents(req: Request, res: Response) {
  const idAsignacion = param(req, "asignacionId");
  const idHorario = param(req, "horarioId");

  const assignment = await first<any>(
    await sql(
      `SELECT ea."idAsignacion", ea."codigoDisciplina", ea."idGrado", ea."idProfesor",
              t."nombre" AS "profesorNombre", t."apellido" AS "profesorApellido",
              d."nombre" AS "discNombre"
       FROM "ExtracurricularAssignment" ea
       LEFT JOIN "Teacher" t ON t."idProfesor" = ea."idProfesor"
       LEFT JOIN "Discipline" d ON d."codigoDisciplina" = ea."codigoDisciplina"
       WHERE ea."idAsignacion" = $1 LIMIT 1`,
      [idAsignacion]
    ) as unknown as any[]
  );
  if (!assignment) {
    throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Asignación no encontrada");
  }

  const schedule = await first<any>(
    await sql`SELECT "idHorario", "diaSemana", "horaInicio", "horaFin", "aula" FROM "Schedule" WHERE "idHorario" = ${idHorario} LIMIT 1` as unknown as any[]
  );
  if (!schedule) {
    throw new AppError(404, "SCHEDULE_NOT_FOUND", "Horario no encontrado");
  }

  // Todos los grados que el mismo profesor dicta bajo ese código.
  const codeGrades = (await sql`
    SELECT DISTINCT ea."idGrado"
    FROM "ExtracurricularAssignment" ea
    WHERE ea."codigoDisciplina" = ${assignment.codigoDisciplina}
      AND ea."idProfesor" = ${assignment.idProfesor}
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

  const today = nowColombia();
  const todayStr = today.toISOString().split("T")[0];

  const enrolledStudents = (await sql`
    SELECT
      ss."codigoEstudiante",
      st."nombre", st."apellido", st."grupo", st."fotoUrl", st."idGrado"
    FROM "StudentSchedule" ss
    LEFT JOIN "Student" st ON st."codigoEstudiante" = ss."codigoEstudiante"
    WHERE ss."codigoDisciplina" = ${assignment.codigoDisciplina}
      AND ss."diaSemana" = ${schedule.diaSemana}
      AND st."idGrado" = ANY(${gradeIds})
    ORDER BY st."idGrado" ASC, st."apellido" ASC, st."nombre" ASC
  `) as unknown as Array<{
    codigoEstudiante: string; nombre: string; apellido: string; grupo: string | null; fotoUrl: string | null; idGrado: number;
  }>;

  const stays = (await sql`
    SELECT
      st."codigoEstudiante",
      s."nombre", s."apellido", s."grupo", s."fotoUrl", s."idGrado"
    FROM "SupervisorStay" st
    LEFT JOIN "Student" s ON s."codigoEstudiante" = st."codigoEstudiante"
    WHERE st."idAsignacion" = ${idAsignacion}
      AND st."idHorario" = ${idHorario}
      AND st."fecha" = ${todayStr}::date
  `) as unknown as Array<{
    codigoEstudiante: string; nombre: string; apellido: string; grupo: string | null; fotoUrl: string | null; idGrado: number;
  }>;

  const students = [
    ...enrolledStudents.map((es) => ({
        codigoEstudiante: es.codigoEstudiante,
        nombre: es.nombre,
        apellido: es.apellido,
        grupo: es.grupo,
        fotoUrl: es.fotoUrl,
        gradoNombre: gradeNameMap.get(es.idGrado) ?? String(es.idGrado),
        origen: "inscrito" as const,
      })),
    ...stays
      .filter((st) => !enrolledStudents.some((e) => e.codigoEstudiante === st.codigoEstudiante))
      .map((st) => ({
        codigoEstudiante: st.codigoEstudiante,
        nombre: st.nombre,
        apellido: st.apellido,
        grupo: st.grupo,
        fotoUrl: st.fotoUrl,
        gradoNombre: gradeNameMap.get(st.idGrado) ?? String(st.idGrado),
        origen: "quedado" as const,
      })),
  ];

  res.json({
    success: true,
    data: {
      assignment: {
        idAsignacion,
        codigoDisciplina: assignment.codigoDisciplina,
        discipline: { codigoDisciplina: assignment.codigoDisciplina, nombre: assignment.discNombre },
        grades: sessionGrades,
        teacher: {
          idProfesor: assignment.idProfesor,
          nombre: assignment.profesorNombre,
          apellido: assignment.profesorApellido,
        },
      },
      schedule,
      date: todayStr,
      students,
    },
  });
}
