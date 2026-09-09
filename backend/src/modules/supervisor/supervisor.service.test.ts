import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadCoreData: vi.fn(),
  schedulePayload: vi.fn(),
  teacherPayload: vi.fn(),
  resolveLogicalClass: vi.fn(),
  getClassRoster: vi.fn(),
  sessionState: vi.fn(),
  todayColombia: vi.fn(),
  dayColombia: vi.fn(),
}));

vi.mock("../appsheet/appsheet.views", () => ({
  loadCoreData: mocks.loadCoreData,
  schedulePayload: mocks.schedulePayload,
  teacherPayload: mocks.teacherPayload,
  assignmentPayload: vi.fn((a: unknown) => a),
  disciplineCodes: vi.fn(() => []),
  matchesTokens: vi.fn(() => true),
}));

vi.mock("../attendance/attendance.service", () => ({
  resolveLogicalClass: mocks.resolveLogicalClass,
  getClassRoster: mocks.getClassRoster,
  sessionState: mocks.sessionState,
}));

vi.mock("../../utils/colombiaTime", () => ({
  todayColombia: mocks.todayColombia,
  dayColombia: mocks.dayColombia,
  nowIso: vi.fn(() => "2026-09-08T00:00:00.000Z"),
  normalizeDateOnly: vi.fn((value: string) => value),
}));

import { getSupervisorClasses } from "./supervisor.service";

const teacherUser = { id: "t1", firstName: "Ana", lastName: "Perez", role: "teacher", active: true };
const grade = { id: 1, name: "1" };
const scheduleMon = { id: "s-mon", day: "LUNES", startTime: "07:00", endTime: "08:00", classroom: "Aula 1", status: "activo" };
const scheduleMonPm = { id: "s-mon-pm", day: "LUNES", startTime: "15:00", endTime: "16:00", classroom: "Aula 2", status: "activo" };
const scheduleTue = { id: "s-tue", day: "MARTES", startTime: "07:00", endTime: "08:00", classroom: "Aula 1", status: "activo" };
const assignment = {
  id: "a1",
  disciplineCode: "MT",
  teacherId: "t1",
  gradeId: 1,
  primary: 1,
  scheduleIds: ["s-mon", "s-mon-pm", "s-tue"],
  status: "activo",
};

function buildData(assignments = [assignment]) {
  const schedules = [scheduleMon, scheduleMonPm, scheduleTue];
  const users = [teacherUser];
  return {
    users,
    students: [],
    grades: [grade],
    schedules,
    enrollments: [],
    assignments,
    userById: new Map(users.map((row: any) => [row.id, row])),
    studentByCode: new Map(),
    gradeById: new Map([[1, grade]]),
    scheduleById: new Map(schedules.map((row: any) => [row.id, row])),
  };
}

function roster(gradeId = 1) {
  return { students: [], grades: [{ idGrado: gradeId, nombre: "1" }], enrolledCount: 2, stayCount: 0 };
}

const emptyState = { records: [], estado: "en_curso", llamadaAt: null, llamadaPorTipo: null, llamadaPorId: null };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.schedulePayload.mockImplementation((schedule: any) => ({
    idHorario: schedule?.id ?? "",
    diaSemana: schedule?.day ?? "",
    horaInicio: schedule?.startTime ?? null,
    horaFin: schedule?.endTime ?? null,
    aula: schedule?.classroom ?? null,
    estado: schedule?.status ?? "activo",
  }));
  mocks.teacherPayload.mockImplementation((user: any) => ({
    idProfesor: user?.id ?? "",
    nombre: user?.firstName ?? "",
    apellido: user?.lastName ?? "",
  }));
  mocks.resolveLogicalClass.mockImplementation((assignmentId: string, scheduleId: string, date: string) => {
    const data = buildData();
    return { data, assignment, logicalAssignments: [assignment], scheduleId, date, sessionId: `${assignmentId}__${scheduleId}__${date}` };
  });
  mocks.getClassRoster.mockResolvedValue(roster());
  mocks.sessionState.mockResolvedValue(emptyState);
});

describe("getSupervisorClasses: filtro today", () => {
  it("con today=1 devuelve solo las clases de hoy", async () => {
    mocks.loadCoreData.mockResolvedValue(buildData());
    mocks.todayColombia.mockReturnValue("2026-09-08");
    mocks.dayColombia.mockReturnValue("LUNES");

    const res = { json: vi.fn() } as any;
    await getSupervisorClasses({ query: { today: "1" } } as any, res);

    const data = res.json.mock.calls[0][0].data;
    expect(data.dayName).toBe("LUNES");
    expect(data.classes).toHaveLength(2);
    expect(data.classes.every((cls: any) => cls.isToday)).toBe(true);
    expect(data.classes.every((cls: any) => cls.schedule.idHorario === "s-mon" || cls.schedule.idHorario === "s-mon-pm")).toBe(true);
  });

  it("sin today devuelve las clases de todos los días", async () => {
    mocks.loadCoreData.mockResolvedValue(buildData());
    mocks.todayColombia.mockReturnValue("2026-09-08");
    mocks.dayColombia.mockReturnValue("LUNES");

    const res = { json: vi.fn() } as any;
    await getSupervisorClasses({ query: {} } as any, res);

    const data = res.json.mock.calls[0][0].data;
    const scheduleIds = data.classes.map((cls: any) => cls.schedule.idHorario);
    expect(scheduleIds).toEqual(["s-mon", "s-mon-pm", "s-tue"]);
    const lun = data.classes.find((cls: any) => cls.schedule.idHorario === "s-mon");
    const mar = data.classes.find((cls: any) => cls.schedule.idHorario === "s-tue");
    expect(lun.isToday).toBe(true);
    expect(mar.isToday).toBe(false);
  });

  it("ordena por día de la semana y luego por hora", async () => {
    mocks.loadCoreData.mockResolvedValue(buildData());
    mocks.todayColombia.mockReturnValue("2026-09-08");
    mocks.dayColombia.mockReturnValue("LUNES");

    const res = { json: vi.fn() } as any;
    await getSupervisorClasses({ query: {} } as any, res);

    const data = res.json.mock.calls[0][0].data;
    expect(data.classes.map((cls: any) => cls.schedule.idHorario)).toEqual(["s-mon", "s-mon-pm", "s-tue"]);
  });

  it("refleja el estado de llamada cuando la lista ya fue tomada", async () => {
    mocks.loadCoreData.mockResolvedValue(buildData());
    mocks.todayColombia.mockReturnValue("2026-09-08");
    mocks.dayColombia.mockReturnValue("LUNES");
    mocks.sessionState.mockResolvedValue({
      records: [{ studentCode: "c1", status: "presente" }],
      estado: "finalizada",
      llamadaAt: "2026-09-08T14:00:00.000Z",
      llamadaPorTipo: "supervisor",
      llamadaPorId: "t1",
    });

    const res = { json: vi.fn() } as any;
    await getSupervisorClasses({ query: { today: "1" } } as any, res);

    const cls = res.json.mock.calls[0][0].data.classes[0];
    expect(cls.callStatus).toBe("finalizada");
    expect(cls.sessionId).toBeTruthy();
    expect(cls.calledBy.type).toBe("supervisor");
    expect(cls.calledBy.nombre).toBe("Ana");
  });
});