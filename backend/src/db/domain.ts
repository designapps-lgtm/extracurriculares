import crypto from "crypto";
import { nowBogotaLocal, nowIso, normalizeDayName, todayColombia } from "../utils/colombiaTime";
import { isoToMysql, mysqlDateToDateOnly, mysqlToIsoLocal, mysqlToIsoUtc } from "./dates";
import { execute, query, queryOne } from "./mysql";

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

export function parseRole(value: string): UserRole | null {
  const role = normalizeSearch(value);
  if (role === "admin" || role === "teacher" || role === "supervisor" || role === "secretary") return role;
  return null;
}

export function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export function isActiveValue(value: string): boolean {
  return !["inactivo", "inactiva", "cancelado", "cancelada", "eliminado", "eliminada", "disabled", "n"].includes(normalizeSearch(value));
}

export function permissionDefaults(role: UserRole): UserPermissions {
  if (role === "admin") return { canViewStudents: true, canManageNews: true, canManageAttendance: true, canManageSchedules: true, canAdministerUsers: true };
  if (role === "supervisor") return { canViewStudents: true, canManageNews: true, canManageAttendance: true, canManageSchedules: true, canAdministerUsers: false };
  if (role === "secretary") return { canViewStudents: true, canManageNews: true, canManageAttendance: false, canManageSchedules: true, canAdministerUsers: false };
  return { canViewStudents: true, canManageNews: false, canManageAttendance: true, canManageSchedules: true, canAdministerUsers: false };
}

interface UserRow {
  id: string;
  role: string;
  code: string | null;
  email: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  status: string;
  can_view_students: number;
  can_manage_news: number;
  can_manage_attendance: number;
  can_manage_schedules: number;
  can_administer_users: number;
  created_at: string | null;
  updated_at: string | null;
}

function mapUser(row: UserRow): AppUser {
  const role = parseRole(row.role);
  const status = row.status || "activo";
  return {
    id: row.id,
    role: role ?? "teacher",
    code: row.code,
    email: row.email.toLowerCase(),
    firstName: row.first_name,
    lastName: row.last_name,
    photoUrl: row.photo_url,
    status,
    active: isActiveValue(status),
    permissions: {
      canViewStudents: Boolean(row.can_view_students),
      canManageNews: Boolean(row.can_manage_news),
      canManageAttendance: Boolean(row.can_manage_attendance),
      canManageSchedules: Boolean(row.can_manage_schedules),
      canAdministerUsers: Boolean(row.can_administer_users),
    },
    createdAt: mysqlToIsoUtc(row.created_at),
    updatedAt: mysqlToIsoUtc(row.updated_at),
  };
}

