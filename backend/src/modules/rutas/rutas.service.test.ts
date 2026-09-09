import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getTableRows: vi.fn(),
  buildRutasReport: vi.fn(),
}));

vi.mock("../appsheet/appsheet.repository", () => ({
  getTableRows: mocks.getTableRows,
  APPSHEET_TABLES: { demographics: "Demograficos" },
}));

vi.mock("./rutas.domain", () => ({
  buildRutasReport: mocks.buildRutasReport,
}));

import { AppError } from "../../middlewares/errorHandler";
import { getRutasReport } from "./rutas.service";

describe("rutas.service: getRutasReport", () => {
  const rows = [{ BARCODE: "1", LU_7_AM: "X" }];

  it("devuelve el reporte construido desde Demograficos", async () => {
    mocks.getTableRows.mockResolvedValue(rows);
    mocks.buildRutasReport.mockReturnValue({ generatedAt: "t", slots: [], estudiantes: [] });

    const report = await getRutasReport();
    expect(report).toEqual({ generatedAt: "t", slots: [], estudiantes: [] });
    expect(mocks.getTableRows).toHaveBeenCalledWith("Demograficos");
  });

  it("falla con error claro si AppSheet no puede leer Demograficos", async () => {
    mocks.getTableRows.mockRejectedValue(new Error("HTTP 400: mismatch"));
    await expect(getRutasReport()).rejects.toBeInstanceOf(AppError);
  });

  it("falla si AppSheet no devuelve filas", async () => {
    mocks.getTableRows.mockResolvedValue([]);
    await expect(getRutasReport()).rejects.toBeInstanceOf(AppError);
  });
});