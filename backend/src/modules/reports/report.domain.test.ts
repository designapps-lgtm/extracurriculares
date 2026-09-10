import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  execute: vi.fn(),
}));

vi.mock("../../db/mysql", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  execute: mocks.execute,
}));

import { createReport, listReports, updateReportEstado } from "./report.domain";

const ROW = (overrides: Record<string, unknown> = {}) => ({
  id: "rep-1",
  categoria: "problema",
  descripcion: "No carga la lista de estudiantes",
  pagina: "/supervisor/dashboard",
  usuario_id: "sup-1",
  tipo_usuario: "supervisor",
  correo: "super1@colegio.edu.co",
  estado: "nuevo",
  created_at: "2026-09-07T14:00:00.000Z",
  updated_at: "2026-09-07T14:00:00.000Z",
  ...overrides,
});

describe("dominio MySQL de reportes de problemas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-07T15:00:00.000Z"));
    mocks.query.mockResolvedValue([]);
    mocks.queryOne.mockResolvedValue(null);
    mocks.execute.mockResolvedValue({ affectedRows: 1 } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("crea un reporte nuevo con estado inicial 'nuevo'", async () => {
    let inserted: Record<string, unknown> | null = null;
    mocks.execute.mockImplementation((_sql: string, params: any[]) => {
      const [id, categoria, descripcion, pagina, usuarioId, tipoUsuario, correo, createdAt] = params;
      inserted = { id, categoria, descripcion, pagina, usuario_id: usuarioId, tipo_usuario: tipoUsuario, correo, estado: "nuevo", created_at: createdAt, updated_at: createdAt };
      return Promise.resolve({ affectedRows: 1 } as never);
    });
    mocks.queryOne.mockImplementation((_sql: string, params: any[]) => Promise.resolve(inserted));

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

    expect(mocks.execute).toHaveBeenCalledTimes(1);
    const [sql, params] = mocks.execute.mock.calls[0] as [string, any[]];
    expect(sql).toContain("INSERT INTO reports");
    expect(params.slice(1, 7)).toMatchObject(["problema", "No carga la lista de estudiantes", "/supervisor/dashboard", "sup-1", "supervisor", "super1@colegio.edu.co"]);
  });

  it("lista reportes filtrando por estado", async () => {
    mocks.query.mockResolvedValue([
      ROW({ id: "rep-2", estado: "resuelto", created_at: "2026-09-07T12:00:00.000Z" }),
      ROW({ id: "rep-1", estado: "nuevo", created_at: "2026-09-07T10:00:00.000Z" }),
    ]);

    const nuevos = await listReports({ estado: "nuevo" });
    expect(nuevos).toHaveLength(1);
    expect(nuevos[0].id).toBe("rep-1");

    const todos = await listReports();
    expect(todos).toHaveLength(2);
    expect(todos.map((r) => r.id)).toEqual(["rep-2", "rep-1"]);
  });

  it("cambia el estado de un reporte existente", async () => {
    mocks.queryOne
      .mockResolvedValueOnce(ROW({ id: "rep-1", estado: "nuevo" }))
      .mockResolvedValueOnce(ROW({ id: "rep-1", estado: "en_progreso" }));

    const reporte = await updateReportEstado("rep-1", "en_progreso");

    expect(reporte.estado).toBe("en_progreso");
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    const [sql, params] = mocks.execute.mock.calls[0] as [string, any[]];
    expect(sql).toContain("UPDATE reports");
    expect(params[0]).toBe("en_progreso");
    expect(params[2]).toBe("rep-1");
  });

  it("lanza error cuando el reporte no existe al cambiar estado", async () => {
    mocks.queryOne.mockResolvedValue(null);

    await expect(updateReportEstado("rep-desconocido", "resuelto")).rejects.toMatchObject({
      clientCode: "NOT_FOUND",
    });
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("ignora filas sin id o sin descripción", async () => {
    mocks.query.mockResolvedValue([
      ROW(),
      ROW({ id: "", descripcion: "algo" }),
      ROW({ id: "rep-3", descripcion: "" }),
    ]);

    const reportes = await listReports();
    expect(reportes).toHaveLength(1);
    expect(reportes[0].id).toBe("rep-1");
  });
});