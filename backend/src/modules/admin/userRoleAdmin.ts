import { AppError } from "../../middlewares/errorHandler";
import { type PaginationParams, paginatedResult } from "../../utils/pagination";
import {
  createUser,
  getUserById,
  getUsers,
  removeUser,
  updateUser,
  type AppUser,
  type UserRole,
} from "../../db/domain";
import { matchesTokens, pageSlice } from "../../db/views";

export function rolePayload(user: AppUser): Record<string, unknown> {
  const common = {
    nombre: user.firstName,
    apellido: user.lastName,
    correo: user.email,
    fotoUrl: user.photoUrl,
    estado: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
  if (user.role === "teacher") return { idProfesor: user.id, codigoProfesor: user.code, ...common };
  if (user.role === "supervisor") return { idSupervisor: user.id, codigoSupervisor: user.code, ...common };
  if (user.role === "secretary") return { idSecretary: user.id, codigoSecretary: user.code, ...common };
  return { id: user.id, email: user.email, nombre: user.firstName, apellido: user.lastName, estado: user.status, createdAt: user.createdAt };
}

export async function listRole(role: UserRole, search: string | undefined, pagination: PaginationParams) {
  const rows = (await getUsers())
    .filter((user) => user.role === role)
    .filter((user) => matchesTokens([user.code, user.firstName, user.lastName, user.email], search))
    .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "es"));
  return paginatedResult(pageSlice(rows, pagination.page, pagination.limit).map(rolePayload), rows.length, pagination);
}

export async function getRoleUser(id: string, role: UserRole): Promise<AppUser> {
  const user = await getUserById(id, role, { fresh: true });
  if (!user) throw new AppError(404, `${role.toUpperCase()}_NOT_FOUND`, "No se encontró el usuario");
  return user;
}

export async function createRoleUser(role: UserRole, input: {
  code?: string | null;
  firstName: string;
  lastName: string;
  email?: string | null;
  photoUrl?: string | null;
}): Promise<Record<string, unknown>> {
  if (!input.firstName?.trim() || !input.lastName?.trim()) throw new AppError(400, "VALIDATION_ERROR", "Nombre y apellido son requeridos");
  if (!input.email?.trim()) throw new AppError(400, "EMAIL_REQUIRED", "El correo institucional es requerido para iniciar sesión con Google");
  const user = await createUser({
    role,
    code: input.code,
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    photoUrl: input.photoUrl,
  });
  return rolePayload(user);
}

export async function updateRoleUser(id: string, role: UserRole, input: {
  code?: string | null;
  firstName?: string;
  lastName?: string;
  email?: string;
  photoUrl?: string | null;
  status?: string;
}): Promise<Record<string, unknown>> {
  await getRoleUser(id, role);
  const user = await updateUser(id, input);
  return rolePayload(user);
}

export async function deleteRoleUser(id: string, role: UserRole): Promise<void> {
  await getRoleUser(id, role);
  await removeUser(id);
}
