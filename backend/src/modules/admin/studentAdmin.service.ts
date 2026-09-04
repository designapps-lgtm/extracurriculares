import { sql, first } from "../../config/db";
import { AppError } from "../../middlewares/errorHandler";
import { normalizeDay } from "../../utils/validators";
import { PaginationParams, paginatedResult } from "../../utils/pagination";

const VALID_DAYS = new Set(["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"]);

const ACCENT_FROM = "áéíóúüñÁÉÍÓÚÜÑ";
const ACCENT_TO = "aeiouunAEIOUUN";

function normalizedExpr(expr: string): string {
  return `LOWER(TRANSLATE(${expr}, '${ACCENT_FROM}', '${ACCENT_TO}'))`;
}

export async function getStudents(query: { search?: string; grado?: string; inscrito?: string }, pagination: PaginationParams) {
  const { search, grado, inscrito } = query;

  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 0;
  const next = (v: any): string => { idx++; params.push(v); return `$${idx}`; };

  if (search) {
    const fullName = normalizedExpr(`COALESCE(s."nombre", '') || ' ' || COALESCE(s."apellido", '')`);
    const code = normalizedExpr(`s."codigoEstudiante"`);
    const tokens = search.trim().split(/\s+/).filter(Boolean);
    const parts = tokens.map((token) => {
      const p = next(`%${token}%`);
      const normalizedPattern = normalizedExpr(p);
      return `(${fullName} LIKE ${normalizedPattern} OR ${code} LIKE ${normalizedPattern})`;
    });
    conditions.push(`(${parts.join(" AND ")})`);
  }

  if (grado) {
    const gradeRow = await first<{ idGrado: number }>(
      await sql`SELECT "idGrado" FROM "Grade" WHERE "nombre" = ${grado} LIMIT 1` as any[]
    );
    if (gradeRow) conditions.push(`s."idGrado" = ${next(gradeRow.idGrado)}`);
  }

  if (inscrito === "true") {
    conditions.push(`EXISTS (SELECT 1 FROM "StudentSchedule" ss WHERE ss."codigoEstudiante" = s."codigoEstudiante")`);
  } else if (inscrito === "false") {
    conditions.push(`NOT EXISTS (SELECT 1 FROM "StudentSchedule" ss WHERE ss."codigoEstudiante" = s."codigoEstudiante")`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const countRows = await sql(`SELECT COUNT(*)::int AS total FROM "Student" s ${where}`, params) as any[];
  const total = countRows[0]?.total ?? 0;

  const offset = (pagination.page - 1) * pagination.limit;
  const lim = params.length + 1;
  const off = params.length + 2;
  const dataParams = [...params, pagination.limit, offset];

  const students = await sql(
    `SELECT s."codigoEstudiante", s."nombre", s."apellido", s."idGrado", s."grupo",
            s."correo", s."fotoUrl", s."estado", s."createdAt", s."updatedAt",
            g."idGrado" AS "idGradoRel", g."nombre" AS "nombreGrado", g."nivel"
     FROM "Student" s
     LEFT JOIN "Grade" g ON g."idGrado" = s."idGrado"
     ${where}
     ORDER BY s."apellido" ASC, s."nombre" ASC
     LIMIT $${lim} OFFSET $${off}`,
    dataParams
  ) as any[];

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
      ) as any[])
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
  const student = await first<any>(
    await sql`SELECT s."codigoEstudiante", s."nombre", s."apellido", s."idGrado", s."grupo",
                     s."correo", s."fotoUrl", s."estado", s."createdAt", s."updatedAt",
                     g."idGrado" AS "idGradoRel", g."nombre" AS "nombreGrado", g."nivel"
              FROM "Student" s
              LEFT JOIN "Grade" g ON g."idGrado" = s."idGrado"
              WHERE s."codigoEstudiante" = ${codigo} LIMIT 1` as any[]
  );

  if (!student) throw new AppError(404, "STUDENT_NOT_FOUND", "No se encontró el estudiante");

  const schedules = await sql`
    SELECT ss."id", ss."codigoDisciplina", ss."diaSemana",
           d."nombre" AS "disciplinaNombre", d."descripcion" AS "disciplinaDescripcion"
    FROM "StudentSchedule" ss
    LEFT JOIN "Discipline" d ON d."codigoDisciplina" = ss."codigoDisciplina"
    WHERE ss."codigoEstudiante" = ${codigo}
    ORDER BY ss."diaSemana" ASC
  ` as any[];

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

export async function updateStudent(codigo: string, data: {
  nombre?: string;
  apellido?: string;
  idGrado?: number;
  grupo?: string;
  correo?: string;
  estado?: string;
  fotoUrl?: string;
  schedules?: { codigoDisciplina: string; diaSemana: string }[];
}) {
  const { nombre, apellido, idGrado, grupo, correo, estado, fotoUrl, schedules } = data;

  const student = await first<any>(
    await sql`SELECT "codigoEstudiante" FROM "Student" WHERE "codigoEstudiante" = ${codigo} LIMIT 1` as any[]
  );
  if (!student) throw new AppError(404, "STUDENT_NOT_FOUND", "No se encontró el estudiante");

  if (idGrado) {
    const grade = await first<any>(
      await sql`SELECT "idGrado" FROM "Grade" WHERE "idGrado" = ${idGrado} LIMIT 1` as any[]
    );
    if (!grade) throw new AppError(400, "INVALID_GRADE", "Grado no válido");
  }

  if (schedules !== undefined) {
    const seenDays = new Set<string>();
    for (const s of schedules) {
      const day = normalizeDay(s.diaSemana);
      if (!day || !VALID_DAYS.has(day)) {
        throw new AppError(400, "VALIDATION_ERROR", `Día inválido: ${s.diaSemana}`);
      }
      if (seenDays.has(day)) {
        throw new AppError(400, "VALIDATION_ERROR", `Día duplicado: ${s.diaSemana}`);
      }
      seenDays.add(day);
    }

    const codes = [...new Set(schedules.map((s) => s.codigoDisciplina))];
    const disciplines = await sql(
      `SELECT "codigoDisciplina" FROM "Discipline" WHERE "codigoDisciplina" = ANY($1) AND "estado" = 'activa'`,
      [codes]
    ) as any[];
    const activeCodes = new Set(disciplines.map((d) => d.codigoDisciplina));
    for (const code of codes) {
      if (!activeCodes.has(code)) {
        throw new AppError(400, "INVALID_DISCIPLINE", `Disciplina no encontrada o inactiva: ${code}`);
      }
    }
  }

  const fieldSets: Record<string, any> = {};
  if (nombre !== undefined) fieldSets["nombre"] = nombre;
  if (apellido !== undefined) fieldSets["apellido"] = apellido;
  if (idGrado !== undefined) fieldSets["idGrado"] = idGrado;
  if (grupo !== undefined) fieldSets["grupo"] = grupo;
  if (correo !== undefined) fieldSets["correo"] = correo;
  if (estado !== undefined) fieldSets["estado"] = estado;
  if (fotoUrl !== undefined) fieldSets["fotoUrl"] = fotoUrl;

  const hasFields = Object.keys(fieldSets).length > 0;
  const hasSchedules = schedules !== undefined;

  if (hasFields || hasSchedules) {
    await sql.transaction((tx) => {
      const ops: any[] = [];

      if (hasFields) {
        const cols = Object.keys(fieldSets);
        const setClause = cols.map((c, i) => `"${c}" = $${i + 1}`).join(", ");
        const params = cols.map((c) => fieldSets[c]);
        ops.push(tx(`UPDATE "Student" SET ${setClause}, "updatedAt" = now() WHERE "codigoEstudiante" = $${cols.length + 1}`, [...params, codigo]));
      }

      if (hasSchedules) {
        ops.push(tx`DELETE FROM "StudentSchedule" WHERE "codigoEstudiante" = ${codigo}`);
        for (const s of schedules!) {
          ops.push(tx`INSERT INTO "StudentSchedule" ("id", "codigoEstudiante", "codigoDisciplina", "diaSemana") VALUES (gen_random_uuid(), ${codigo}, ${s.codigoDisciplina}, ${normalizeDay(s.diaSemana) || s.diaSemana})`);
        }
      }

      return ops;
    });
  }

  return getStudentByCode(codigo);
}