export async function getUsers(options: { fresh?: boolean } = {}): Promise<AppUser[]> {
  const rows = await query<UserRow[]>(
    `SELECT id, role, code, email, first_name, last_name, photo_url, status,
            can_view_students, can_manage_news, can_manage_attendance, can_manage_schedules, can_administer_users,
            created_at, updated_at
     FROM users`,
  );
  return rows.map(mapUser);
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

function userWriteInput(input: {
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
}) {
  const permissions = { ...permissionDefaults(input.role), ...input.permissions };
  const timestamp = nowIso();
  return {
    id: input.id,
    role: input.role,
    code: input.code ?? null,
    email: input.email.trim().toLowerCase(),
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    photo_url: input.photoUrl ?? null,
    status: input.status ?? "activo",
    can_view_students: permissions.canViewStudents ? 1 : 0,
    can_manage_news: permissions.canManageNews ? 1 : 0,
    can_manage_attendance: permissions.canManageAttendance ? 1 : 0,
    can_manage_schedules: permissions.canManageSchedules ? 1 : 0,
    can_administer_users: permissions.canAdministerUsers ? 1 : 0,
    created_at: isoToMysql(input.createdAt) ?? isoToMysql(timestamp),
    updated_at: isoToMysql(timestamp),
  };
}

export async function createUser(input: Omit<Parameters<(typeof userWriteInput)>[0], "id"> & { id?: string }): Promise<AppUser> {
  const existing = await getUserByEmail(input.email, { fresh: true });
  if (existing) throw Object.assign(new Error("Ya existe un usuario con ese correo"), { clientCode: "DUPLICATE_EMAIL" });
  const id = input.id ?? crypto.randomUUID();
  const row = userWriteInput({ ...input, id });
  await execute(
    `INSERT INTO users (id, role, code, email, first_name, last_name, photo_url, status,
       can_view_students, can_manage_news, can_manage_attendance, can_manage_schedules, can_administer_users,
       created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id, row.role, row.code, row.email, row.first_name, row.last_name, row.photo_url, row.status,
      row.can_view_students, row.can_manage_news, row.can_manage_attendance, row.can_manage_schedules,
      row.can_administer_users, row.created_at, row.updated_at,
    ],
  );
  const created = await getUserById(id, input.role, { fresh: true });
  if (!created) throw new Error("MySQL no devolvió el usuario creado");
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
  const row = userWriteInput({
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
  });
  await execute(
    `UPDATE users SET role = ?, code = ?, email = ?, first_name = ?, last_name = ?, photo_url = ?, status = ?,
       can_view_students = ?, can_manage_news = ?, can_manage_attendance = ?, can_manage_schedules = ?, can_administer_users = ?,
       updated_at = ?
     WHERE id = ?`,
    [
      row.role, row.code, row.email, row.first_name, row.last_name, row.photo_url, row.status,
      row.can_view_students, row.can_manage_news, row.can_manage_attendance, row.can_manage_schedules,
      row.can_administer_users, row.updated_at, id,
    ],
  );
  const updated = await getUserById(id, current.role, { fresh: true });
  if (!updated) throw new Error("MySQL no devolvió el usuario actualizado");
  return updated;
}

export async function removeUser(id: string): Promise<void> {
  const current = await getUserById(id, undefined, { fresh: true });
  if (!current) throw Object.assign(new Error("Usuario no encontrado"), { clientCode: "NOT_FOUND" });
  await execute("DELETE FROM users WHERE id = ?", [id]);
}

interface GradeRow {
  id: number;
  name: string;
  level: string | null;
  status: string;
  created_at: string | null;
  updated_at: string | null;
}

export async function getGrades(options: { fresh?: boolean } = {}): Promise<AppGrade[]> {
  const rows = await query<GradeRow[]>("SELECT id, name, level, status, created_at, updated_at FROM grades");
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    level: row.level,
    status: row.status || "activo",
    createdAt: mysqlToIsoUtc(row.created_at),
    updatedAt: mysqlToIsoUtc(row.updated_at),
  })).filter((grade) => grade.id > 0 && grade.name);
}

interface ScheduleRow {
  id: string;
  day: string;
  start_time: string | null;
  end_time: string | null;
  classroom: string | null;
  status: string;
  created_at: string | null;
  updated_at: string | null;
}

export async function getSchedules(options: { fresh?: boolean } = {}): Promise<AppSchedule[]> {
  const rows = await query<ScheduleRow[]>(
    "SELECT id, day, start_time, end_time, classroom, status, created_at, updated_at FROM schedules",
  );
  return rows.map((row) => ({
    id: row.id,
    day: normalizeDayName(row.day),
    startTime: row.start_time,
    endTime: row.end_time,
    classroom: row.classroom,
    status: row.status || "activo",
    createdAt: mysqlToIsoUtc(row.created_at),
    updatedAt: mysqlToIsoUtc(row.updated_at),
  })).filter((schedule) => schedule.id && schedule.day);
}

interface StudentRow {
  code: string;
  first_name: string;
  last_name: string;
  grade_id: number;
  grade_name: string | null;
  group_name: string | null;
  email: string | null;
  photo_url: string | null;
  source_status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export async function getStudents(options: { fresh?: boolean } = {}): Promise<AppStudent[]> {
  const rows = await query<StudentRow[]>(
    `SELECT s.code, s.first_name, s.last_name, s.grade_id, g.name AS grade_name, s.group_name, s.email,
            s.photo_url, s.source_status, s.created_at, s.updated_at
     FROM students s
     LEFT JOIN grades g ON g.id = s.grade_id`,
  );
  return rows.map((row) => ({
    code: row.code,
    firstName: row.first_name,
    lastName: row.last_name,
    gradeId: row.grade_id,
    gradeName: row.grade_name ?? "",
    group: row.group_name,
    email: row.email,
    photoUrl: row.photo_url,
    sourceStatus: row.source_status,
    createdAt: mysqlToIsoUtc(row.created_at),
    updatedAt: mysqlToIsoUtc(row.updated_at),
  })).filter((student) => student.code);
}

export async function updateStudentRow(code: string, changes: Partial<AppStudent>): Promise<void> {
  const current = (await getStudents({ fresh: true })).find((student) => student.code === code);
  if (!current) throw Object.assign(new Error("Estudiante no encontrado"), { clientCode: "NOT_FOUND" });
  const next = { ...current, ...changes };
  await execute(
    `UPDATE students SET first_name = ?, last_name = ?, grade_id = ?, group_name = ?, email = ?, photo_url = ?, source_status = ?, updated_at = ?
     WHERE code = ?`,
    [
      next.firstName, next.lastName, next.gradeId, next.group ?? null, next.email ?? null,
      next.photoUrl ?? null, next.sourceStatus ?? null, isoToMysql(nowIso()), code,
    ],
  );
}

interface EnrollmentRow {
  id: string;
  student_code: string;
  discipline_code: string;
  day: string;
  status: string;
  created_at: string | null;
  updated_at: string | null;
}

export async function getEnrollments(options: { fresh?: boolean } = {}): Promise<AppEnrollment[]> {
  const rows = await query<EnrollmentRow[]>(
    "SELECT id, student_code, discipline_code, day, status, created_at, updated_at FROM enrollments",
  );
  return rows.map((row) => {
    const status = row.status || "activo";
    return {
      id: row.id,
      studentCode: row.student_code,
      disciplineCode: row.discipline_code,
      day: normalizeDayName(row.day),
      status,
      active: isActiveValue(status),
      createdAt: mysqlToIsoUtc(row.created_at),
      updatedAt: mysqlToIsoUtc(row.updated_at),
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

  for (const [key, row] of desired) {
    if (current.has(key)) continue;
    await execute(
      `INSERT INTO enrollments (id, student_code, discipline_code, day, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'activo', ?, ?)`,
      [crypto.randomUUID(), studentCode, row.disciplineCode, row.day, isoToMysql(timestamp), isoToMysql(timestamp)],
    );
  }
  const removals = existing.filter((row) => !desired.has(`${row.disciplineCode}|${row.day}`));
  if (removals.length) {
    await execute("DELETE FROM enrollments WHERE id IN (?)", [removals.map((row) => row.id)]);
  }
}

interface AssignmentRow {
  id: string;
  teacher_id: string;
  teacher_email: string | null;
  discipline_code: string;
  grade_id: number;
  is_primary: number;
  status: string;
  created_at: string | null;
  updated_at: string | null;
}

export async function getAssignments(options: { fresh?: boolean } = {}): Promise<AppAssignment[]> {
  const rows = await query<AssignmentRow[]>(
    `SELECT id, teacher_id, teacher_email, discipline_code, grade_id, is_primary, status, created_at, updated_at
     FROM assignments`,
  );
  const links = await query<{ assignment_id: string; schedule_id: string }[]>(
    "SELECT assignment_id, schedule_id FROM assignment_schedules",
  );
  const scheduleIdsByAssignment = new Map<string, Set<string>>();
  for (const link of links) {
    const set = scheduleIdsByAssignment.get(link.assignment_id) ?? new Set<string>();
    set.add(link.schedule_id);
    scheduleIdsByAssignment.set(link.assignment_id, set);
  }
  return rows.map((row) => ({
    id: row.id,
    teacherId: row.teacher_id,
    teacherEmail: row.teacher_email,
    disciplineCode: row.discipline_code,
    gradeId: row.grade_id,
    primary: Boolean(row.is_primary),
    status: row.status || "activo",
    scheduleIds: [...(scheduleIdsByAssignment.get(row.id) ?? [])],
    createdAt: mysqlToIsoUtc(row.created_at),
    updatedAt: mysqlToIsoUtc(row.updated_at),
  }));
}

export function disciplineName(code: string): string {
  return code || "Sin disciplina";
}

interface AttendanceRow {
  id: string;
  session_id: string;
  student_code: string;
  status: string;
  registered_at: string | null;
  registered_by_type: string | null;
  registered_by_id: string | null;
  observation: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export async function getAttendance(options: { fresh?: boolean } = {}): Promise<AppAttendance[]> {
  const rows = await query<AttendanceRow[]>(
    `SELECT id, session_id, student_code, status, registered_at, registered_by_type, registered_by_id,
            observation, created_at, updated_at
     FROM attendance`,
  );
  return rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    studentCode: row.student_code,
    status: normalizeSearch(row.status),
    registeredAt: mysqlToIsoLocal(row.registered_at),
    registeredByType: row.registered_by_type,
    registeredById: row.registered_by_id,
    observation: row.observation,
    createdAt: mysqlToIsoUtc(row.created_at),
    updatedAt: mysqlToIsoUtc(row.updated_at),
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
  const registeredAt = nowBogotaLocal();

  for (const record of input.records) {
    const current = byStudent.get(record.studentCode);
    if (current) {
      await execute(
        `UPDATE attendance SET status = ?, registered_at = ?, registered_by_type = ?, registered_by_id = ?, observation = ?, updated_at = ?
         WHERE id = ?`,
        [
          record.status, isoToMysql(registeredAt), input.callerType, input.callerId,
          record.observation ?? current.observation ?? null, isoToMysql(timestamp), current.id,
        ],
      );
    } else {
      const id = `${input.sessionId}|${record.studentCode}`;
      await execute(
        `INSERT INTO attendance (id, session_id, student_code, status, registered_at, registered_by_type, registered_by_id, observation, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, input.sessionId, record.studentCode, record.status, isoToMysql(registeredAt), input.callerType,
          input.callerId, record.observation ?? null, isoToMysql(timestamp), isoToMysql(timestamp),
        ],
      );
    }
  }
}

