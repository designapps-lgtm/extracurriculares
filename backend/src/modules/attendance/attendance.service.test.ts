import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AppAssignment,
  AppAttendance,
  AppGrade,
  AppSchedule,
  AppStay,
  AppStudent,
  AppUser,
} from "../../db/domain";
import type { CoreData } from "../../db/views";

const mocks = vi.hoisted(() => ({
  getAssignments: vi.fn(),
  getAttendance: vi.fn(),
  getStays: vi.fn(),
  resolveSessionId: vi.fn(),
  upsertAttendanceRows: vi.fn(),
  loadCoreData: vi.fn(),
}));

vi.mock("../../db/domain", () => ({
  buildSessionId: (assignmentId: string, scheduleId: string, date: string) => `${assignmentId}__${scheduleId}__${date}`,
  disciplineName: (code: string) => code,
  getAssignments: mocks.getAssignments,
  getAttendance: mocks.getAttendance,
  getStays: mocks.getStays,
  resolveSessionId: mocks.resolveSessionId,
  upsertAttendanceRows: mocks.upsertAttendanceRows,
}));

vi.mock("../../db/views", () => ({
  assignmentPayload: (assignment: AppAssignment) => ({ idAsignacion: assignment.id }),
  loadCoreData: mocks.loadCoreData,
  schedulePayload: (schedule: AppSchedule | undefined) => ({ idHorario: schedule?.id ?? "" }),
  teacherPayload: (teacher: AppUser | undefined) => ({ idProfesor: teacher?.id ?? "" }),
}));

import {
  getClassRoster,
  resolveLogicalClass,
  saveAttendance,
} from "./attendance.service";

const assignment: AppAssignment = {
  id: "assignment-1",
  teacherId: "teacher-1",
  teacherEmail: "teacher@gi.edu.co",
  disciplineCode: "ROBOTICA",
  gradeId: 7,
  primary: true,
  status: "activo",
  scheduleIds: ["schedule-1"],
  createdAt: null,
  updatedAt: null,
};

const schedule: AppSchedule = {
  id: "schedule-1",
  day: "LUNES",
  startTime: "14:00",
  endTime: "15:00",
  classroom: "Lab",
  status: "activo",
  createdAt: null,
  updatedAt: null,
};

const grade: AppGrade = {
  id: 7,
  name: "7°",
  level: null,
  status: "activo",
  createdAt: null,
  updatedAt: null,
};

const students: AppStudent[] = [
  {
    code: "S1",
    firstName: "Ana",
    lastName: "Alba",
    gradeId: 7,
    gradeName: "7°",
    group: "A",
    email: null,
    photoUrl: null,
    sourceStatus: "activo",
    createdAt: null,
    updatedAt: null,
  },
  {
    code: "S2",
    firstName: "Bruno",
    lastName: "Bello",
    gradeId: 7,
    gradeName: "7°",
    group: "B",
    email: null,
    photoUrl: null,
    sourceStatus: "activo",
    createdAt: null,
    updatedAt: null,
  },
];

const teacher: AppUser = {
  id: "teacher-1",
  role: "teacher",
  code: "T1",
  email: "teacher@gi.edu.co",
  firstName: "Docente",
  lastName: "Prueba",
  photoUrl: null,
  status: "activo",
  active: true,
  permissions: {
    canViewStudents: true,
    canManageNews: false,
    canManageAttendance: true,
    canManageSchedules: true,
    canAdministerUsers: false,
  },
  createdAt: null,
  updatedAt: null,
};

function coreData(): CoreData {
  return {
    users: [teacher],
    students,
    grades: [grade],
    schedules: [schedule],
    enrollments: [{
      id: "enrollment-1",
      studentCode: "S1",
      disciplineCode: "ROBOTICA",
      day: "LUNES",
      status: "activo",
      active: true,
      createdAt: null,
      updatedAt: null,
    }],
    assignments: [assignment],
    userById: new Map([[teacher.id, teacher]]),
    studentByCode: new Map(students.map((student) => [student.code, student])),
    gradeById: new Map([[grade.id, grade]]),
    scheduleById: new Map([[schedule.id, schedule]]),
  };
}

const stay: AppStay = {
  id: "stay-1",
  assignmentId: "assignment-1",
  scheduleId: "schedule-1",
  studentCode: "S2",
  date: "2026-08-31",
  supervisorId: "supervisor-1",
  createdAt: "2026-08-31T15:00:00.000Z",
};

