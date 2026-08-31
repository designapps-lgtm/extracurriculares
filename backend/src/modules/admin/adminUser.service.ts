import { sql, first } from "../../config/db";
import bcrypt from "bcryptjs";
import { AppError } from "../../middlewares/errorHandler";

export interface AdminUserData {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  estado: string;
  createdAt: Date;
}

const ADMIN_COLUMNS = `"id", "email", "nombre", "apellido", "estado", "createdAt"`;

export async function listAdmins(): Promise<AdminUserData[]> {
  const rows = await sql(`SELECT ${ADMIN_COLUMNS} FROM "AdminUser" ORDER BY "createdAt" ASC`) as any[];
  return rows;
}

export async function createAdmin(data: { email: string; nombre?: string; apellido?: string; password: string }): Promise<AdminUserData> {
  const { email, nombre, apellido, password } = data;

  if (!email) throw new AppError(400, "VALIDATION_ERROR", "Email es requerido");

  if (!password || password.length < 6) {
    throw new AppError(400, "VALIDATION_ERROR", "La contraseña debe tener al menos 6 caracteres");
  }

  const existing = await first<any>(
    await sql`SELECT "id" FROM "AdminUser" WHERE "email" = ${email} LIMIT 1` as any[]
  );
  if (existing) throw new AppError(409, "DUPLICATE_EMAIL", "Ya existe un admin con ese email");

  const hash = await bcrypt.hash(password, 12);
  const rows = await sql(`INSERT INTO "AdminUser" ("id", "email", "passwordHash", "nombre", "apellido", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, now()) RETURNING ${ADMIN_COLUMNS}`, [email, hash, nombre || email.split("@")[0], apellido || ""]) as any[];
  return rows[0];
}

export async function updateAdmin(id: string, callerAdminId: string | undefined, data: { nombre?: string; apellido?: string; estado?: string }): Promise<AdminUserData> {
  const { nombre, apellido, estado } = data;

  const existing = await first<any>(
    await sql`SELECT "id", "estado" FROM "AdminUser" WHERE "id" = ${id} LIMIT 1` as any[]
  );
  if (!existing) throw new AppError(404, "ADMIN_NOT_FOUND", "No se encontró el admin");

  if (callerAdminId === id && estado === "inactivo") {
    throw new AppError(400, "CANNOT_DISABLE_SELF", "No puedes desactivarte a ti mismo");
  }

  if (estado === "inactivo") {
    const activeCountRows = await sql`SELECT COUNT(*)::int AS total FROM "AdminUser" WHERE "estado" = 'activo'` as any[];
    if ((activeCountRows[0]?.total ?? 0) <= 1) {
      throw new AppError(400, "LAST_ADMIN", "No se puede desactivar el último admin activo");
    }
  }

  const sets: string[] = [];
  const vals: any[] = [];
  let idx = 0;
  const add = (v: any) => { idx++; vals.push(v); return `$${idx}`; };

  if (nombre !== undefined) sets.push(`"nombre" = ${add(nombre)}`);
  if (apellido !== undefined) sets.push(`"apellido" = ${add(apellido)}`);
  if (estado !== undefined) sets.push(`"estado" = ${add(estado)}`);

  if (sets.length === 0) {
    const row = await first<any>(
      await sql(`SELECT ${ADMIN_COLUMNS} FROM "AdminUser" WHERE "id" = $1 LIMIT 1`, [id]) as any[]
    );
    return row!;
  }

  vals.push(id);
  const rows = await sql(
    `UPDATE "AdminUser" SET ${sets.join(", ")}, "updatedAt" = now() WHERE "id" = $${idx + 1} RETURNING ${ADMIN_COLUMNS}`,
    vals
  ) as any[];
  return rows[0];
}

export async function resetPassword(id: string, password: string): Promise<void> {
  if (!password || password.length < 6) {
    throw new AppError(400, "VALIDATION_ERROR", "La contraseña debe tener al menos 6 caracteres");
  }

  const admin = await first<any>(
    await sql`SELECT "id" FROM "AdminUser" WHERE "id" = ${id} LIMIT 1` as any[]
  );
  if (!admin) throw new AppError(404, "ADMIN_NOT_FOUND", "No se encontró el admin");

  const hash = await bcrypt.hash(password, 12);
  await sql`UPDATE "AdminUser" SET "passwordHash" = ${hash}, "updatedAt" = now() WHERE "id" = ${id}`;
}

export async function deleteAdmin(id: string, callerAdminId: string | undefined): Promise<void> {
  if (callerAdminId === id) {
    throw new AppError(400, "CANNOT_DELETE_SELF", "No puedes eliminarte a ti mismo");
  }

  const admin = await first<any>(
    await sql`SELECT "id", "estado" FROM "AdminUser" WHERE "id" = ${id} LIMIT 1` as any[]
  );
  if (!admin) throw new AppError(404, "ADMIN_NOT_FOUND", "No se encontró el admin");

  if (admin.estado === "activo") {
    const activeCountRows = await sql`SELECT COUNT(*)::int AS total FROM "AdminUser" WHERE "estado" = 'activo'` as any[];
    if ((activeCountRows[0]?.total ?? 0) <= 1) {
      throw new AppError(400, "LAST_ADMIN", "No se puede eliminar el último admin activo");
    }
  }

  await sql`DELETE FROM "AdminUser" WHERE "id" = ${id}`;
}
