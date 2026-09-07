import {
  disciplineName,
  getAssignments,
  getEnrollments,
  getGrades,
  getSchedules,
  getStudents,
  getUsers,
  type AppAssignment,
  type AppEnrollment,
  type AppGrade,
  type AppSchedule,
  type AppStudent,
  type AppUser,
} from "./appsheet.domain";
import { isActiveValue, normalizeSearch } from "./appsheet.repository";

const DAY_ORDER = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"];

export interface CoreData {
  users: AppUser[];
  students: AppStudent[];
  grades: AppGrade[];
  schedules: AppSchedule[];
  enrollments: AppEnrollment[];
  assignments: AppAssignment[];
  userById: Map<string, AppUser>;
  studentByCode: Map<string, AppStudent>;
  gradeById: Map<number, AppGrade>;
  scheduleById: Map<string, AppSchedule>;
}

export async function loadCoreData(options: { fresh?: boolean } = {}): Promise<CoreData> {
  const [users, students, grades, schedules, enrollments, assignments] = await Promise.all([
    getUsers(options),
    getStudents(options),
    getGrades(options),
    getSchedules(options),
    getEnrollments(options),
    getAssignments(options),
  ]);
  return {
    users,
    students,
    grades,
    schedules,
    enrollments: enrollments.filter((row) => row.active),
    assignments: assignments.filter((row) => isActiveValue(row.status)),
    userById: new Map(users.map((row) => [row.id, row])),
    studentByCode: new Map(students.map((row) => [row.code, row])),
    gradeById: new Map(grades.map((row) => [row.id, row])),
    scheduleById: new Map(schedules.map((row) => [row.id, row])),
  };
}

export function teacherPayload(user: AppUser | undefined): Record<string, unknown> {
  return {
    idProfesor: user?.id ?? "",
    codigoProfesor: user?.code ?? null,
    nombre: user?.firstName ?? "",
    apellido: user?.lastName ?? "",
    correo: user?.email ?? null,
    fotoUrl: user?.photoUrl ?? null,
    estado: user?.status ?? "inactivo",
    createdAt: user?.createdAt ?? null,
    updatedAt: user?.updatedAt ?? null,
  };
}

export function gradePayload(grade: AppGrade | undefined, fallbackId = 0, fallbackName = ""): Record<string, unknown> {
  return {
    idGrado: grade?.id ?? fallbackId,
    nombre: grade?.name || fallbackName,
    nivel: grade?.level ?? null,
    estado: grade?.status ?? "activo",
    createdAt: grade?.createdAt ?? null,
    updatedAt: grade?.updatedAt ?? null,
  };
}

export function schedulePayload(schedule: AppSchedule | undefined): Record<string, unknown> {
  return {
    idHorario: schedule?.id ?? "",
    diaSemana: schedule?.day ?? "",
    horaInicio: schedule?.startTime ?? null,
    horaFin: schedule?.endTime ?? null,
    aula: schedule?.classroom ?? null,
    estado: schedule?.status ?? "activo",
    createdAt: schedule?.createdAt ?? null,
    updatedAt: schedule?.updatedAt ?? null,
  };
}

export function disciplinePayload(code: string): Record<string, unknown> {
  return {
    codigoDisciplina: code,
    nombre: disciplineName(code),
    descripcion: null,
    estado: "activa",
    createdAt: null,
    updatedAt: null,
  };
}

export function studentPayload(student: AppStudent, data: CoreData): Record<string, unknown> {
  const enrollments = data.enrollments
    .filter((row) => row.studentCode === student.code)
    .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));
  return {
    codigoEstudiante: student.code,
    nombre: student.firstName,
    apellido: student.lastName,
    idGrado: student.gradeId,
    grupo: student.group,
    correo: student.email,
    fotoUrl: student.photoUrl,
    createdAt: student.createdAt,
    updatedAt: student.updatedAt,
    grade: gradePayload(data.gradeById.get(student.gradeId), student.gradeId, student.gradeName),
    studentSchedules: enrollments.map((row) => ({
      id: row.id,
      codigoEstudiante: row.studentCode,
      codigoDisciplina: row.disciplineCode,
      diaSemana: row.day,
      discipline: disciplinePayload(row.disciplineCode),
    })),
  };
}

export function assignmentPayload(assignment: AppAssignment, data: CoreData): Record<string, unknown> {
  const teacher = data.userById.get(assignment.teacherId);
  const grade = data.gradeById.get(assignment.gradeId);
  return {
    idAsignacion: assignment.id,
    idProfesor: assignment.teacherId,
    codigoDisciplina: assignment.disciplineCode,
    idGrado: assignment.gradeId,
    esPrincipal: assignment.primary,
    estado: assignment.status,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
    teacher: teacherPayload(teacher),
    discipline: disciplinePayload(assignment.disciplineCode),
    grade: gradePayload(grade, assignment.gradeId),
    schedules: assignment.scheduleIds
      .map((id) => data.scheduleById.get(id))
      .filter((row): row is AppSchedule => Boolean(row))
      .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || (a.startTime ?? "").localeCompare(b.startTime ?? ""))
      .map((schedule) => ({ schedule: schedulePayload(schedule) })),
  };
}

export function matchesTokens(values: unknown[], search?: string): boolean {
  if (!search?.trim()) return true;
  const tokens = normalizeSearch(search).split(/\s+/).filter(Boolean);
  const haystack = normalizeSearch(values.map((value) => String(value ?? "")).join(" "));
  return tokens.every((token) => haystack.includes(token));
}

export function pageSlice<T>(rows: T[], page: number, limit: number): T[] {
  return rows.slice((page - 1) * limit, page * limit);
}

export function disciplineCodes(data: CoreData): string[] {
  return [...new Set([
    ...data.assignments.map((row) => row.disciplineCode),
    ...data.enrollments.map((row) => row.disciplineCode),
  ])].filter(Boolean).sort((a, b) => disciplineName(a).localeCompare(disciplineName(b), "es"));
}
