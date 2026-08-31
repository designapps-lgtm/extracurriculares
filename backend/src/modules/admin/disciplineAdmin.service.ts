import { sql, first } from "../../config/db";
import { PaginationParams, paginatedResult } from "../../utils/pagination";

export async function getDisciplines(query: { search?: string }, pagination: PaginationParams) {
  const { search } = query;

  const conditions: string[] = [];
  const params: any[] = [];

  let idx = 0;
  const next = (v: any): string => { idx++; params.push(v); return `$${idx}`; };

  if (search) {
    const p = next(`%${search}%`);
    conditions.push(`(d."codigoDisciplina" ILIKE ${p} OR d."nombre" ILIKE ${p})`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const countRows = await sql(`SELECT COUNT(*)::int AS total FROM "Discipline" d ${where}`, params) as any[];
  const total = countRows[0]?.total ?? 0;

  const offset = (pagination.page - 1) * pagination.limit;
  const lim = params.length + 1;
  const off = params.length + 2;
  const dataParams = [...params, pagination.limit, offset];

  const rows = await sql(
    `SELECT d."codigoDisciplina", d."nombre", d."descripcion", d."estado", d."createdAt", d."updatedAt"
     FROM "Discipline" d ${where}
     ORDER BY d."nombre" ASC
     LIMIT $${lim} OFFSET $${off}`,
    dataParams
  ) as any[];

  const codes = rows.map((r) => r.codigoDisciplina);

  let counts: Record<string, { studentSchedules: number; assignments: number }> = {};
  if (codes.length > 0) {
    const countRows = await sql(
      `SELECT "codigoDisciplina",
              COUNT(*) FILTER (WHERE t = 'ss')::int AS "studentSchedulesCount",
              COUNT(*) FILTER (WHERE t = 'ea')::int AS "assignmentsCount"
       FROM (
         SELECT "codigoDisciplina", 'ss' AS t FROM "StudentSchedule" WHERE "codigoDisciplina" = ANY($1)
         UNION ALL
         SELECT "codigoDisciplina", 'ea' AS t FROM "ExtracurricularAssignment" WHERE "codigoDisciplina" = ANY($1)
       ) sub
       GROUP BY "codigoDisciplina"`,
      [codes]
    ) as any[];
    for (const c of countRows) {
      counts[c.codigoDisciplina] = { studentSchedules: c.studentSchedulesCount, assignments: c.assignmentsCount };
    }
  }

  const data = rows.map((r) => ({
    codigoDisciplina: r.codigoDisciplina,
    nombre: r.nombre,
    descripcion: r.descripcion,
    estado: r.estado,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    _count: counts[r.codigoDisciplina] ?? { studentSchedules: 0, assignments: 0 },
  }));

  return paginatedResult(data, total, pagination);
}
