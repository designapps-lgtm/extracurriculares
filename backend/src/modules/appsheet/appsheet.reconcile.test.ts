import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnrollment } from "./appsheet.domain";
import type { MappedStudent } from "../../import/excel/excelMapper";

const mocks = vi.hoisted(() => ({
  getEnrollments: vi.fn(),
  addRows: vi.fn(),
  deleteRows: vi.fn(),
}));

vi.mock("./appsheet.domain", () => ({
  getEnrollments: mocks.getEnrollments,
}));

vi.mock("./appsheet.repository", () => ({
  APPSHEET_TABLES: {
    enrollments: "EC_Inscripciones",
    demographics: "Demograficos",
    assignmentSchedules: "EC_Asignacion_Horarios",
    attendance: "EC_Asistencias",
    audit: "EC_Auditoria",
    students: "EC_Estudiantes",
    grades: "EC_Grados",
    schedules: "EC_Horarios",
    stays: "EC_Permanencias",
    syncState: "EC_Sync_State",
    transfers: "EC_Traslados",
    teacherSchedules: "Profesores_Horarios",
    users: "Usuarios_Roles",
  } as const,
  addRows: mocks.addRows,
  deleteRows: mocks.deleteRows,
}));

import { computeEnrollmentReconcile } from "./appsheet.reconcile";
import { applyEnrollmentReconcile } from "./appsheet.students";

function student(codigoEstudiante: string, schedules: Array<[string, string]> = []): MappedStudent {
  return {
    codigoEstudiante,
    nombre: "Test",
    apellido: "Student",
    gradeNombre: "3",
    grupo: "3A",
    correo: null,
    schedules: schedules.map(([codigoDisciplina, diaSemana]) => ({ codigoDisciplina, diaSemana })),
    _excelRow: 2,
  };
}

function enrollment(id: string, studentCode: string, disciplineCode: string, day: string): AppEnrollment {
  return {
    id,
    studentCode,
    disciplineCode,
    day,
    status: "activo",
    active: true,
    createdAt: null,
    updatedAt: null,
  };
}

describe("computeEnrollmentReconcile (CC_* vs EC_Inscripciones)", () => {
  it("mueve el día erróneo: SÁBADO que el CC_* dice MIÉRCOLES (caso Salma)", () => {
    const students = [student("S1", [["XC_EL_Porras", "MARTES"], ["XC_EL_Porras", "MIERCOLES"], ["XC_EL_DanzaModerna", "JUEVES"], ["XC_EL_Porras", "VIERNES"]])];
    const enrollments = [
      enrollment("e1", "S1", "XC_EL_Porras", "MARTES"),
      enrollment("e2", "S1", "XC_EL_Porras", "SABADO"),
      enrollment("e3", "S1", "XC_EL_DanzaModerna", "JUEVES"),
      enrollment("e4", "S1", "XC_EL_Porras", "VIERNES"),
    ];

    const diff = computeEnrollmentReconcile(students, enrollments);

    expect(diff.removals.map((row) => row.id)).toEqual(["e2"]);
    expect(diff.additions).toEqual([{ studentCode: "S1", disciplineCode: "XC_EL_Porras", day: "MIERCOLES" }]);
    expect(diff.changedStudents).toBe(1);
  });

  it("mueve el día erróneo: MIÉRCOLES que el CC_* dice SÁBADO (caso María Antonia)", () => {
    const students = [student("S2", [["XC_23_Voleibol", "MARTES"], ["XC_23_Voleibol", "VIERNES"], ["XC_23_Voleibol", "SABADO"], ["XC_EL_DesaInstrumental", "JUEVES"]])];
    const enrollments = [
      enrollment("e1", "S2", "XC_23_Voleibol", "MARTES"),
      enrollment("e2", "S2", "XC_23_Voleibol", "MIERCOLES"),
      enrollment("e3", "S2", "XC_23_Voleibol", "VIERNES"),
      enrollment("e4", "S2", "XC_EL_DesaInstrumental", "JUEVES"),
    ];

    const diff = computeEnrollmentReconcile(students, enrollments);

    expect(diff.removals.map((row) => row.id)).toEqual(["e2"]);
    expect(diff.additions).toEqual([{ studentCode: "S2", disciplineCode: "XC_23_Voleibol", day: "SABADO" }]);
  });

  it("no produce cambios cuando CC_* coincide con EC_Inscripciones", () => {
    const students = [student("S3", [["XC_EL_Porras", "MARTES"], ["XC_EL_Porras", "VIERNES"]])];
    const enrollments = [
      enrollment("e1", "S3", "XC_EL_Porras", "MARTES"),
      enrollment("e2", "S3", "XC_EL_Porras", "VIERNES"),
    ];

    const diff = computeEnrollmentReconcile(students, enrollments);

    expect(diff.removals).toEqual([]);
    expect(diff.additions).toEqual([]);
    expect(diff.changedStudents).toBe(0);
  });

  it("limpia inscripciones basura: estudiante sin CC_* con fila extra en la app (caso prueba)", () => {
    const students = [student("S4")];
    const enrollments = [
      enrollment("e1", "S4", "prueba", "LUNES"),
      enrollment("e2", "S4", "prueba 2", "LUNES"),
    ];

    const diff = computeEnrollmentReconcile(students, enrollments);

    expect(diff.removals.map((row) => row.id)).toEqual(["e1", "e2"]);
    expect(diff.additions).toEqual([]);
  });

  it("agrega las inscripciones del CC_* que faltan en la app", () => {
    const students = [student("S5", [["XC_EL_PequenosCientificos", "JUEVES"], ["XC_K4_Futbol", "MARTES"]])];
    const enrollments = [enrollment("e1", "S5", "XC_K4_Futbol", "MARTES")];

    const diff = computeEnrollmentReconcile(students, enrollments);

    expect(diff.additions).toEqual([{ studentCode: "S5", disciplineCode: "XC_EL_PequenosCientificos", day: "JUEVES" }]);
    expect(diff.removals).toEqual([]);
  });

  it("no borra inscripciones huérfanas (ausente del snapshot) pero las reporta", () => {
    const students = [student("S6", [["XC_K4_Futbol", "MARTES"]])];
    const enrollments = [
      enrollment("e1", "GHOST", "XC_EL_BandaBS", "LUNES"),
      enrollment("e2", "S6", "XC_K4_Futbol", "MARTES"),
    ];

    const diff = computeEnrollmentReconcile(students, enrollments);

    expect(diff.removals.map((row) => row.id)).toEqual([]);
    expect(diff.orphanCodes).toEqual(["GHOST"]);
  });

  it("deduplica columnas CC duplicadas de un mismo día", () => {
    const students = [student("S7", [["XC_EL_Porras", "MARTES"], ["XC_EL_Porras", "MARTES"]])];
    const enrollments: AppEnrollment[] = [];

    const diff = computeEnrollmentReconcile(students, enrollments);

    expect(diff.additions).toEqual([{ studentCode: "S7", disciplineCode: "XC_EL_Porras", day: "MARTES" }]);
  });
});