const SESSION_ID = "assignment-1__schedule-1__2026-08-31";

describe("servicio de asistencia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // 02:00 UTC todavía corresponde al 31 de agosto en America/Bogota.
    vi.setSystemTime(new Date("2026-09-01T02:00:00.000Z"));
    const data = coreData();
    mocks.loadCoreData.mockResolvedValue(data);
    mocks.getAssignments.mockResolvedValue([assignment]);
    mocks.getAttendance.mockResolvedValue([] as AppAttendance[]);
    mocks.getStays.mockResolvedValue([stay]);
    mocks.resolveSessionId.mockImplementation((sessionId: string) => sessionId === SESSION_ID
      ? { assignment, scheduleId: "schedule-1", date: "2026-08-31" }
      : null);
    mocks.upsertAttendanceRows.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("construye la fecha de sesión con el día calendario de Bogotá", async () => {
    const context = await resolveLogicalClass("assignment-1", "schedule-1");

    expect(context.date).toBe("2026-08-31");
    expect(context.sessionId).toBe(SESSION_ID);
  });

  it("combina estudiantes inscritos y permanencias en un roster único", async () => {
    const context = await resolveLogicalClass("assignment-1", "schedule-1");
    const roster = await getClassRoster(context);

    expect(roster).toMatchObject({ enrolledCount: 1, stayCount: 1 });
    expect(roster.students).toEqual([
      expect.objectContaining({ codigoEstudiante: "S1", origen: "inscrito" }),
      expect.objectContaining({ codigoEstudiante: "S2", origen: "quedado" }),
    ]);
  });

  it("incluye en el roster a los inscriptos aunque su grado no esté entre los grados de la asignación", async () => {
    const data = coreData();
    data.students.push({
      code: "S3",
      firstName: "Carla",
      lastName: "Celis",
      gradeId: 9,
      gradeName: "9°",
      group: null,
      email: null,
      photoUrl: null,
      sourceStatus: "activo",
      createdAt: null,
      updatedAt: null,
    });
    data.studentByCode = new Map(data.students.map((student) => [student.code, student]));
    data.gradeById.set(9, {
      id: 9,
      name: "9°",
      level: null,
      status: "activo",
      createdAt: null,
      updatedAt: null,
    });
    data.enrollments.push({
      id: "enrollment-2",
      studentCode: "S3",
      disciplineCode: "ROBOTICA",
      day: "LUNES",
      status: "activo",
      active: true,
      createdAt: null,
      updatedAt: null,
    });
    mocks.loadCoreData.mockResolvedValue(data);

    const context = await resolveLogicalClass("assignment-1", "schedule-1");
    const roster = await getClassRoster(context);

    expect(roster).toMatchObject({ enrolledCount: 2, stayCount: 1 });
    expect(roster.students).toEqual([
      expect.objectContaining({ codigoEstudiante: "S1", origen: "inscrito" }),
      expect.objectContaining({ codigoEstudiante: "S2", origen: "quedado" }),
      expect.objectContaining({ codigoEstudiante: "S3", origen: "inscrito" }),
    ]);
    expect(roster.grades).toEqual([
      expect.objectContaining({ idGrado: 7 }),
      expect.objectContaining({ idGrado: 9 }),
    ]);
  });

  it("rechaza finalizar si falta cualquier estudiante del roster", async () => {
    await expect(saveAttendance(SESSION_ID, [
      { codigoEstudiante: "S1", estado: "presente" },
    ], { caller: { type: "teacher", id: "teacher-1" } })).rejects.toMatchObject({
      statusCode: 400,
      code: "INCOMPLETE_ROSTER",
    });

    expect(mocks.upsertAttendanceRows).not.toHaveBeenCalled();
  });

  it("envía el roster completo al upsert idempotente", async () => {
    await expect(saveAttendance(SESSION_ID, [
      { codigoEstudiante: "S1", estado: "presente" },
      { codigoEstudiante: "S2", estado: "justificado", observacion: "Permanencia autorizada" },
    ], { caller: { type: "teacher", id: "teacher-1" } })).resolves.toMatchObject({
      id: SESSION_ID,
      total: 2,
      resultado: "finalizada",
    });

    expect(mocks.upsertAttendanceRows).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      callerType: "teacher",
      callerId: "teacher-1",
      records: [
        { studentCode: "S1", status: "presente", observation: null },
        { studentCode: "S2", status: "justificado", observation: "Permanencia autorizada" },
      ],
    });
  });
});
