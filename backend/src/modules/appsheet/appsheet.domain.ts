import crypto from "crypto";
import { nowIso, normalizeDateOnly, normalizeDayName } from "../../utils/colombiaTime";
import {
  APPSHEET_TABLES,
  addRows,
  cell,
  deleteRows,
  editRows,
  getTableRows,
  isActiveValue,
  normalizeSearch,
  nullableTextCell,
  numberCell,
  textCell,
  yesNoCell,
} from "./appsheet.repository";
import type { AppSheetRow } from "./appsheet.service";

export type UserRole = "admin" | "teacher" | "supervisor" | "secretary";

export interface UserPermissions {
  canViewStudents: boolean;
  canManageNews: boolean;
  canManageAttendance: boolean;
  canManageSchedules: boolean;
  canAdministerUsers: boolean;
}

export interface AppUser {
  id: string;
  role: UserRole;
  code: string | null;
  email: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  status: string;
  active: boolean;
  permissions: UserPermissions;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AppGrade {
  id: number;
  name: string;
  level: string | null;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AppSchedule {
  id: string;
  day: string;
  startTime: string | null;
  endTime: string | null;
  classroom: string | null;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AppStudent {
  code: string;
  firstName: string;
  lastName: string;
  gradeId: number;
  gradeName: string;
  group: string | null;
  email: string | null;
  photoUrl: string | null;
  sourceStatus: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AppEnrollment {
  id: string;
  studentCode: string;
  disciplineCode: string;
  day: string;
  status: string;
  active: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AppAssignment {
  id: string;
  teacherId: string;
  teacherEmail: string | null;
  disciplineCode: string;
  gradeId: number;
  primary: boolean;
  status: string;
  scheduleIds: string[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AppAttendance {
  id: string;
  sessionId: string;
  studentCode: string;
  status: string;
  registeredAt: string | null;
  registeredByType: string | null;
  registeredById: string | null;
  observation: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AppStay {
  id: string;
  assignmentId: string;
  scheduleId: string;
  studentCode: string;
  date: string;
  supervisorId: string | null;
  createdAt: string | null;
}

function parseRole(value: string): UserRole | null {
  const role = normalizeSearch(value);
  if (role === "admin" || role === "teacher" || role === "supervisor" || role === "secretary") return role;
  return null;
}

function mapUser(row: AppSheetRow): AppUser | null {
  const id = textCell(row, "UsuarioID");
  const email = textCell(row, "Correo").toLowerCase();
  const role = parseRole(textCell(row, "TipoUsuario"));
  if (!id || !email || !role) return null;
  const status = textCell(row, "Estado") || "activo";
  return {
    id,
    role,
    code: nullableTextCell(row, "CodigoUsuario"),
    email,
    firstName: textCell(row, "Nombre"),
    lastName: textCell(row, "Apellido"),
    photoUrl: nullableTextCell(row, "FotoUrl"),
    status,
    active: isActiveValue(status),
    permissions: {
      canViewStudents: yesNoCell(row, "PuedeVerEstudiantes"),
      canManageNews: yesNoCell(row, "PuedeGestionarNovedades"),
      canManageAttendance: yesNoCell(row, "PuedeGestionarAsistencia"),
      canManageSchedules: yesNoCell(row, "PuedeGestionarHorarios"),
      canAdministerUsers: yesNoCell(row, "PuedeAdministrarUsuarios"),
    },
    createdAt: nullableTextCell(row, "CreatedAt"),
    updatedAt: nullableTextCell(row, "UpdatedAt"),
  };
}

export async function getUsers(options: { fresh?: boolean } = {}): Promise<AppUser[]> {
  return (await getTableRows(APPSHEET_TABLES.users, options)).map(mapUser).filter((row): row is AppUser => row !== null);
}

export async function getUsersByEmail(email: string, options: { fresh?: boolean } = {}): Promise<AppUser[]> {
  const normalized = email.trim().toLowerCase();
  return (await getUsers(options)).filter((user) => user.email === normalized);
}

export async function getUserByEmail(email: string, options: { fresh?: boolean } = {}): Promise<AppUser | null> {
  return (await getUsersByEmail(email, options))[0] ?? null;
}

export async function getUserById(id: string, role?: UserRole, options: { fresh?: boolean } = {}): Promise<AppUser | null> {
  return (await getUsers(options)).find((user) => user.id === id && (!role || user.role === role)) ?? null;
}

function permissionDefaults(role: UserRole): UserPermissions {
  if (role === "admin") return { canViewStudents: true, canManageNews: true, canManageAttendance: true, canManageSchedules: true, canAdministerUsers: true };
  if (role === "supervisor") return { canViewStudents: true, canManageNews: true, canManageAttendance: true, canManageSchedules: true, canAdministerUsers: false };
  if (role === "secretary") return { canViewStudents: true, canManageNews: true, canManageAttendance: false, canManageSchedules: true, canAdministerUsers: false };
  return { canViewStudents: true, canManageNews: false, canManageAttendance: true, canManageSchedules: true, canAdministerUsers: false };
}

function userWriteRow(input: {
  id: string;
  role: UserRole;
  code?: string | null;
  email: string;
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  status?: string;
  permissions?: Partial<UserPermissions>;
  createdAt?: string;
}): AppSheetRow {
  const permissions = { ...permissionDefaults(input.role), ...input.permissions };
  const timestamp = nowIso();
  return {
    UsuarioID: input.id,
    TipoUsuario: input.role,
    CodigoUsuario: input.code ?? "",
    Correo: input.email.trim().toLowerCase(),
    Nombre: input.firstName.trim(),
    Apellido: input.lastName.trim(),
    FotoUrl: input.photoUrl ?? "",
    Estado: input.status ?? "activo",
    PuedeVerEstudiantes: permissions.canViewStudents ? "Y" : "N",
    PuedeGestionarNovedades: permissions.canManageNews ? "Y" : "N",
    PuedeGestionarAsistencia: permissions.canManageAttendance ? "Y" : "N",
    PuedeGestionarHorarios: permissions.canManageSchedules ? "Y" : "N",
    PuedeAdministrarUsuarios: permissions.canAdministerUsers ? "Y" : "N",
    CreatedAt: input.createdAt ?? timestamp,
    UpdatedAt: timestamp,
  };
}

export async function createUser(input: Omit<Parameters<typeof userWriteRow>[0], "id"> & { id?: string }): Promise<AppUser> {
  const existing = await getUserByEmail(input.email, { fresh: true });
  if (existing) throw Object.assign(new Error("Ya existe un usuario con ese correo"), { clientCode: "DUPLICATE_EMAIL" });
  const id = input.id ?? crypto.randomUUID();
  await addRows(APPSHEET_TABLES.users, [userWriteRow({ ...input, id })]);
  const created = await getUserById(id, input.role, { fresh: true });
  if (!created) throw new Error("AppSheet no devolvió el usuario creado");
  return created;
}

export async function updateUser(id: string, changes: Partial<{
  code: string | null;
  email: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  status: string;
  permissions: Partial<UserPermissions>;
}>): Promise<AppUser> {
  const current = await getUserById(id, undefined, { fresh: true });
  if (!current) throw Object.assign(new Error("Usuario no encontrado"), { clientCode: "NOT_FOUND" });
  const nextEmail = changes.email?.trim().toLowerCase() ?? current.email;
  const duplicate = (await getUsers()).find((user) => user.email === nextEmail && user.id !== id);
  if (duplicate) throw Object.assign(new Error("Ya existe un usuario con ese correo"), { clientCode: "DUPLICATE_EMAIL" });
  await editRows(APPSHEET_TABLES.users, [userWriteRow({
    id: current.id,
    role: current.role,
    code: changes.code === undefined ? current.code : changes.code,
    email: nextEmail,
    firstName: changes.firstName ?? current.firstName,
    lastName: changes.lastName ?? current.lastName,
    photoUrl: changes.photoUrl === undefined ? current.photoUrl : changes.photoUrl,
    status: changes.status ?? current.status,
    permissions: { ...current.permissions, ...changes.permissions },
    createdAt: current.createdAt ?? undefined,
  })]);
  const updated = await getUserById(id, current.role, { fresh: true });
  if (!updated) throw new Error("AppSheet no devolvió el usuario actualizado");
  return updated;
}

export async function removeUser(id: string): Promise<void> {
  const current = await getUserById(id, undefined, { fresh: true });
  if (!current) throw Object.assign(new Error("Usuario no encontrado"), { clientCode: "NOT_FOUND" });
  await deleteRows(APPSHEET_TABLES.users, [{ UsuarioID: id }]);
}

export async function getGrades(options: { fresh?: boolean } = {}): Promise<AppGrade[]> {
  return (await getTableRows(APPSHEET_TABLES.grades, options)).map((row) => ({
    id: numberCell(row, "IdGrado"),
    name: textCell(row, "Nombre"),
    level: nullableTextCell(row, "Nivel"),
    status: textCell(row, "Estado") || "activo",
    createdAt: nullableTextCell(row, "CreatedAt"),
    updatedAt: nullableTextCell(row, "UpdatedAt"),
  })).filter((grade) => grade.id > 0 && grade.name);
}

export async function getSchedules(options: { fresh?: boolean } = {}): Promise<AppSchedule[]> {
  return (await getTableRows(APPSHEET_TABLES.schedules, options)).map((row) => ({
    id: textCell(row, "HorarioID"),
    day: normalizeDayName(cell(row, "DiaSemana")),
    startTime: nullableTextCell(row, "HoraInicio"),
    endTime: nullableTextCell(row, "HoraFin"),
    classroom: nullableTextCell(row, "Aula"),
    status: textCell(row, "Estado") || "activo",
    createdAt: nullableTextCell(row, "CreatedAt"),
    updatedAt: nullableTextCell(row, "UpdatedAt"),
  })).filter((schedule) => schedule.id && schedule.day);
}

export async function getStudents(options: { fresh?: boolean } = {}): Promise<AppStudent[]> {
  return (await getTableRows(APPSHEET_TABLES.students, options)).map((row) => ({
    code: textCell(row, "CodigoEstudiante"),
    firstName: textCell(row, "Nombre"),
    lastName: textCell(row, "Apellido"),
    gradeId: numberCell(row, "IdGrado"),
    gradeName: textCell(row, "NombreGrado"),
    group: nullableTextCell(row, "Grupo"),
    email: nullableTextCell(row, "Correo"),
    photoUrl: nullableTextCell(row, "FotoUrl"),
    sourceStatus: nullableTextCell(row, "EstadoOrigen"),
    createdAt: nullableTextCell(row, "CreatedAt"),
    updatedAt: nullableTextCell(row, "UpdatedAt"),
  })).filter((student) => student.code);
}

export async function updateStudentRow(code: string, changes: Partial<AppStudent>): Promise<void> {
  const current = (await getStudents({ fresh: true })).find((student) => student.code === code);
  if (!current) throw Object.assign(new Error("Estudiante no encontrado"), { clientCode: "NOT_FOUND" });
  const next = { ...current, ...changes };
  await editRows(APPSHEET_TABLES.students, [{
    CodigoEstudiante: code,
    Nombre: next.firstName,
    Apellido: next.lastName,
    IdGrado: next.gradeId,
    NombreGrado: next.gradeName,
    Grupo: next.group ?? "",
    Correo: next.email ?? "",
    FotoUrl: next.photoUrl ?? "",
    EstadoOrigen: next.sourceStatus ?? "",
    CreatedAt: next.createdAt ?? nowIso(),
    UpdatedAt: nowIso(),
  }]);
}

export async function getEnrollments(options: { fresh?: boolean } = {}): Promise<AppEnrollment[]> {
  return (await getTableRows(APPSHEET_TABLES.enrollments, options)).map((row) => {
    const status = textCell(row, "EstadoRegistro") || "activo";
    return {
      id: textCell(row, "InscripcionID"),
      studentCode: textCell(row, "CodigoEstudiante"),
      disciplineCode: textCell(row, "CodigoDisciplina"),
      day: normalizeDayName(cell(row, "DiaSemana")),
      status,
      active: isActiveValue(status),
      createdAt: nullableTextCell(row, "CreatedAt"),
      updatedAt: nullableTextCell(row, "UpdatedAt"),
    };
  }).filter((row) => row.id && row.studentCode && row.disciplineCode && row.day);
}

export async function replaceStudentEnrollments(
  studentCode: string,
  schedules: Array<{ disciplineCode: string; day: string }>,
): Promise<void> {
  const existing = (await getEnrollments({ fresh: true })).filter((row) => row.studentCode === studentCode);
  const desired = new Map(schedules.map((row) => [`${row.disciplineCode}|${normalizeDayName(row.day)}`, {
    disciplineCode: row.disciplineCode,
    day: normalizeDayName(row.day),
  }]));
  const current = new Map(existing.map((row) => [`${row.disciplineCode}|${row.day}`, row]));
  const timestamp = nowIso();
  const additions: AppSheetRow[] = [];
  for (const [key, row] of desired) {
    if (current.has(key)) continue;
    additions.push({
      InscripcionID: crypto.randomUUID(),
      CodigoEstudiante: studentCode,
      CodigoDisciplina: row.disciplineCode,
      DiaSemana: row.day,
      EstadoRegistro: "activo",
      CreatedAt: timestamp,
      UpdatedAt: timestamp,
    });
  }
  if (additions.length) await addRows(APPSHEET_TABLES.enrollments, additions);
  const removals = existing.filter((row) => !desired.has(`${row.disciplineCode}|${row.day}`));
  if (removals.length) await deleteRows(APPSHEET_TABLES.enrollments, removals.map((row) => ({ InscripcionID: row.id })));
}

function resolveTeacherScheduleIds(row: AppSheetRow, scheduleIds: string[]): { assignmentId: string; scheduleId: string } | null {
  const explicitAssignment = textCell(row, "AsignacionID");
  const explicitSchedule = textCell(row, "EC_HorarioID", "HorarioBaseID", "HorarioRefID");
  const raw = textCell(row, "HorarioID");
  if (explicitAssignment && (explicitSchedule || raw)) return { assignmentId: explicitAssignment, scheduleId: explicitSchedule || raw };
  const scheduleId = scheduleIds
    .slice()
    .sort((a, b) => b.length - a.length)
    .find((id) => raw === id || raw.endsWith(`__${id}`));
  if (scheduleId && raw !== scheduleId) return { assignmentId: raw.slice(0, -(scheduleId.length + 2)), scheduleId };
  const separator = raw.lastIndexOf("__");
  if (separator > 0) return { assignmentId: raw.slice(0, separator), scheduleId: raw.slice(separator + 2) };
  return null;
}

export async function getAssignments(options: { fresh?: boolean } = {}): Promise<AppAssignment[]> {
  const [rows, links, schedules] = await Promise.all([
    getTableRows(APPSHEET_TABLES.teacherSchedules, options),
    getTableRows(APPSHEET_TABLES.assignmentSchedules, options),
    getSchedules(options),
  ]);
  const scheduleIds = schedules.map((schedule) => schedule.id);
  const linksByAssignment = new Map<string, Set<string>>();
  for (const link of links) {
    const assignmentId = textCell(link, "AsignacionID");
    const scheduleId = textCell(link, "HorarioID");
    if (!assignmentId || !scheduleId) continue;
    const set = linksByAssignment.get(assignmentId) ?? new Set<string>();
    set.add(scheduleId);
    linksByAssignment.set(assignmentId, set);
  }

  const grouped = new Map<string, AppAssignment>();
  for (const row of rows) {
    const ids = resolveTeacherScheduleIds(row, scheduleIds);
    if (!ids?.assignmentId || !ids.scheduleId) continue;
    const teacherId = textCell(row, "UsuarioID", "ProfesorID");
    const disciplineCode = textCell(row, "CodigoDisciplina");
    if (!teacherId || !disciplineCode) continue;
    const current = grouped.get(ids.assignmentId) ?? {
      id: ids.assignmentId,
      teacherId,
      teacherEmail: nullableTextCell(row, "CorreoProfesor"),
      disciplineCode,
      gradeId: numberCell(row, "IdGrado"),
      primary: yesNoCell(row, "EsPrincipal"),
      status: textCell(row, "Estado") || "activo",
      scheduleIds: [],
      createdAt: nullableTextCell(row, "CreatedAt"),
      updatedAt: nullableTextCell(row, "UpdatedAt"),
    };
    const scheduleSet = new Set([...current.scheduleIds, ids.scheduleId, ...(linksByAssignment.get(ids.assignmentId) ?? [])]);
    current.scheduleIds = [...scheduleSet];
    grouped.set(ids.assignmentId, current);
  }
  return [...grouped.values()];
}

export function disciplineName(code: string): string {
  return code || "Sin disciplina";
}

export async function getAttendance(options: { fresh?: boolean } = {}): Promise<AppAttendance[]> {
  return (await getTableRows(APPSHEET_TABLES.attendance, options)).map((row) => ({
    id: textCell(row, "AsistenciaID"),
    sessionId: textCell(row, "SessionID"),
    studentCode: textCell(row, "CodigoEstudiante"),
    status: normalizeSearch(textCell(row, "Estado")),
    registeredAt: nullableTextCell(row, "RegistradoAt"),
    registeredByType: nullableTextCell(row, "RegistradoPorTipo"),
    registeredById: nullableTextCell(row, "RegistradoPorID"),
    observation: nullableTextCell(row, "Observacion"),
    createdAt: nullableTextCell(row, "CreatedAt"),
    updatedAt: nullableTextCell(row, "UpdatedAt"),
  })).filter((row) => row.id && row.sessionId && row.studentCode);
}

export function buildSessionId(assignmentId: string, scheduleId: string, date: string): string {
  return `${assignmentId}__${scheduleId}__${date}`;
}

export function resolveSessionId(
  sessionId: string,
  assignments: AppAssignment[],
): { assignment: AppAssignment; scheduleId: string; date: string } | null {
  for (const assignment of assignments) {
    for (const scheduleId of assignment.scheduleIds) {
      const prefix = `${assignment.id}__${scheduleId}__`;
      if (!sessionId.startsWith(prefix)) continue;
      const date = sessionId.slice(prefix.length);
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return { assignment, scheduleId, date };
    }
  }
  return null;
}

export async function upsertAttendanceRows(input: {
  sessionId: string;
  records: Array<{ studentCode: string; status: string; observation?: string | null }>;
  callerType: string;
  callerId: string;
}): Promise<void> {
  const existing = (await getAttendance({ fresh: true })).filter((row) => row.sessionId === input.sessionId);
  const byStudent = new Map(existing.map((row) => [row.studentCode, row]));
  const timestamp = nowIso();
  const additions: AppSheetRow[] = [];
  const edits: AppSheetRow[] = [];
  for (const record of input.records) {
    const current = byStudent.get(record.studentCode);
    const row: AppSheetRow = {
      AsistenciaID: current?.id ?? `${input.sessionId}|${record.studentCode}`,
      SessionID: input.sessionId,
      CodigoEstudiante: record.studentCode,
      Estado: record.status,
      RegistradoAt: timestamp,
      RegistradoPorTipo: input.callerType,
      RegistradoPorID: input.callerId,
      Observacion: record.observation ?? current?.observation ?? "",
      CreatedAt: current?.createdAt ?? timestamp,
      UpdatedAt: timestamp,
    };
    if (current) edits.push(row);
    else additions.push(row);
  }
  if (edits.length) await editRows(APPSHEET_TABLES.attendance, edits);
  if (additions.length) await addRows(APPSHEET_TABLES.attendance, additions);
}

export async function getStays(options: { fresh?: boolean } = {}): Promise<AppStay[]> {
  return (await getTableRows(APPSHEET_TABLES.stays, options)).map((row) => ({
    id: textCell(row, "PermanenciaID", "StayID", "ID"),
    assignmentId: textCell(row, "AsignacionID"),
    scheduleId: textCell(row, "HorarioID"),
    studentCode: textCell(row, "CodigoEstudiante"),
    date: normalizeDateOnly(cell(row, "Fecha")) ?? "",
    supervisorId: nullableTextCell(row, "SupervisorID", "UsuarioID", "RegistradoPorID"),
    createdAt: nullableTextCell(row, "CreatedAt"),
  })).filter((row) => row.id && row.assignmentId && row.scheduleId && row.studentCode && row.date);
}

export async function createStay(input: {
  assignmentId: string;
  scheduleId: string;
  studentCode: string;
  date: string;
  supervisorId: string;
}): Promise<string | null> {
  const existing = (await getStays({ fresh: true })).find((stay) =>
    stay.assignmentId === input.assignmentId && stay.scheduleId === input.scheduleId && stay.studentCode === input.studentCode && stay.date === input.date,
  );
  if (existing) return null;
  const id = crypto.randomUUID();
  await addRows(APPSHEET_TABLES.stays, [{
    PermanenciaID: id,
    AsignacionID: input.assignmentId,
    HorarioID: input.scheduleId,
    CodigoEstudiante: input.studentCode,
    Fecha: input.date,
    SupervisorID: input.supervisorId,
    CreatedAt: nowIso(),
  }]);
  return id;
}

export async function removeStay(id: string, supervisorId: string): Promise<boolean> {
  const stay = (await getStays({ fresh: true })).find((row) => row.id === id && row.supervisorId === supervisorId);
  if (!stay) return false;
  await deleteRows(APPSHEET_TABLES.stays, [{ PermanenciaID: id }]);
  return true;
}

export async function createScheduleRow(input: {
  day: string;
  startTime: string;
  endTime: string | null;
  classroom: string | null;
}): Promise<{ schedule: AppSchedule; created: boolean }> {
  const schedules = await getSchedules({ fresh: true });
  const existing = schedules.find((row) => row.day === input.day && row.startTime === input.startTime && row.endTime === input.endTime);
  if (existing) return { schedule: existing, created: false };
  const id = crypto.randomUUID();
  const timestamp = nowIso();
  await addRows(APPSHEET_TABLES.schedules, [{
    HorarioID: id,
    DiaSemana: input.day,
    HoraInicio: input.startTime,
    HoraFin: input.endTime ?? "",
    Aula: input.classroom ?? "",
    Estado: "activo",
    CreatedAt: timestamp,
    UpdatedAt: timestamp,
  }]);
  const schedule = (await getSchedules({ fresh: true })).find((row) => row.id === id);
  if (!schedule) throw new Error("AppSheet no devolvió el horario creado");
  return { schedule, created: true };
}
