import type { PaginationParams } from "../../utils/pagination";
import { createRoleUser, deleteRoleUser, getRoleUser, listRole, rolePayload, updateRoleUser } from "./userRoleAdmin";

export function getSupervisors(query: { search?: string }, pagination: PaginationParams) {
  return listRole("supervisor", query.search, pagination);
}
export async function getSupervisorById(id: string) { return rolePayload(await getRoleUser(id, "supervisor")); }
export function createSupervisor(input: { codigoSupervisor?: string; nombre: string; apellido: string; correo?: string; fotoUrl?: string }) {
  return createRoleUser("supervisor", { code: input.codigoSupervisor, firstName: input.nombre, lastName: input.apellido, email: input.correo, photoUrl: input.fotoUrl });
}
export function updateSupervisor(id: string, input: { codigoSupervisor?: string; nombre?: string; apellido?: string; correo?: string; fotoUrl?: string; estado?: string }) {
  return updateRoleUser(id, "supervisor", { code: input.codigoSupervisor, firstName: input.nombre, lastName: input.apellido, email: input.correo, photoUrl: input.fotoUrl, status: input.estado });
}
export function deleteSupervisor(id: string) { return deleteRoleUser(id, "supervisor"); }
