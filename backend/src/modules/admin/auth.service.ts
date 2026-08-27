import bcrypt from "bcryptjs";
import prisma from "../../config/prisma";
import { AppError } from "../../middlewares/errorHandler";

export interface AdminSessionData {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  estado: string;
}

const adminSessionSelect = {
  id: true,
  email: true,
  nombre: true,
  apellido: true,
  estado: true,
} as const;

export async function login(email: string, password: string): Promise<AdminSessionData> {
  if (!email || !password) {
    throw new AppError(400, "VALIDATION_ERROR", "Email y contraseña son requeridos");
  }

  const admin = await prisma.adminUser.findUnique({ where: { email } });
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
  const admin = await prisma.adminUser.findUnique({
    where: { id: adminId },
    select: adminSessionSelect,
  });

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

  const adminCount = await prisma.adminUser.count();
  if (adminCount > 0) {
    throw new AppError(403, "BOOTSTRAP_UNAVAILABLE", "Ya existe un administrador. Use el panel para gestionar.");
  }

  const hash = await bcrypt.hash(password, 12);
  return prisma.adminUser.create({
    data: {
      email,
      passwordHash: hash,
      nombre: nombre || email.split("@")[0],
      apellido: apellido || "",
    },
    select: adminSessionSelect,
  });
}