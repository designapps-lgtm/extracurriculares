import { Request, Response } from "express";
import prisma from "../../config/prisma";
import bcrypt from "bcryptjs";
import { AppError } from "../../middlewares/errorHandler";

export async function listAdmins(_req: Request, res: Response) {
  const admins = await prisma.adminUser.findMany({
    select: { id: true, email: true, nombre: true, apellido: true, estado: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  res.json({ success: true, data: admins });
}

export async function createAdmin(req: Request, res: Response) {
  const { email, nombre, apellido, password } = req.body;

  if (!email) throw new AppError(400, "VALIDATION_ERROR", "Email es requerido");

  if (!password || password.length < 6) {
    throw new AppError(400, "VALIDATION_ERROR", "La contraseña debe tener al menos 6 caracteres");
  }

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) throw new AppError(409, "DUPLICATE_EMAIL", "Ya existe un admin con ese email");

  const hash = await bcrypt.hash(password, 12);
  const admin = await prisma.adminUser.create({
    data: {
      email,
      passwordHash: hash,
      nombre: nombre || email.split("@")[0],
      apellido: apellido || "",
    },
    select: { id: true, email: true, nombre: true, apellido: true, estado: true, createdAt: true },
  });

  res.status(201).json({ success: true, data: admin });
}

export async function updateAdmin(req: Request, res: Response) {
  const { id } = req.params;
  const { nombre, apellido, estado } = req.body;

  const admin = await prisma.adminUser.findUnique({ where: { id } });
  if (!admin) throw new AppError(404, "ADMIN_NOT_FOUND", "No se encontró el admin");

  // Prevent disabling yourself
  if (req.admin?.adminId === id && estado === "inactivo") {
    throw new AppError(400, "CANNOT_DISABLE_SELF", "No puedes desactivarte a ti mismo");
  }

  // Prevent last active admin from being disabled
  if (estado === "inactivo") {
    const activeCount = await prisma.adminUser.count({ where: { estado: "activo" } });
    if (activeCount <= 1) {
      throw new AppError(400, "LAST_ADMIN", "No se puede desactivar el último admin activo");
    }
  }

  const updated = await prisma.adminUser.update({
    where: { id },
    data: {
      ...(nombre !== undefined && { nombre }),
      ...(apellido !== undefined && { apellido }),
      ...(estado !== undefined && { estado }),
    },
    select: { id: true, email: true, nombre: true, apellido: true, estado: true, createdAt: true },
  });

  res.json({ success: true, data: updated });
}

export async function resetPassword(req: Request, res: Response) {
  const { id } = req.params;
  const { password } = req.body;

  if (!password || password.length < 6) {
    throw new AppError(400, "VALIDATION_ERROR", "La contraseña debe tener al menos 6 caracteres");
  }

  const admin = await prisma.adminUser.findUnique({ where: { id } });
  if (!admin) throw new AppError(404, "ADMIN_NOT_FOUND", "No se encontró el admin");

  const hash = await bcrypt.hash(password, 12);
  await prisma.adminUser.update({ where: { id }, data: { passwordHash: hash } });

  res.json({ success: true, data: { message: "Contraseña actualizada" } });
}

export async function deleteAdmin(req: Request, res: Response) {
  const { id } = req.params;

  // Prevent deleting yourself
  if (req.admin?.adminId === id) {
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
  res.json({ success: true, data: { message: "Admin eliminado" } });
}
