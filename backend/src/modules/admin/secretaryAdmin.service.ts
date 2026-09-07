import type { PaginationParams } from "../../utils/pagination";
import { createRoleUser, deleteRoleUser, getRoleUser, listRole, rolePayload, updateRoleUser } from "./userRoleAdmin";

export function getSecretaries(query: { search?: string }, pagination: PaginationParams) {
  return listRole("secretary", query.search, pagination);
}
export async function getSecretaryById(id: string) { return rolePayload(await getRoleUser(id, "secretary")); }
export function createSecretary(input: { codigoSecretary?: string; nombre: string; apellido: string; correo?: string; fotoUrl?: string }) {
  return createRoleUser("secretary", { code: input.codigoSecretary, firstName: input.nombre, lastName: input.apellido, email: input.correo, photoUrl: input.fotoUrl });
}
export function updateSecretary(id: string, input: { codigoSecretary?: string; nombre?: string; apellido?: string; correo?: string; fotoUrl?: string; estado?: string }) {
  return updateRoleUser(id, "secretary", { code: input.codigoSecretary, firstName: input.nombre, lastName: input.apellido, email: input.correo, photoUrl: input.fotoUrl, status: input.estado });
}
export function deleteSecretary(id: string) { return deleteRoleUser(id, "secretary"); }
