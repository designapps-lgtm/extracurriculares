import { sql, first } from "../../config/db";
import { AppError } from "../../middlewares/errorHandler";
import { PaginationParams, paginatedResult } from "../../utils/pagination";

const TEACHER_SELECT = `"idProfesor", "codigoProfesor", "nombre", "apellido", "correo", "fotoUrl", "estado", "createdAt", "updatedAt"`;

export async function getTeachers(query: { search?: string }, pagination: PaginationParams) {
  const { search } = query;

  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 0;
  const next = (v: any): string => { idx++; params.push(v); return `$${idx}`; };

  if (search) {
    const p = next(`%${search}%`);
    conditions.push(`(t."nombre" ILIKE ${p} OR t."apellido" ILIKE ${p} OR t."correo" ILIKE ${p})`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const countRows = await sql(`SELECT COUNT(*)::int AS total FROM "Teacher" t ${where}`, params) as any[];
  const total = countRows[0]?.total ?? 0;

  const offset = (pagination.page - 1) * pagination.limit;
  const lim = params.length + 1;
  const off = params.length + 2;
  const dataParams = [...params, pagination.limit, offset];

  const rows = await sql(
    `SELECT ${TEACHER_SELECT}
     FROM "Teacher" t ${where}
     ORDER BY t."apellido" ASC, t."nombre" ASC
     LIMIT $${lim} OFFSET $${off}`,
    dataParams
  ) as any[];

  const ids = rows.map((r) => r.idProfesor);
  let assignmentCounts: Record<string, number> = {};
  if (ids.length > 0) {
    const cntRows = await sql(
      `SELECT "idProfesor", COUNT(*)::int AS count FROM "ExtracurricularAssignment" WHERE "idProfesor" = ANY($1) GROUP BY "idProfesor"`,
      [ids]
    ) as any[];
    for (const c of cntRows) assignmentCounts[c.idProfesor] = c.count;
  }

  const data = rows.map((r) => ({
    ...r,
    _count: { assignments: assignmentCounts[r.idProfesor] ?? 0 },
  }));

  return paginatedResult(data, total, pagination);
}

export async function getTeacherById(id: string) {
  const row = await first<any>(
    await sql(`SELECT ${TEACHER_SELECT} FROM "Teacher" WHERE "idProfesor" = $1 LIMIT 1`, [id]) as any[]
  );
  if (!row) throw new AppError(404, "TEACHER_NOT_FOUND", "No se encontró el profesor");

  const cntRows = await sql`SELECT COUNT(*)::int AS count FROM "ExtracurricularAssignment" WHERE "idProfesor" = ${id}` as any[];

  return { ...row, _count: { assignments: cntRows[0]?.count ?? 0 } };
}

export async function createTeacher(data: { nombre: string; apellido: string; correo?: string; fotoUrl?: string }) {
  const { nombre, apellido, correo, fotoUrl } = data;

  if (!nombre || !apellido) {
    throw new AppError(400, "VALIDATION_ERROR", "Nombre y apellido son requeridos");
  }

  const rows = await sql(`INSERT INTO "Teacher" ("idProfesor", "nombre", "apellido", "correo", "fotoUrl") VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING ${TEACHER_SELECT}`, [nombre, apellido, correo || null, fotoUrl || null]) as any[];
  return rows[0];
}

export async function updateTeacher(id: string, data: {
  nombre?: string;
  apellido?: string;
  correo?: string;
  fotoUrl?: string;
  estado?: string;
}) {
  const { nombre, apellido, correo, fotoUrl, estado } = data;

  const teacher = await first<any>(
    await sql`SELECT "idProfesor", "estado" FROM "Teacher" WHERE "idProfesor" = ${id} LIMIT 1` as any[]
  );
  if (!teacher) throw new AppError(404, "TEACHER_NOT_FOUND", "No se encontró el profesor");

  if (estado === "inactivo" && teacher.estado !== "inactivo") {
    const cntRows = await sql`SELECT COUNT(*)::int AS count FROM "ExtracurricularAssignment" WHERE "idProfesor" = ${id} AND "estado" = 'activo'` as any[];
    if ((cntRows[0]?.count ?? 0) > 0) {
      throw new AppError(400, "HAS_ACTIVE_ASSIGNMENTS", "No se puede desactivar un profesor con asignaciones activas");
    }
  }

  const sets: string[] = [];
  const vals: any[] = [];
  let idx = 0;
  const add = (v: any) => { idx++; vals.push(v); return `$${idx}`; };

  if (nombre !== undefined) sets.push(`"nombre" = ${add(nombre)}`);
  if (apellido !== undefined) sets.push(`"apellido" = ${add(apellido)}`);
  if (correo !== undefined) sets.push(`"correo" = ${add(correo)}`);
  if (fotoUrl !== undefined) sets.push(`"fotoUrl" = ${add(fotoUrl)}`);
  if (estado !== undefined) sets.push(`"estado" = ${add(estado)}`);

  if (sets.length === 0) {
    return getTeacherById(id);
  }

  vals.push(id);
  const rows = await sql(
    `UPDATE "Teacher" SET ${sets.join(", ")}, "updatedAt" = now() WHERE "idProfesor" = $${idx + 1} RETURNING ${TEACHER_SELECT}`,
    vals
  ) as any[];

  const cntRows = await sql`SELECT COUNT(*)::int AS count FROM "ExtracurricularAssignment" WHERE "idProfesor" = ${id}` as any[];
  return { ...rows[0], _count: { assignments: cntRows[0]?.count ?? 0 } };
}

export async function deleteTeacher(id: string) {
  const teacher = await first<any>(
    await sql`SELECT "idProfesor" FROM "Teacher" WHERE "idProfesor" = ${id} LIMIT 1` as any[]
  );
  if (!teacher) throw new AppError(404, "TEACHER_NOT_FOUND", "No se encontró el profesor");

  const cntRows = await sql`SELECT COUNT(*)::int AS count FROM "ExtracurricularAssignment" WHERE "idProfesor" = ${id} AND "estado" = 'activo'` as any[];
  if ((cntRows[0]?.count ?? 0) > 0) {
    throw new AppError(400, "HAS_ACTIVE_ASSIGNMENTS", "No se puede eliminar un profesor con asignaciones activas");
  }

  await sql`DELETE FROM "Teacher" WHERE "idProfesor" = ${id}`;
}
