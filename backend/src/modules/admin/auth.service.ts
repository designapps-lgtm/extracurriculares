import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../../config/prisma";
import { config } from "../../config";
import { AppError } from "../../middlewares/errorHandler";
import { ADMIN_AUTH_COOKIES } from "../../middlewares/auth";
import { createRefreshService } from "../../modules/auth/refreshTokens";

const adminRefresh = createRefreshService({
  userIdField: "adminId",
  refreshModel: prisma.adminRefreshToken as any,
  cookieNames: {
    access: ADMIN_AUTH_COOKIES.access,
    refresh: ADMIN_AUTH_COOKIES.refresh,
  },
  buildAccessToken: ({ id, email }) =>
    jwt.sign({ adminId: id, email }, config.jwtSecret, {
      expiresIn: config.accessTokenExpiresIn,
    } as jwt.SignOptions),
});

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

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

  await adminRefresh.issue(res, admin.id, admin.email);

  res.json({
    success: true,
    data: {
      admin: { id: admin.id, email: admin.email, nombre: admin.nombre, apellido: admin.apellido },
    },
  });
}

export async function refreshSession(req: Request, res: Response) {
  const adminId = await adminRefresh.rotate(req, res);

  const admin = await prisma.adminUser.findUnique({
    where: { id: adminId },
    select: { id: true, email: true, nombre: true, apellido: true, estado: true },
  });

  if (!admin || admin.estado !== "activo") {
    throw new AppError(403, "FORBIDDEN", "Acceso denegado");
  }

  res.json({
    success: true,
    data: {
      admin: { id: admin.id, email: admin.email, nombre: admin.nombre, apellido: admin.apellido },
    },
  });
}

export async function logout(_req: Request, res: Response) {
  await adminRefresh.revoke(_req, res);
  res.json({ success: true, data: { message: "Sesión cerrada" } });
}

export async function me(req: Request, res: Response) {
  if (!req.admin) {
    throw new AppError(401, "UNAUTHORIZED", "No autenticado");
  }

  const admin = await prisma.adminUser.findUnique({
    where: { id: req.admin.adminId },
    select: { id: true, email: true, nombre: true, apellido: true, estado: true },
  });

  if (!admin || admin.estado !== "activo") {
    throw new AppError(403, "FORBIDDEN", "Acceso denegado");
  }

  res.json({ success: true, data: admin });
}

export async function bootstrap(req: Request, res: Response) {
  const { email, password, nombre, apellido } = req.body;

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
  const admin = await prisma.adminUser.create({
    data: {
      email,
      passwordHash: hash,
      nombre: nombre || email.split("@")[0],
      apellido: apellido || "",
    },
    select: { id: true, email: true, nombre: true, apellido: true, estado: true },
  });

  await adminRefresh.issue(res, admin.id, admin.email);

  res.status(201).json({ success: true, data: { admin } });
}