describe("applyEnrollmentReconcile (escritura a AppSheet)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-08T12:00:00.000Z"));
    mocks.addRows.mockResolvedValue([]);
    mocks.deleteRows.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("agrega y elimina las filas correctas de EC_Inscripciones", async () => {
    mocks.getEnrollments.mockResolvedValue([
      enrollment("e-junk", "S1", "prueba", "LUNES"),
      enrollment("e-ok", "S1", "XC_EL_Porras", "MARTES"),
    ]);
    const students = [
      student("S1", [["XC_EL_Porras", "MARTES"], ["XC_EL_Porras", "VIERNES"]]),
    ];

    const result = await applyEnrollmentReconcile(students);

    expect(result).toEqual({ added: 1, removed: 1, changedStudents: 1, orphanCodes: [] });
    expect(mocks.deleteRows).toHaveBeenCalledWith("EC_Inscripciones", [{ InscripcionID: "e-junk" }]);
    const [addedTable, addedRows] = mocks.addRows.mock.calls[0] as [string, Array<Record<string, unknown>>];
    expect(addedTable).toBe("EC_Inscripciones");
    expect(addedRows[0]).toMatchObject({
      CodigoEstudiante: "S1",
      CodigoDisciplina: "XC_EL_Porras",
      DiaSemana: "VIERNES",
      EstadoRegistro: "activo",
      CreatedAt: "2026-09-08T12:00:00.000Z",
      UpdatedAt: "2026-09-08T12:00:00.000Z",
    });
    expect(String(addedRows[0].InscripcionID)).toBeTruthy();
  });

  it("no escribe nada cuando no hay diferencias", async () => {
    mocks.getEnrollments.mockResolvedValue([
      enrollment("e1", "S1", "XC_EL_Porras", "MARTES"),
    ]);
    const students = [student("S1", [["XC_EL_Porras", "MARTES"]])];

    const result = await applyEnrollmentReconcile(students);

    expect(result).toEqual({ added: 0, removed: 0, changedStudents: 0, orphanCodes: [] });
    expect(mocks.addRows).not.toHaveBeenCalled();
    expect(mocks.deleteRows).not.toHaveBeenCalled();
  });
});