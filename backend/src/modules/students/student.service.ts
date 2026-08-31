import { sql, first } from "../../config/db";
import { AppError } from "../../middlewares/errorHandler";
import { PaginationParams, PaginatedResult, paginatedResult } from "../../utils/pagination";
import { StudentQuery } from "./student.types";

interface StudentGradeRow {
  codigoEstudiante: string;
  nombre: string;
  apellido: string;
  idGrado: number;
  grupo: string | null;
  correo: string | null;
  fotoUrl: string | null;
  estado: string;
  createdAt: Date;
  updatedAt: Date;
  idGradoRel: number;
  nombreGrado: string;
  nivel: string | null;
}

interface StudentScheduleDisciplineRow {
  codigoEstudiante: string;
  id: string;
  codigoDisciplina: string;
  diaSemana: string;
  disciplinaNombre: string;
  disciplinaDescripcion: string | null;
}

export async function getStudents(query: StudentQuery, pagination: PaginationParams): Promise<PaginatedResult<any>> {
  const { search, grado, disciplina, inscrito } = query;

  const conditions: string[] = [];
  const params: any[] = [];

  let paramIndex = 0;
  const nextParam = (value: any): string => {
    paramIndex += 1;
    params.push(value);
    return `$${paramIndex}`;
  };

  // Filtros base sobre Student
  const studentConds: string[] = [];

  if (search) {
    const p = nextParam(`%${search}%`);
    studentConds.push(
      `(s."codigoEstudiante" ILIKE ${p} OR s."nombre" ILIKE ${p} OR s."apellido" ILIKE ${p})`
    );
  }

  if (grado) {
    // Valida el grado por nombre (mismo comportamiento que Prisma: solo filtra
    // si el grado existe).
    const gradoRow = await first<{ idGrado: number }>(
      await sql`SELECT "idGrado" FROM "Grade" WHERE "nombre" = ${grado} LIMIT 1`
        .then((r) => r as { idGrado: number }[])
    );
    if (gradoRow) {
      studentConds.push(`s."idGrado" = ${nextParam(gradoRow.idGrado)}`);
    }
  }

  const hasDisciplinaFiltro = disciplina && inscrito !== "false";
  if (hasDisciplinaFiltro) {
    const p = nextParam(disciplina);
    studentConds.push(`EXISTS (SELECT 1 FROM "StudentSchedule" ss WHERE ss."codigoEstudiante" = s."codigoEstudiante" AND ss."codigoDisciplina" = ${p})`);
  }

  if (inscrito === "true" && !hasDisciplinaFiltro) {
    studentConds.push(`EXISTS (SELECT 1 FROM "StudentSchedule" ss WHERE ss."codigoEstudiante" = s."codigoEstudiante")`);
  } else if (inscrito === "false") {
    studentConds.push(`NOT EXISTS (SELECT 1 FROM "StudentSchedule" ss WHERE ss."codigoEstudiante" = s."codigoEstudiante")`);
  }

  const whereStudent = studentConds.length > 0 ? `WHERE ${studentConds.join(" AND ")}` : "";

  // Count
  const countParams = [...params];
  const countRows = await sql(
    `SELECT COUNT(*)::int AS total FROM "Student" s ${whereStudent}`,
    countParams
  ) as unknown as Array<{ total: number }>;
  const total = countRows[0]?.total ?? 0;

  // Data (paginación)
  const dataParams = [...params];
  const offset = (pagination.page - 1) * pagination.limit;
  const limitIdx = dataParams.length + 1;
  const offsetIdx = dataParams.length + 2;
  dataParams.push(pagination.limit, offset);

  const students = await sql(
    `SELECT
       s."codigoEstudiante", s."nombre", s."apellido", s."idGrado", s."grupo",
       s."correo", s."fotoUrl", s."estado", s."createdAt", s."updatedAt",
       g."idGrado" AS "idGradoRel", g."nombre" AS "nombreGrado", g."nivel"
     FROM "Student" s
     LEFT JOIN "Grade" g ON g."idGrado" = s."idGrado"
     ${whereStudent}
     ORDER BY s."apellido" ASC, s."nombre" ASC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    dataParams
  ) as unknown as StudentGradeRow[];

  // Reconstruye la forma del payload de Prisma (studentSchedules con discipline)
  const studentCodes = students.map((s) => s.codigoEstudiante);
  const schedules = studentCodes.length > 0
    ? (await sql(
        `SELECT ss."codigoEstudiante", ss."id", ss."codigoDisciplina", ss."diaSemana",
                d."nombre" AS "disciplinaNombre", d."descripcion" AS "disciplinaDescripcion"
         FROM "StudentSchedule" ss
         LEFT JOIN "Discipline" d ON d."codigoDisciplina" = ss."codigoDisciplina"
         WHERE ss."codigoEstudiante" = ANY($1)
         ORDER BY ss."diaSemana" ASC`,
        [studentCodes]
      ) as unknown as StudentScheduleDisciplineRow[])
    : [];

  const data = students.map((s) => ({
    codigoEstudiante: s.codigoEstudiante,
    nombre: s.nombre,
    apellido: s.apellido,
    idGrado: s.idGrado,
    grupo: s.grupo,
    correo: s.correo,
    fotoUrl: s.fotoUrl,
    estado: s.estado,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    grade: { idGrado: s.idGradoRel, nombre: s.nombreGrado, nivel: s.nivel },
    studentSchedules: schedules
      .filter((ss) => ss.codigoEstudiante === s.codigoEstudiante)
      .map((ss) => ({
        id: ss.id,
        codigoDisciplina: ss.codigoDisciplina,
        diaSemana: ss.diaSemana,
        discipline: {
          codigoDisciplina: ss.codigoDisciplina,
          nombre: ss.disciplinaNombre,
          descripcion: ss.disciplinaDescripcion,
        },
      })),
  }));

  return paginatedResult(data, total, pagination);
}

export async function getStudentByCode(codigo: string) {
  const student = await first<StudentGradeRow>(await sql`
    SELECT
      s."codigoEstudiante", s."nombre", s."apellido", s."idGrado", s."grupo",
      s."correo", s."fotoUrl", s."estado", s."createdAt", s."updatedAt",
      g."idGrado" AS "idGradoRel", g."nombre" AS "nombreGrado", g."nivel"
    FROM "Student" s
    LEFT JOIN "Grade" g ON g."idGrado" = s."idGrado"
    WHERE s."codigoEstudiante" = ${codigo}
    LIMIT 1
  ` as unknown as StudentGradeRow[]);

  if (!student) {
    throw new AppError(404, "STUDENT_NOT_FOUND", "No se encontró el estudiante");
  }

  const schedules = (await sql`
    SELECT ss."codigoEstudiante", ss."id", ss."codigoDisciplina", ss."diaSemana",
           d."nombre" AS "disciplinaNombre", d."descripcion" AS "disciplinaDescripcion"
    FROM "StudentSchedule" ss
    LEFT JOIN "Discipline" d ON d."codigoDisciplina" = ss."codigoDisciplina"
    WHERE ss."codigoEstudiante" = ${codigo}
    ORDER BY ss."diaSemana" ASC
  `) as unknown as StudentScheduleDisciplineRow[];

  return {
    codigoEstudiante: student.codigoEstudiante,
    nombre: student.nombre,
    apellido: student.apellido,
    idGrado: student.idGrado,
    grupo: student.grupo,
    correo: student.correo,
    fotoUrl: student.fotoUrl,
    estado: student.estado,
    createdAt: student.createdAt,
    updatedAt: student.updatedAt,
    grade: { idGrado: student.idGradoRel, nombre: student.nombreGrado, nivel: student.nivel },
    studentSchedules: schedules.map((ss) => ({
      id: ss.id,
      codigoDisciplina: ss.codigoDisciplina,
      diaSemana: ss.diaSemana,
      discipline: {
        codigoDisciplina: ss.codigoDisciplina,
        nombre: ss.disciplinaNombre,
        descripcion: ss.disciplinaDescripcion,
      },
    })),
  };
}

export async function getStudentProfile(codigo: string) {
  const student = await first<StudentGradeRow>(await sql`
    SELECT
      s."codigoEstudiante", s."nombre", s."apellido", s."idGrado", s."grupo",
      s."correo", s."fotoUrl", s."estado", s."createdAt", s."updatedAt",
      g."idGrado" AS "idGradoRel", g."nombre" AS "nombreGrado", g."nivel"
    FROM "Student" s
    LEFT JOIN "Grade" g ON g."idGrado" = s."idGrado"
    WHERE s."codigoEstudiante" = ${codigo}
    LIMIT 1
  ` as unknown as StudentGradeRow[]);

  if (!student) {
    throw new AppError(404, "STUDENT_NOT_FOUND", "No se encontró el estudiante");
  }

  const schedules = (await sql`
    SELECT ss."codigoEstudiante", ss."id", ss."codigoDisciplina", ss."diaSemana",
           d."nombre" AS "disciplinaNombre", d."descripcion" AS "disciplinaDescripcion",
           d."codigoDisciplina" AS "disciplinaCodigo"
    FROM "StudentSchedule" ss
    LEFT JOIN "Discipline" d ON d."codigoDisciplina" = ss."codigoDisciplina"
    WHERE ss."codigoEstudiante" = ${codigo}
    ORDER BY ss."diaSemana" ASC
  `) as unknown as Array<StudentScheduleDisciplineRow & { disciplinaCodigo: string }>;

  // Enrich each student schedule with offer info (teacher + schedule times)
  const extracurricular = await Promise.all(
    schedules.map(async (ss) => {
      const assignment = await first<any>(await sql`
        SELECT
          ea."idAsignacion",
          t."nombre" AS "profesorNombre", t."apellido" AS "profesorApellido",
          asch."id", asch."diaSemana" AS "schDia",
          sc."horaInicio", sc."horaFin"
        FROM "ExtracurricularAssignment" ea
        LEFT JOIN "Teacher" t ON t."idProfesor" = ea."idProfesor"
        LEFT JOIN "AssignmentSchedule" asch ON asch."idAsignacion" = ea."idAsignacion"
        LEFT JOIN "Schedule" sc ON sc."idHorario" = asch."idHorario"
        WHERE ea."codigoDisciplina" = ${ss.codigoDisciplina}
          AND ea."idGrado" = ${student.idGrado}
        LIMIT 1
      ` as unknown as any[]);

      let offerInfo: { profesor: string; horaInicio: string | null; horaFin: string | null } | null = null;
      if (assignment) {
        const daySchedule = assignment.schDia === ss.diaSemana || assignment.horaInicio != null;
        // Busca el schedule del día específico
        const dayRows = (await sql`
          SELECT sc."horaInicio", sc."horaFin"
          FROM "AssignmentSchedule" asch
          LEFT JOIN "Schedule" sc ON sc."idHorario" = asch."idHorario"
          WHERE asch."idAsignacion" = ${assignment.idAsignacion}
            AND sc."diaSemana" = ${ss.diaSemana}
          LIMIT 1
        `) as unknown as Array<{ horaInicio: string | null; horaFin: string | null }>;
        if (dayRows.length > 0) {
          offerInfo = {
            profesor: `${assignment.profesorNombre} ${assignment.profesorApellido}`,
            horaInicio: dayRows[0].horaInicio,
            horaFin: dayRows[0].horaFin,
          };
        }
      }

      return {
        dia: ss.diaSemana,
        disciplina: {
          codigo: ss.disciplinaCodigo,
          nombre: ss.disciplinaNombre,
        },
        oferta: offerInfo,
      };
    })
  );

  return {
    student: {
      codigoEstudiante: student.codigoEstudiante,
      nombre: student.nombre,
      apellido: student.apellido,
      grupo: student.grupo,
      grade: { idGrado: student.idGradoRel, nombre: student.nombreGrado, nivel: student.nivel },
      correo: student.correo,
      estado: student.estado,
      fotoUrl: student.fotoUrl,
    },
    extracurricular: extracurricular.length > 0 ? extracurricular : null,
  };
}
