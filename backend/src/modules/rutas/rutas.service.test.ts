import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  buildRutasReport: vi.fn(),
}));

vi.mock("../../db/mysql", () => ({
  query: mocks.query,
}));

vi.mock("./rutas.domain", () => ({
  buildRutasReport: mocks.buildRutasReport,
}));

import { AppError } from "../../middlewares/errorHandler";
import { getRutasReport } from "./rutas.service";

describe("rutas.service: getRutasReport", () => {
  const routeRows = [
    { code: "1", first_name: "Ana", middle_name: "", last_name: "Perez", homeroom: "A", column_key: "LU_7_AM" },
  ];

  it("devuelve el reporte construido desde student_routes", async () => {
    mocks.query.mockResolvedValue(routeRows);
    mocks.buildRutasReport.mockReturnValue({ generatedAt: "t", slots: [], estudiantes: [] });

    const report = await getRutasReport();
    expect(report).toEqual({ generatedAt: "t", slots: [], estudiantes: [] });

    const [sql] = mocks.query.mock.calls[0] as [string];
    expect(sql).toContain("student_routes");
    expect(mocks.buildRutasReport).toHaveBeenCalledWith([
      expect.objectContaining({
        BARCODE: "1",
        "FIRST NAME": "Ana",
        "LAST NAME": "Perez",
        LU_7_AM: "1",
      }),
    ]);
  });

  it("falla con error claro si MySQL no puede leer Demograficos", async () => {
    mocks.query.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(getRutasReport()).rejects.toBeInstanceOf(AppError);
  });

  it("falla si MySQL no devuelve filas", async () => {
    mocks.query.mockResolvedValue([]);
    await expect(getRutasReport()).rejects.toBeInstanceOf(AppError);
  });
});