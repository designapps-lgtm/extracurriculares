import { AppError } from "../../middlewares/errorHandler";
import { createUser, getUserById, getUsers, removeUser, updateUser } from "../appsheet/appsheet.domain";
import { rolePayload } from "./userRoleAdmin";

export interface AdminUserData {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  estado: string;
  createdAt: string | null;
}

export async function listAdmins(): Promise<AdminUserData[]> {
  return (await getUsers())
    .filter((user) => user.role === "admin")
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""))
    .map((user) => rolePayload(user) as unknown as AdminUserData);
}

export async function createAdmin(input: { email: string; nombre?: string; apellido?: string; password?: string }): Promise<AdminUserData> {
  if (!input.email?.trim()) throw new AppError(400, "VALIDATION_ERROR", "Email es requerido");
  const user = await createUser({
    role: "admin",
    email: input.email,
    firstName: input.nombre?.trim() || input.email.split("@")[0],
    lastName: input.apellido?.trim() || "",
  });
  return rolePayload(user) as unknown as AdminUserData;
}

export async function updateAdmin(id: string, callerAdminId: string | undefined, input: { nombre?: string; apellido?: string; estado?: string }): Promise<AdminUserData> {
  const current = await getUserById(id, "admin", { fresh: true });
  if (!current) throw new AppError(404, "ADMIN_NOT_FOUND", "No se encontró el admin");
  if (callerAdminId === id && input.estado === "inactivo") throw new AppError(400, "CANNOT_DISABLE_SELF", "No puedes desactivarte a ti mismo");
  if (input.estado === "inactivo") {
    const active = (await getUsers()).filter((user) => user.role === "admin" && user.active);
    if (active.length <= 1) throw new AppError(400, "LAST_ADMIN", "No se puede desactivar el último admin activo");
  }
  const user = await updateUser(id, { firstName: input.nombre, lastName: input.apellido, status: input.estado });
  return rolePayload(user) as unknown as AdminUserData;
}

export async function resetPassword(_id: string, _password: string): Promise<void> {
  throw new AppError(410, "PASSWORD_AUTH_REMOVED", "No existen contraseñas locales; el acceso se realiza con Google.");
}

export async function deleteAdmin(id: string, callerAdminId: string | undefined): Promise<void> {
  if (callerAdminId === id) throw new AppError(400, "CANNOT_DELETE_SELF", "No puedes eliminarte a ti mismo");
  const admin = await getUserById(id, "admin", { fresh: true });
  if (!admin) throw new AppError(404, "ADMIN_NOT_FOUND", "No se encontró el admin");
  const active = (await getUsers()).filter((user) => user.role === "admin" && user.active);
  if (admin.active && active.length <= 1) throw new AppError(400, "LAST_ADMIN", "No se puede eliminar el último admin activo");
  await removeUser(id);
}
