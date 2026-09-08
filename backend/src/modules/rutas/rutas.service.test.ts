import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findAppSheetRows: vi.fn(),
  buildRutasReport: vi.fn(),
}));

vi.mock("../appsheet/appsheet.service", () => ({
  findAppSheetRows: mocks.findAppSheetRows,
}));

vi.mock("./rutas.domain", () => ({
  buildRutasReport: mocks.buildRutasReport,
}));

import { AppError } from "../../middlewares/errorHandler";
import { getRutasReport } from "./rutas.service";

describe("rutas.service: getRutasReport", () => {
  const rows = [{ BARCODE: "1", LU_7_AM: "X" }];

  it("devuelve el reporte construido desde Demograficos", async () => {
    mocks.findAppSheetRows.mockResolvedValue(rows);
    mocks.buildRutasReport.mockReturnValue({ generatedAt: "t", slots: [], estudiantes: [] });

    const report = await getRutasReport();
    expect(report).toEqual({ generatedAt: "t", slots: [], estudiantes: [] });
    expect(mocks.findAppSheetRows).toHaveBeenCalledWith("Demograficos");
  });

  it("falla con error claro si AppSheet no puede leer Demograficos", async () => {
    mocks.findAppSheetRows.mockRejectedValue(new Error("HTTP 400: mismatch"));
    await expect(getRutasReport()).rejects.toBeInstanceOf(AppError);
  });

  it("falla si AppSheet no devuelve filas", async () => {
    mocks.findAppSheetRows.mockResolvedValue([]);
    await expect(getRutasReport()).rejects.toBeInstanceOf(AppError);
  });
});