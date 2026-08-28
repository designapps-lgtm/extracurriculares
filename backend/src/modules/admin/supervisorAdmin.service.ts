import prisma from "../../config/prisma";
import { AppError } from "../../middlewares/errorHandler";
import { getOr404 } from "../../utils/getOr404";
import { PaginationParams, paginatedResult } from "../../utils/pagination";
import { Prisma } from "@prisma/client";

const supervisorAdminSelect = {
  idSupervisor: true,
  codigoSupervisor: true,
  nombre: true,
  apellido: true,
  correo: true,
  fotoUrl: true,
  estado: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function getSupervisors(query: { search?: string }, pagination: PaginationParams) {
  const { search } = query;

  const where: Prisma.SupervisorWhereInput = {};
  if (search) {
    where.OR = [
      { nombre: { contains: search, mode: "insensitive" } },
      { apellido: { contains: search, mode: "insensitive" } },
      { correo: { contains: search, mode: "insensitive" } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.supervisor.findMany({
      where,
      select: supervisorAdminSelect,
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
    }),
    prisma.supervisor.count({ where }),
  ]);

  return paginatedResult(data, total, pagination);
}

export async function getSupervisorById(id: string) {
  return getOr404(
    prisma.supervisor.findUnique({
      where: { idSupervisor: id },
      select: supervisorAdminSelect,
    }),
    "SUPERVISOR_NOT_FOUND",
    "No se encontró la supervisora",
  );
}

export async function createSupervisor(data: { codigoSupervisor?: string; nombre: string; apellido: string; correo?: string; fotoUrl?: string }) {
  const { codigoSupervisor, nombre, apellido, correo, fotoUrl } = data;

  if (!nombre || !apellido) {
    throw new AppError(400, "VALIDATION_ERROR", "Nombre y apellido son requeridos");
  }

  return prisma.supervisor.create({
    data: { codigoSupervisor, nombre, apellido, correo, fotoUrl },
    select: supervisorAdminSelect,
  });
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

  await getOr404(prisma.supervisor.findUnique({ where: { idSupervisor: id } }), "SUPERVISOR_NOT_FOUND", "No se encontró la supervisora");

  const updated = await prisma.supervisor.update({
    where: { idSupervisor: id },
    data: {
      ...(codigoSupervisor !== undefined && { codigoSupervisor }),
      ...(nombre !== undefined && { nombre }),
      ...(apellido !== undefined && { apellido }),
      ...(correo !== undefined && { correo }),
      ...(fotoUrl !== undefined && { fotoUrl }),
      ...(estado !== undefined && { estado }),
    },
    select: supervisorAdminSelect,
  });

  return updated;
}

export async function deleteSupervisor(id: string) {
  await getOr404(prisma.supervisor.findUnique({ where: { idSupervisor: id } }), "SUPERVISOR_NOT_FOUND", "No se encontró la supervisora");

  await prisma.supervisor.delete({ where: { idSupervisor: id } });
}