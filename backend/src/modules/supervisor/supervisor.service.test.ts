import { describe, expect, it, vi } from "vitest";
import type { AppAssignment, AppGrade, AppSchedule, AppStudent, AppUser } from "../appsheet/appsheet.domain";
import type { CoreData } from "../appsheet/appsheet.views";

const mocks = vi.hoisted(() => ({
  loadCoreData: vi.fn(),
  dispatch: vi.fn(),
}));

vi.mock("../appsheet/appsheet.views", () => ({
  disciplinePayload: (code: string) => ({ codigoDisciplina: code, nombre: code }),
  loadCoreData: mocks.loadCoreData,
  schedulePayload: (schedule: AppSchedule | undefined) => ({
    idHorario: schedule?.id ?? "",
    diaSemana: schedule?.day ?? "",
    horaInicio: schedule?.startTime ?? null,
    horaFin: schedule?.endTime ?? null,
    aula: schedule?.classroom ?? null,
  }),
  teacherPayload: (teacher: AppUser | undefined) => ({
    idProfesor: teacher?.id ?? "",
    nombre: teacher?.firstName ?? "",
    apellido: teacher?.lastName ?? "",
  }),
  gradePayload: (grade: AppGrade | undefined, id: number) => ({
    idGrado: id,
    nombre: grade?.name ?? String(id),
  }),
}));

import { scheduleClasses } from "./supervisor.service";

const teacher: AppUser = {
  id: "teacher-1",
  role: "teacher",
  code: "T1",
  email: "t@gi.edu.co",
  firstName: "Juan",
  lastName: "Ríos",
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

function assignment(id: string, gradeId: number, scheduleIds: string[], primary = false): AppAssignment {
  return {
    id,
    teacherId: teacher.id,
    teacherEmail: teacher.email,
    disciplineCode: "XC_SEC_ProgRobot",
    gradeId,
    primary,
    status: "activo",
    scheduleIds,
    createdAt: null,
    updatedAt: null,
  };
}

const lunes: AppSchedule = {
  id: "horario-lunes",
  day: "LUNES",
  startTime: null,
  endTime: null,
  classroom: null,
  status: "activo",
  createdAt: null,
  updatedAt: null,
};

const martes: AppSchedule = {
  id: "horario-martes",
  day: "MARTES",
  startTime: null,
  endTime: null,
  classroom: null,
  status: "activo",
  createdAt: null,
  updatedAt: null,
};

function coreData(): CoreData {
  const grades: AppGrade[] = [6, 7, 8, 9, 10, 11, 12].map((id) => ({
    id,
    name: `${id}°`,
    level: null,
    status: "activo",
    createdAt: null,
    updatedAt: null,
  }));
  const students: AppStudent[] = [
    {
      code: "S6",
      firstName: "Ana",
      lastName: "Uno",
      gradeId: 6,
      gradeName: "6°",
      group: null,
      email: null,
      photoUrl: null,
      sourceStatus: "activo",
      createdAt: null,
      updatedAt: null,
    },
    {
      code: "S12",
      firstName: "Luis",
      lastName: "Doce",
      gradeId: 12,
      gradeName: "12°",
      group: null,
      email: null,
      photoUrl: null,
      sourceStatus: "activo",
      createdAt: null,
      updatedAt: null,
    },
    {
      code: "S9",
      firstName: "Mar",
      lastName: "Nueve",
      gradeId: 9,
      gradeName: "9°",
      group: null,
      email: null,
      photoUrl: null,
      sourceStatus: "activo",
      createdAt: null,
      updatedAt: null,
    },
  ];
  const assignments = [assignment("asign-6", 6, [lunes.id]), assignment("asign-12", 12, [lunes.id])];
  return {
    users: [teacher],
    students,
    grades,
    schedules: [lunes, martes],
    enrollments: [
      { id: "e1", studentCode: "S6", disciplineCode: "XC_SEC_ProgRobot", day: "LUNES", status: "activo", active: true, createdAt: null, updatedAt: null },
      { id: "e2", studentCode: "S12", disciplineCode: "XC_SEC_ProgRobot", day: "LUNES", status: "activo", active: true, createdAt: null, updatedAt: null },
      { id: "e3", studentCode: "S9", disciplineCode: "XC_SEC_ProgRobot", day: "LUNES", status: "activo", active: true, createdAt: null, updatedAt: null },
    ],
    assignments,
    userById: new Map([[teacher.id, teacher]]),
    studentByCode: new Map(students.map((s) => [s.code, s])),
    gradeById: new Map(grades.map((g) => [g.id, g])),
    scheduleById: new Map([[lunes.id, lunes], [martes.id, martes]]),
  };
}

describe("scheduleClasses: clases de horarios unificadas por profesor + disciplina + día", () => {
  it("agrupa las asignaciones del mismo profesor y disciplina en una sola clase que cubre 6 a 12", () => {
    const classes = scheduleClasses(coreData());

    expect(classes).toHaveLength(1);
    expect(classes[0].idAsignacion).toBe("asign-6");
    expect(classes[0].grades.map((grade) => grade.idGrado)).toEqual([6, 7, 8, 9, 10, 11, 12]);
    expect(classes[0].grade.idGrado).toBe(6);
    expect(classes[0].schedules).toHaveLength(1);
    expect(classes[0].enrolledCount).toBe(3);
  });

  it("separa clases de horarios distintos aunque sea la misma disciplina", () => {
    const data = coreData();
    data.assignments.push(assignment("asign-6-martes", 6, [martes.id]));
    data.assignments.push(assignment("asign-12-martes", 12, [martes.id]));

    const classes = scheduleClasses(data);

    expect(classes).toHaveLength(2);
    expect(classes.map((cls) => cls.schedules[0].diaSemana).sort()).toEqual(["LUNES", "MARTES"]);
  });

  it("muestra el rango completo aunque un grado no tenga participantes", () => {
    const data = coreData();
    data.enrollments = data.enrollments.filter((row) => row.studentCode !== "S9");

    const classes = scheduleClasses(data);

    expect(classes[0].grades.map((grade) => grade.idGrado)).toEqual([6, 7, 8, 9, 10, 11, 12]);
    expect(classes[0].enrolledCount).toBe(2);
  });
});