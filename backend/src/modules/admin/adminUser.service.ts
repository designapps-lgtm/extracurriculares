import prisma from "../../config/prisma";
import bcrypt from "bcryptjs";
import { AppError } from "../../middlewares/errorHandler";
import { getOr404 } from "../../utils/getOr404";

export interface AdminUserData {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  estado: string;
  createdAt: Date;
}

const adminSelect = {
  id: true,
  email: true,
  nombre: true,
  apellido: true,
  estado: true,
  createdAt: true,
} as const;

export async function listAdmins(): Promise<AdminUserData[]> {
  return prisma.adminUser.findMany({
    select: adminSelect,
    orderBy: { createdAt: "asc" },
  });
}

export async function createAdmin(data: { email: string; nombre?: string; apellido?: string; password: string }): Promise<AdminUserData> {
  const { email, nombre, apellido, password } = data;

  if (!email) throw new AppError(400, "VALIDATION_ERROR", "Email es requerido");

  if (!password || password.length < 6) {
    throw new AppError(400, "VALIDATION_ERROR", "La contraseña debe tener al menos 6 caracteres");
  }

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) throw new AppError(409, "DUPLICATE_EMAIL", "Ya existe un admin con ese email");

  const hash = await bcrypt.hash(password, 12);
  return prisma.adminUser.create({
    data: {
      email,
      passwordHash: hash,
      nombre: nombre || email.split("@")[0],
      apellido: apellido || "",
    },
    select: adminSelect,
  });
}

export async function updateAdmin(id: string, callerAdminId: string | undefined, data: { nombre?: string; apellido?: string; estado?: string }): Promise<AdminUserData> {
  const { nombre, apellido, estado } = data;

  await getOr404(prisma.adminUser.findUnique({ where: { id } }), "ADMIN_NOT_FOUND", "No se encontró el admin");

  // Prevent disabling yourself
  if (callerAdminId === id && estado === "inactivo") {
    throw new AppError(400, "CANNOT_DISABLE_SELF", "No puedes desactivarte a ti mismo");
  }

  // Prevent last active admin from being disabled
  if (estado === "inactivo") {
    const activeCount = await prisma.adminUser.count({ where: { estado: "activo" } });
    if (activeCount <= 1) {
      throw new AppError(400, "LAST_ADMIN", "No se puede desactivar el último admin activo");
    }
  }

  return prisma.adminUser.update({
    where: { id },
    data: {
      ...(nombre !== undefined && { nombre }),
      ...(apellido !== undefined && { apellido }),
      ...(estado !== undefined && { estado }),
    },
    select: adminSelect,
  });
}

export async function resetPassword(id: string, password: string): Promise<void> {
  if (!password || password.length < 6) {
    throw new AppError(400, "VALIDATION_ERROR", "La contraseña debe tener al menos 6 caracteres");
  }

  await getOr404(prisma.adminUser.findUnique({ where: { id } }), "ADMIN_NOT_FOUND", "No se encontró el admin");

  const hash = await bcrypt.hash(password, 12);
  await prisma.adminUser.update({ where: { id }, data: { passwordHash: hash } });
}

export async function deleteAdmin(id: string, callerAdminId: string | undefined): Promise<void> {
  // Prevent deleting yourself
  if (callerAdminId === id) {
    throw new AppError(400, "CANNOT_DELETE_SELF", "No puedes eliminarte a ti mismo");
  }

  const admin = await prisma.adminUser.findUnique({ where: { id } });
  if (!admin) throw new AppError(404, "ADMIN_NOT_FOUND", "No se encontró el admin");

  // Prevent last active admin from being deleted
  if (admin.estado === "activo") {
    const activeCount = await prisma.adminUser.count({ where: { estado: "activo" } });
    if (activeCount <= 1) {
      throw new AppError(400, "LAST_ADMIN", "No se puede eliminar el último admin activo");
    }
  }

  await prisma.adminUser.delete({ where: { id } });
}