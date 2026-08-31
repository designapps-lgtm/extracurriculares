import bcrypt from "bcryptjs";
import { sql, first } from "../../config/db";
import { AppError } from "../../middlewares/errorHandler";

export interface AdminSessionData {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  estado: string;
}

export async function login(email: string, password: string): Promise<AdminSessionData> {
  if (!email || !password) {
    throw new AppError(400, "VALIDATION_ERROR", "Email y contraseña son requeridos");
  }

  const rows = await sql`SELECT * FROM "AdminUser" WHERE "email" = ${email} LIMIT 1`;
  const admin = rows[0] ?? null;

  if (!admin) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Credenciales inválidas");
  }

  if (admin.estado !== "activo") {
    throw new AppError(403, "ACCOUNT_DISABLED", "Cuenta deshabilitada");
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Credenciales inválidas");
  }

  return { id: admin.id, email: admin.email, nombre: admin.nombre, apellido: admin.apellido, estado: admin.estado };
}

export async function getAdminById(adminId: string): Promise<AdminSessionData> {
  const admin = await first<AdminSessionData>(await sql`SELECT "id", "email", "nombre", "apellido", "estado" FROM "AdminUser" WHERE "id" = ${adminId} LIMIT 1` as unknown as AdminSessionData[]);

  if (!admin || admin.estado !== "activo") {
    throw new AppError(403, "FORBIDDEN", "Acceso denegado");
  }

  return admin;
}

export async function bootstrap(data: {
  email: string;
  password: string;
  nombre?: string;
  apellido?: string;
}): Promise<AdminSessionData> {
  const { email, password, nombre, apellido } = data;

  if (!email || !password) {
    throw new AppError(400, "VALIDATION_ERROR", "Email y contraseña son requeridos");
  }

  if (password.length < 6) {
    throw new AppError(400, "VALIDATION_ERROR", "La contraseña debe tener al menos 6 caracteres");
  }

  const countRows = await sql`SELECT COUNT(*)::int AS total FROM "AdminUser"`;
  const adminCount = countRows[0]?.total ?? 0;
  if (adminCount > 0) {
    throw new AppError(403, "BOOTSTRAP_UNAVAILABLE", "Ya existe un administrador. Use el panel para gestionar.");
  }

  const hash = await bcrypt.hash(password, 12);
  const createdRows = await sql`
    INSERT INTO "AdminUser" ("id", "email", "passwordHash", "nombre", "apellido", "estado", "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), ${email}, ${hash}, ${nombre || email.split("@")[0]}, ${apellido || ""}, 'activo', now(), now())
    RETURNING "id", "email", "nombre", "apellido", "estado"
  ` as unknown as AdminSessionData[];
  return createdRows[0];
}
