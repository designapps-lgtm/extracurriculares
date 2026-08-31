import { sql, first } from "../../config/db";
import { AppError } from "../../middlewares/errorHandler";
import { PaginationParams, paginatedResult } from "../../utils/pagination";

const SELECT_COLS = `"idSupervisor", "codigoSupervisor", "nombre", "apellido", "correo", "fotoUrl", "estado", "createdAt", "updatedAt"`;

export async function getSupervisors(query: { search?: string }, pagination: PaginationParams) {
  const { search } = query;

  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 0;
  const next = (v: any): string => { idx++; params.push(v); return `$${idx}`; };

  if (search) {
    const p = next(`%${search}%`);
    conditions.push(`(s."nombre" ILIKE ${p} OR s."apellido" ILIKE ${p} OR s."correo" ILIKE ${p})`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const countRows = await sql(`SELECT COUNT(*)::int AS total FROM "Supervisor" s ${where}`, params) as any[];
  const total = countRows[0]?.total ?? 0;

  const offset = (pagination.page - 1) * pagination.limit;
  const lim = params.length + 1;
  const off = params.length + 2;
  const dataParams = [...params, pagination.limit, offset];

  const data = await sql(
    `SELECT ${SELECT_COLS} FROM "Supervisor" s ${where}
     ORDER BY s."apellido" ASC, s."nombre" ASC
     LIMIT $${lim} OFFSET $${off}`,
    dataParams
  ) as any[];

  return paginatedResult(data, total, pagination);
}

export async function getSupervisorById(id: string) {
  const row = await first<any>(
    await sql(`SELECT ${SELECT_COLS} FROM "Supervisor" WHERE "idSupervisor" = $1 LIMIT 1`, [id]) as any[]
  );
  if (!row) throw new AppError(404, "SUPERVISOR_NOT_FOUND", "No se encontró la supervisora");
  return row;
}

export async function createSupervisor(data: { codigoSupervisor?: string; nombre: string; apellido: string; correo?: string; fotoUrl?: string }) {
  const { codigoSupervisor, nombre, apellido, correo, fotoUrl } = data;

  if (!nombre || !apellido) {
    throw new AppError(400, "VALIDATION_ERROR", "Nombre y apellido son requeridos");
  }

  const rows = await sql(`INSERT INTO "Supervisor" ("idSupervisor", "codigoSupervisor", "nombre", "apellido", "correo", "fotoUrl", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, now()) RETURNING ${SELECT_COLS}`, [codigoSupervisor || null, nombre, apellido, correo || null, fotoUrl || null]) as any[];
  return rows[0];
}

export async function updateSupervisor(id: string, data: {
  codigoSupervisor?: string;
  nombre?: string;
  apellido?: string;
  correo?: string;
  fotoUrl?: string;
  estado?: string;
}) {
  const { codigoSupervisor, nombre, apellido, correo, fotoUrl, estado } = data;

  const existing = await first<any>(
    await sql`SELECT "idSupervisor" FROM "Supervisor" WHERE "idSupervisor" = ${id} LIMIT 1` as any[]
  );
  if (!existing) throw new AppError(404, "SUPERVISOR_NOT_FOUND", "No se encontró la supervisora");

  const sets: string[] = [];
  const vals: any[] = [];
  let idx = 0;
  const add = (v: any) => { idx++; vals.push(v); return `$${idx}`; };

  if (codigoSupervisor !== undefined) sets.push(`"codigoSupervisor" = ${add(codigoSupervisor)}`);
  if (nombre !== undefined) sets.push(`"nombre" = ${add(nombre)}`);
  if (apellido !== undefined) sets.push(`"apellido" = ${add(apellido)}`);
  if (correo !== undefined) sets.push(`"correo" = ${add(correo)}`);
  if (fotoUrl !== undefined) sets.push(`"fotoUrl" = ${add(fotoUrl)}`);
  if (estado !== undefined) sets.push(`"estado" = ${add(estado)}`);

  if (sets.length === 0) {
    return getSupervisorById(id);
  }

  vals.push(id);
  const rows = await sql(
    `UPDATE "Supervisor" SET ${sets.join(", ")}, "updatedAt" = now() WHERE "idSupervisor" = $${idx + 1} RETURNING ${SELECT_COLS}`,
    vals
  ) as any[];
  return rows[0];
}

export async function deleteSupervisor(id: string) {
  const existing = await first<any>(
    await sql`SELECT "idSupervisor" FROM "Supervisor" WHERE "idSupervisor" = ${id} LIMIT 1` as any[]
  );
  if (!existing) throw new AppError(404, "SUPERVISOR_NOT_FOUND", "No se encontró la supervisora");
  await sql`DELETE FROM "Supervisor" WHERE "idSupervisor" = ${id}`;
}
