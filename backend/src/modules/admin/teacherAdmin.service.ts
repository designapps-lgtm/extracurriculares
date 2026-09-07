import { AppError } from "../../middlewares/errorHandler";
import type { PaginationParams } from "../../utils/pagination";
import { loadCoreData } from "../appsheet/appsheet.views";
import * as teacherService from "../teachers/teacher.service";
import { createRoleUser, deleteRoleUser, rolePayload, updateRoleUser } from "./userRoleAdmin";

export function getTeachers(query: { search?: string }, pagination: PaginationParams) {
  return teacherService.getTeachers(query, pagination);
}

export function getTeacherById(id: string) {
  return teacherService.getTeacherById(id);
}

export function createTeacher(input: { nombre: string; apellido: string; correo?: string; fotoUrl?: string }) {
  return createRoleUser("teacher", { firstName: input.nombre, lastName: input.apellido, email: input.correo, photoUrl: input.fotoUrl });
}

export async function updateTeacher(id: string, input: { nombre?: string; apellido?: string; correo?: string; fotoUrl?: string; estado?: string }) {
  const updated = await updateRoleUser(id, "teacher", {
    firstName: input.nombre,
    lastName: input.apellido,
    email: input.correo,
    photoUrl: input.fotoUrl,
    status: input.estado,
  });
  const data = await loadCoreData({ fresh: true });
  return { ...updated, _count: { assignments: data.assignments.filter((row) => row.teacherId === id).length } };
}

export async function deleteTeacher(id: string): Promise<void> {
  const data = await loadCoreData({ fresh: true });
  if (data.assignments.some((row) => row.teacherId === id)) {
    throw new AppError(409, "TEACHER_HAS_ASSIGNMENTS", "El profesor tiene horarios asignados. Elimine sus asignaciones antes de borrar la cuenta.");
  }
  await deleteRoleUser(id, "teacher");
}
