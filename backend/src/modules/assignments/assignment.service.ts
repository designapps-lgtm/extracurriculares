import { sql, first } from "../../config/db";
import { AppError } from "../../middlewares/errorHandler";
import { PaginationParams, PaginatedResult, paginatedResult } from "../../utils/pagination";
import { AssignmentQuery } from "./assignment.types";
import { ASSIGNMENT_SELECT, buildAssignmentList, AssignmentRow } from "../../utils/assignmentQueries";

export async function getAssignments(query: AssignmentQuery, pagination: PaginationParams): Promise<PaginatedResult<any>> {
  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 0;
  const next = (v: any): string => { idx++; params.push(v); return `$${idx}`; };

  if (query.grado) {
    const grade = await first<{ idGrado: number }>(
      await sql`SELECT "idGrado" FROM "Grade" WHERE "nombre" = ${query.grado} LIMIT 1` as unknown as { idGrado: number }[]
    );
    if (grade) conditions.push(`ea."idGrado" = ${next(grade.idGrado)}`);
  }

  if (query.disciplina) conditions.push(`ea."codigoDisciplina" = ${next(query.disciplina)}`);
  if (query.profesor) conditions.push(`ea."idProfesor" = ${next(query.profesor)}`);

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countRows = await sql(
    `SELECT COUNT(*)::int AS total FROM "ExtracurricularAssignment" ea ${where}`,
    params
  ) as unknown as Array<{ total: number }>;
  const total = countRows[0]?.total ?? 0;

  const offset = (pagination.page - 1) * pagination.limit;
  const lim = params.length + 1;
  const off = params.length + 2;
  const dataParams = [...params, pagination.limit, offset];

  const rows = await sql(
    `SELECT ${ASSIGNMENT_SELECT},
            t."nombre" AS "profesorNombre", t."apellido" AS "profesorApellido",
            d."nombre" AS "disciplinaNombre",
            g."nombre" AS "gradoNombre"
     FROM "ExtracurricularAssignment" ea
     LEFT JOIN "Teacher" t ON t."idProfesor" = ea."idProfesor"
     LEFT JOIN "Discipline" d ON d."codigoDisciplina" = ea."codigoDisciplina"
     LEFT JOIN "Grade" g ON g."idGrado" = ea."idGrado"
     ${where}
     ORDER BY ea."createdAt" ASC
     LIMIT $${lim} OFFSET $${off}`,
    dataParams
  ) as unknown as AssignmentRow[];

  const data = await buildAssignmentList(rows);
  return paginatedResult(data, total, pagination);
}

export async function getAssignmentById(id: string) {
  const row = await first<AssignmentRow>(
    await sql(
      `SELECT ${ASSIGNMENT_SELECT},
              t."nombre" AS "profesorNombre", t."apellido" AS "profesorApellido",
              d."nombre" AS "disciplinaNombre",
              g."nombre" AS "gradoNombre"
       FROM "ExtracurricularAssignment" ea
       LEFT JOIN "Teacher" t ON t."idProfesor" = ea."idProfesor"
       LEFT JOIN "Discipline" d ON d."codigoDisciplina" = ea."codigoDisciplina"
       LEFT JOIN "Grade" g ON g."idGrado" = ea."idGrado"
       WHERE ea."idAsignacion" = $1 LIMIT 1`,
      [id]
    ) as unknown as AssignmentRow[]
  );

  if (!row) {
    throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "No se encontró la asignación");
  }

  const [result] = await buildAssignmentList([row]);
  return result;
}
