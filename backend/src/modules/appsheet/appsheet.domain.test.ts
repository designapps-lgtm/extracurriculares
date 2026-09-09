import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getTableRows: vi.fn(),
  addRows: vi.fn(),
  editRows: vi.fn(),
  deleteRows: vi.fn(),
}));

vi.mock("./appsheet.repository", () => {
  const tables = {
    demographics: "Demograficos",
    assignmentSchedules: "EC_Asignacion_Horarios",
    attendance: "EC_Asistencias",
    audit: "EC_Auditoria",
    students: "EC_Estudiantes",
    grades: "EC_Grados",
    schedules: "EC_Horarios",
    enrollments: "EC_Inscripciones",
    stays: "EC_Permanencias",
    syncState: "EC_Sync_State",
    transfers: "EC_Traslados",
    teacherSchedules: "Profesores_Horarios",
    users: "Usuarios_Roles",
  } as const;
  const cell = (row: Record<string, unknown>, ...names: string[]) => {
    for (const name of names) {
      if (row[name] !== undefined && row[name] !== null) return row[name];
    }
    return undefined;
  };
  const textCell = (row: Record<string, unknown>, ...names: string[]) => {
    const value = cell(row, ...names);
    return value === undefined || value === null ? "" : String(value).trim();
  };
  return {
    APPSHEET_TABLES: tables,
    getTableRows: mocks.getTableRows,
    addRows: mocks.addRows,
    editRows: mocks.editRows,
    deleteRows: mocks.deleteRows,
    cell,
    textCell,
    nullableTextCell: (row: Record<string, unknown>, ...names: string[]) => textCell(row, ...names) || null,
    photoUrlCell: (row: Record<string, unknown>, ...names: string[]) => {
      const value = textCell(row, ...names);
      if (!value) return null;
      const trimmed = value.trim();
      if (trimmed.startsWith("{")) {
        try {
          const parsed = JSON.parse(trimmed) as { Url?: string };
          return parsed.Url?.trim() || null;
        } catch {
          return null;
        }
      }
      return trimmed;
    },
    numberCell: (row: Record<string, unknown>, ...names: string[]) => Number(textCell(row, ...names)) || 0,
    yesNoCell: (row: Record<string, unknown>, ...names: string[]) => ["y", "yes", "si", "sí", "true", "1"].includes(textCell(row, ...names).toLowerCase()),
    normalizeSearch: (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim(),
    isActiveValue: (value: string) => !["inactivo", "cancelado", "eliminado", "disabled", "n"].includes(value.toLowerCase()),
  };
});

import { createStay, upsertAttendanceRows } from "./appsheet.domain";

const SESSION_ID = "assignment-1__schedule-1__2026-09-01";

describe("dominio AppSheet de asistencia y permanencias", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T15:00:00.000Z"));
    mocks.addRows.mockResolvedValue([]);
    mocks.editRows.mockResolvedValue([]);
    mocks.deleteRows.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("agrega una asistencia nueva y en la siguiente escritura edita la misma llave", async () => {
    mocks.getTableRows.mockResolvedValueOnce([]);

    await upsertAttendanceRows({
      sessionId: SESSION_ID,
      callerType: "teacher",
      callerId: "teacher-1",
      records: [{ studentCode: "S1", status: "presente" }],
    });

    const expectedId = `${SESSION_ID}|S1`;
    expect(mocks.addRows).toHaveBeenCalledWith("EC_Asistencias", [expect.objectContaining({
      AsistenciaID: expectedId,
      SessionID: SESSION_ID,
      CodigoEstudiante: "S1",
      Estado: "presente",
      RegistradoAt: "2026-09-01T10:00:00",
      CreatedAt: "2026-09-01T15:00:00.000Z",
      UpdatedAt: "2026-09-01T15:00:00.000Z",
    })]);
    expect(mocks.editRows).not.toHaveBeenCalled();

    mocks.addRows.mockClear();
    mocks.getTableRows.mockResolvedValueOnce([{
      AsistenciaID: expectedId,
      SessionID: SESSION_ID,
      CodigoEstudiante: "S1",
      Estado: "presente",
      Observacion: "registro inicial",
      CreatedAt: "2026-09-01T15:00:00.000Z",
    }]);

    await upsertAttendanceRows({
      sessionId: SESSION_ID,
      callerType: "supervisor",
      callerId: "supervisor-1",
      records: [{ studentCode: "S1", status: "justificado" }],
    });

    expect(mocks.editRows).toHaveBeenCalledWith("EC_Asistencias", [expect.objectContaining({
      AsistenciaID: expectedId,
      Estado: "justificado",
      Observacion: "registro inicial",
      RegistradoPorTipo: "supervisor",
      RegistradoPorID: "supervisor-1",
    })]);
    expect(mocks.addRows).not.toHaveBeenCalled();
  });

  it("no duplica una permanencia con la misma clase, estudiante y fecha", async () => {
    mocks.getTableRows.mockResolvedValueOnce([{
      PermanenciaID: "stay-1",
      AsignacionID: "assignment-1",
      HorarioID: "schedule-1",
      CodigoEstudiante: "S1",
      Fecha: "2026-09-01",
      SupervisorID: "supervisor-1",
      CreatedAt: "2026-09-01T14:00:00.000Z",
    }]);

    await expect(createStay({
      assignmentId: "assignment-1",
      scheduleId: "schedule-1",
      studentCode: "S1",
      date: "2026-09-01",
      supervisorId: "supervisor-2",
    })).resolves.toBeNull();

    expect(mocks.addRows).not.toHaveBeenCalled();
  });
});
