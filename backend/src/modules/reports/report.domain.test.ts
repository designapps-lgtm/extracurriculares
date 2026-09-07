import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getTableRows: vi.fn(),
  addRows: vi.fn(),
  editRows: vi.fn(),
}));

vi.mock("../appsheet/appsheet.repository", () => {
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
    reports: "EC_Reportes_Problemas",
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

import { createReport, listReports, updateReportEstado } from "./report.domain";

const ROW = (overrides: Record<string, unknown> = {}) => ({
  ReporteID: "rep-1",
  Categoria: "problema",
  Descripcion: "No carga la lista de estudiantes",
  Pagina: "/supervisor/dashboard",
  UsuarioID: "sup-1",
  TipoUsuario: "supervisor",
  Correo: "super1@colegio.edu.co",
  Estado: "nuevo",
  CreatedAt: "2026-09-07T14:00:00.000Z",
  ...overrides,
});

describe("dominio AppSheet de reportes de problemas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-07T15:00:00.000Z"));
    mocks.getTableRows.mockResolvedValue([]);
    mocks.addRows.mockResolvedValue([]);
    mocks.editRows.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("crea un reporte nuevo con estado inicial 'nuevo'", async () => {
    const written: Array<Record<string, unknown>> = [];
    mocks.addRows.mockImplementation((_table: string, rows: Array<Record<string, unknown>>) => {
      written.push(...rows);
      return Promise.resolve(rows);
    });
    mocks.getTableRows.mockImplementation(() => Promise.resolve(written));

    const reporte = await createReport({
      categoria: "problema",
      descripcion: "No carga la lista de estudiantes",
      pagina: "/supervisor/dashboard",
      usuarioId: "sup-1",
      tipoUsuario: "supervisor",
      correo: "super1@colegio.edu.co",
    });

    expect(reporte.id).not.toBe("");
    expect(reporte.estado).toBe("nuevo");
    expect(reporte.categoria).toBe("problema");
    expect(reporte.tipoUsuario).toBe("supervisor");

    expect(mocks.addRows).toHaveBeenCalledTimes(1);
    const [table, rows] = mocks.addRows.mock.calls[0] as [string, Array<Record<string, unknown>>];
    expect(table).toBe("EC_Reportes_Problemas");
    expect(rows[0]).toMatchObject({
      Categoria: "problema",
      Descripcion: "No carga la lista de estudiantes",
      Estado: "nuevo",
      TipoUsuario: "supervisor",
      Correo: "super1@colegio.edu.co",
    });
    expect(rows[0].CreatedAt).toBe("2026-09-07T15:00:00.000Z");
  });

  it("lista reportes filtrando por estado", async () => {
    mocks.getTableRows.mockResolvedValue([
      ROW({ ReporteID: "rep-1", Estado: "nuevo", CreatedAt: "2026-09-07T10:00:00.000Z" }),
      ROW({ ReporteID: "rep-2", Estado: "resuelto", CreatedAt: "2026-09-07T12:00:00.000Z" }),
    ]);

    const nuevos = await listReports({ estado: "nuevo" });
    expect(nuevos).toHaveLength(1);
    expect(nuevos[0].id).toBe("rep-1");

    const todos = await listReports();
    expect(todos).toHaveLength(2);
    expect(todos.map((r) => r.id)).toEqual(["rep-2", "rep-1"]);
  });

  it("cambia el estado de un reporte existente", async () => {
    const current = ROW({ ReporteID: "rep-1", Estado: "nuevo" });
    const rows: Array<Record<string, unknown>> = [current];
    mocks.getTableRows.mockImplementation(() => Promise.resolve(rows));
    mocks.editRows.mockImplementation((_table: string, changes: Array<Record<string, unknown>>) => {
      for (const change of changes) {
        const target = rows.find((row) => row.ReporteID === change.ReporteID);
        if (target) Object.assign(target, change);
      }
      return Promise.resolve(changes);
    });

    const reporte = await updateReportEstado("rep-1", "en_progreso");

    expect(reporte.estado).toBe("en_progreso");
    expect(mocks.editRows).toHaveBeenCalledTimes(1);
    const [table, changes] = mocks.editRows.mock.calls[0] as [string, Array<Record<string, unknown>>];
    expect(table).toBe("EC_Reportes_Problemas");
    expect(changes[0]).toMatchObject({ ReporteID: "rep-1", Estado: "en_progreso" });
  });

  it("lanza error cuando el reporte no existe al cambiar estado", async () => {
    mocks.getTableRows.mockResolvedValue([]);

    await expect(updateReportEstado("rep-desconocido", "resuelto")).rejects.toMatchObject({
      clientCode: "NOT_FOUND",
    });
    expect(mocks.editRows).not.toHaveBeenCalled();
  });

  it("ignora filas sin ReporteID o sin descripción", async () => {
    mocks.getTableRows.mockResolvedValue([
      ROW(),
      ROW({ ReporteID: "", Descripcion: "algo" }),
      ROW({ ReporteID: "rep-3", Descripcion: "" }),
    ]);

    const reportes = await listReports();
    expect(reportes).toHaveLength(1);
    expect(reportes[0].id).toBe("rep-1");
  });
});