interface StayRow {
  id: string;
  assignment_id: string;
  schedule_id: string;
  student_code: string;
  date: string | null;
  supervisor_id: string | null;
  created_at: string | null;
}

export async function getStays(options: { fresh?: boolean } = {}): Promise<AppStay[]> {
  const rows = await query<StayRow[]>(
    `SELECT id, assignment_id, schedule_id, student_code, date, supervisor_id, created_at FROM stays`,
  );
  return rows.map((row) => ({
    id: row.id,
    assignmentId: row.assignment_id,
    scheduleId: row.schedule_id,
    studentCode: row.student_code,
    date: mysqlDateToDateOnly(row.date) ?? "",
    supervisorId: row.supervisor_id,
    createdAt: mysqlToIsoUtc(row.created_at),
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
  const result = await execute(
    `INSERT INTO stays (id, assignment_id, schedule_id, student_code, date, supervisor_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.assignmentId, input.scheduleId, input.studentCode, input.date, input.supervisorId, isoToMysql(nowIso())],
  );
  // Si el unique key ya lo tenía otra fila, devolvemos null (dedupe real a nivel DB).
  if (result.affectedRows === 0) return null;
  return id;
}

export async function removeStay(id: string, supervisorId: string): Promise<boolean> {
  const stay = (await getStays({ fresh: true })).find((row) => row.id === id && row.supervisorId === supervisorId);
  if (!stay) return false;
  await execute("DELETE FROM stays WHERE id = ?", [id]);
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
  await execute(
    `INSERT INTO schedules (id, day, start_time, end_time, classroom, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'activo', ?, ?)`,
    [id, input.day, input.startTime, input.endTime ?? null, input.classroom ?? null, isoToMysql(timestamp), isoToMysql(timestamp)],
  );
  const schedule = (await getSchedules({ fresh: true })).find((row) => row.id === id);
  if (!schedule) throw new Error("MySQL no devolvió el horario creado");
  return { schedule, created: true };
}

// Mantiene firma compatible para callers que usaban todayColombia() desde el dominio.
export { todayColombia };