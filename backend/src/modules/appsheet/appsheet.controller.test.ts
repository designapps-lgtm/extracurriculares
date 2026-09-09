import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Request, Response } from "express";

const mocks = vi.hoisted(() => {
  process.env.APPSHEET_WEBHOOK_TOKEN = "token-webhook";
  return {
    getTableRows: vi.fn(),
    clearAppSheetCache: vi.fn(),
    syncAppSheetStudents: vi.fn().mockResolvedValue({ ok: true }),
  };
});

vi.mock("./appsheet.students", () => ({
  syncAppSheetStudents: mocks.syncAppSheetStudents,
}));

vi.mock("./appsheet.repository", () => ({
  clearAppSheetCache: mocks.clearAppSheetCache,
  getTableRows: mocks.getTableRows,
}));

import { syncTable } from "./appsheet.controller";

function fakeRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    query: {},
    body: {},
    ...overrides,
  } as Request;
}

function fakeResponse(): { res: Response; json: ReturnType<typeof vi.fn>; status: ReturnType<typeof vi.fn> } {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { res: { status, json } as unknown as Response, json, status };
}

describe("appsheet.controller: webhook syncTable", () => {
  beforeEach(() => {
    mocks.getTableRows.mockReset();
    mocks.clearAppSheetCache.mockClear();
  });

  it("rechaza sin token válido (401)", async () => {
    const { res, status, json } = fakeResponse();
    await syncTable(fakeRequest(), res);
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    expect(mocks.getTableRows).not.toHaveBeenCalled();
  });

  it("rechaza si falta table", async () => {
    const { res, status, json } = fakeResponse();
    await syncTable(fakeRequest({ headers: { "x-webhook-token": "token-webhook" } }), res);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it("refresca la tabla y devuelve la cantidad de filas", async () => {
    mocks.getTableRows.mockResolvedValue([{ Id: "1" }, { Id: "2" }]);
    const { res, json } = fakeResponse();
    await syncTable(
      fakeRequest({ headers: { "x-webhook-token": "token-webhook" }, body: { table: "EC_Estudiantes" } }),
      res,
    );
    expect(mocks.getTableRows).toHaveBeenCalledWith("EC_Estudiantes", { fresh: true });
    expect(json).toHaveBeenCalledWith({ success: true, data: { table: "EC_Estudiantes", rows: 2 } });
  });

  it("acepta table via query string", async () => {
    mocks.getTableRows.mockResolvedValue([]);
    const { res, json } = fakeResponse();
    await syncTable(
      fakeRequest({ headers: { "x-webhook-token": "token-webhook" }, query: { table: "EC_Grados" } }),
      res,
    );
    expect(mocks.getTableRows).toHaveBeenCalledWith("EC_Grados", { fresh: true });
    expect(json).toHaveBeenCalledWith({ success: true, data: { table: "EC_Grados", rows: 0 } });
  });

  it("si AppSheet falla, invalida la caché y responde 502", async () => {
    mocks.getTableRows.mockRejectedValue(new Error("429 Too Many Requests"));
    const { res, status, json } = fakeResponse();
    await syncTable(
      fakeRequest({ headers: { "x-webhook-token": "token-webhook" }, body: { table: "EC_Estudiantes" } }),
      res,
    );
    expect(mocks.clearAppSheetCache).toHaveBeenCalledWith("EC_Estudiantes");
    expect(status).toHaveBeenCalledWith(502);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "APPSHEET_REFRESH_FAILED" }),
      }),
    );
  });
});