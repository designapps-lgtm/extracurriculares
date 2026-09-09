import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findAppSheetRows: vi.fn(),
  kv: {
    get: vi.fn(),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("./appsheet.service", () => ({
  findAppSheetRows: mocks.findAppSheetRows,
  addAppSheetRows: vi.fn().mockResolvedValue([]),
  editAppSheetRows: vi.fn().mockResolvedValue([]),
  deleteAppSheetRows: vi.fn().mockResolvedValue([]),
}));

import { clearAppSheetCache, getTableRows, addRows, editRows, deleteRows } from "./appsheet.repository";

function kvKey(tableName: string): string {
  return `appsheet::table::${tableName}`;
}

function withKv(): void {
  (globalThis as Record<string, unknown>)["__APPSHEET_KV"] = mocks.kv;
}

function withoutKv(): void {
  delete (globalThis as Record<string, unknown>)["__APPSHEET_KV"];
}

describe("appsheet.repository: getTableRows con stale-while-revalidate", () => {
  beforeEach(() => {
    mocks.findAppSheetRows.mockReset();
    mocks.kv.get.mockReset();
    mocks.kv.put.mockClear();
    mocks.kv.delete.mockClear();
    withoutKv(); // la mayoría de los tests ejercitan solo la memoria local
    clearAppSheetCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    withoutKv();
    vi.useRealTimers();
  });

  it("devuelve el dato cacheado sin llamar a AppSheet dentro de la ventana fresca", async () => {
    mocks.findAppSheetRows.mockResolvedValue([{ Id: "1" }]);

    const first = await getTableRows("EC_Estudiantes");
    expect(first).toEqual([{ Id: "1" }]);
    expect(mocks.findAppSheetRows).toHaveBeenCalledTimes(1);

    const second = await getTableRows("EC_Estudiantes");
    expect(second).toEqual([{ Id: "1" }]);
    expect(mocks.findAppSheetRows).toHaveBeenCalledTimes(1);
  });

  it("sirve dato vencido de inmediato y refresca en background una sola vez en la ventana stale", async () => {
    mocks.findAppSheetRows.mockResolvedValueOnce([{ Id: "viejo" }]);
    await getTableRows("EC_Estudiantes", { cacheMs: 1_000, staleMs: 60_000 });

    let resolveRevalidate: ((rows: unknown[]) => void) | null = null;
    mocks.findAppSheetRows.mockImplementationOnce(
      () => new Promise((resolve) => { resolveRevalidate = resolve; }),
    );

    await vi.advanceTimersByTimeAsync(2_000);

    const staleRead = await getTableRows("EC_Estudiantes", { cacheMs: 1_000, staleMs: 60_000 });
    expect(staleRead).toEqual([{ Id: "viejo" }]);

    const staleRead2 = await getTableRows("EC_Estudiantes", { cacheMs: 1_000, staleMs: 60_000 });
    expect(staleRead2).toEqual([{ Id: "viejo" }]);

    expect(mocks.findAppSheetRows).toHaveBeenCalledTimes(2);

    resolveRevalidate!([{ Id: "nuevo" }]);
    await vi.runAllTimersAsync();

    const freshRead = await getTableRows("EC_Estudiantes", { cacheMs: 1_000, staleMs: 60_000 });
    expect(freshRead).toEqual([{ Id: "nuevo" }]);
    expect(mocks.findAppSheetRows).toHaveBeenCalledTimes(2);
  });

  it("espera el fetch cuando el dato está muy vencido", async () => {
    mocks.findAppSheetRows.mockResolvedValueOnce([{ Id: "viejo" }]);
    await getTableRows("EC_Horarios", { cacheMs: 1_000, staleMs: 500 });

    mocks.findAppSheetRows.mockResolvedValueOnce([{ Id: "nuevo" }]);
    await vi.advanceTimersByTimeAsync(2_000);

    const result = await getTableRows("EC_Horarios", { cacheMs: 1_000, staleMs: 500 });
    expect(result).toEqual([{ Id: "nuevo" }]);
    expect(mocks.findAppSheetRows).toHaveBeenCalledTimes(2);
  });

  it("fresh: true fuerza un fetch nuevo sin servir dato previo", async () => {
    mocks.findAppSheetRows.mockResolvedValueOnce([{ Id: "1" }]);
    await getTableRows("EC_Grados");

    mocks.findAppSheetRows.mockResolvedValueOnce([{ Id: "2" }]);
    const fresh = await getTableRows("EC_Grados", { fresh: true });
    expect(fresh).toEqual([{ Id: "2" }]);
    expect(mocks.findAppSheetRows).toHaveBeenCalledTimes(2);
  });

  it("propaga múltiples llamadas concurrentes sin pegar a AppSheet de más", async () => {
    let resolveFetch: ((rows: unknown[]) => void) | null = null;
    mocks.findAppSheetRows.mockImplementationOnce(
      () => new Promise((resolve) => { resolveFetch = resolve; }),
    );

    mocks.findAppSheetRows.mockResolvedValue([{ Id: "1" }]);

    const p1 = getTableRows("EC_Estudiantes");
    const p2 = getTableRows("EC_Estudiantes");
    const p3 = getTableRows("EC_Estudiantes");

    // deja que el chequeo a KV (no-op en estos tests) resuelva y se dispare el fetch
    await vi.advanceTimersByTimeAsync(0);
    resolveFetch!([{ Id: "1" }]);
    await Promise.all([p1, p2, p3]);

    expect(mocks.findAppSheetRows).toHaveBeenCalledTimes(1);
  });

  it("las mutaciones invalidan la caché de la tabla", async () => {
    mocks.findAppSheetRows.mockResolvedValue([{ Id: "1" }]);
    await getTableRows("EC_Asistencias");

    await addRows("EC_Asistencias", [{ AsistenciaID: "A1", Estado: "presente" }]);
    expect(mocks.findAppSheetRows).toHaveBeenCalledTimes(1);

    await getTableRows("EC_Asistencias");
    expect(mocks.findAppSheetRows).toHaveBeenCalledTimes(2);
  });
});

describe("appsheet.repository: capa compartida KV", () => {
  beforeEach(() => {
    mocks.findAppSheetRows.mockReset();
    mocks.kv.get.mockReset();
    mocks.kv.put.mockClear();
    mocks.kv.delete.mockClear();
    withoutKv();
    clearAppSheetCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    withoutKv();
    vi.useRealTimers();
  });

  it("un hit en KV frio evita llamar a AppSheet", async () => {
    withKv();
    mocks.kv.get.mockResolvedValue({ cachedAt: Date.now(), rows: [{ Id: "kv1" }] });

    const result = await getTableRows("EC_Estudiantes");
    expect(result).toEqual([{ Id: "kv1" }]);
    expect(mocks.findAppSheetRows).not.toHaveBeenCalled();
  });

  it("un hit en KV vencido sirve el snapshot y refresca en background una sola vez", async () => {
    withKv();
    mocks.kv.get.mockResolvedValue({ cachedAt: Date.now() - 16 * 60_000, rows: [{ Id: "kv" }] });

    let resolveRevalidate: ((rows: unknown[]) => void) | null = null;
    mocks.findAppSheetRows.mockImplementationOnce(
      () => new Promise((resolve) => { resolveRevalidate = resolve; }),
    );

    const first = await getTableRows("EC_Estudiantes");
    expect(first).toEqual([{ Id: "kv" }]);
    expect(mocks.findAppSheetRows).toHaveBeenCalledTimes(1);

    const second = await getTableRows("EC_Estudiantes");
    expect(second).toEqual([{ Id: "kv" }]);
    // el refresh en background es single-flight: no se disparó un segundo fetch
    expect(mocks.findAppSheetRows).toHaveBeenCalledTimes(1);

    resolveRevalidate!([{ Id: "nuevo" }]);
    await vi.runAllTimersAsync();

    const freshRead = await getTableRows("EC_Estudiantes");
    expect(freshRead).toEqual([{ Id: "nuevo" }]);
    expect(mocks.findAppSheetRows).toHaveBeenCalledTimes(1);

    // el refresh escribió de vuelta a KV para que otros isolates lo lean
    expect(mocks.kv.put).toHaveBeenCalledWith(
      kvKey("EC_Estudiantes"),
      expect.stringContaining('"rows":[{"Id":"nuevo"}]'),
    );
  });

  it("un fetch directo (miss total) escribe a KV (write-through)", async () => {
    mocks.findAppSheetRows.mockResolvedValue([{ Id: "1" }]);
    await getTableRows("EC_Grados");
    // sin KV: no debe escribir
    expect(mocks.kv.put).not.toHaveBeenCalled();

    withKv();
    await getTableRows("EC_Grados");
    // aun con KV, dato fresco en memoria no pega a KV ni a AppSheet
    expect(mocks.findAppSheetRows).toHaveBeenCalledTimes(1);
    expect(mocks.kv.put).not.toHaveBeenCalled();

    // al vencer la ventana fresca, refresca y escribe a KV
    await vi.advanceTimersByTimeAsync(16_000);
    mocks.kv.get.mockResolvedValue(null);
    mocks.findAppSheetRows.mockResolvedValue([{ Id: "2" }]);
    await getTableRows("EC_Grados", { cacheMs: 1_000, staleMs: 500 });
    await vi.runAllTimersAsync();
    expect(mocks.findAppSheetRows).toHaveBeenCalledTimes(2);
    expect(mocks.kv.put).toHaveBeenCalledWith(
      kvKey("EC_Grados"),
      expect.stringContaining('"rows":[{"Id":"2"}]'),
    );
  });

  it("las mutaciones limpian también la copia de KV", async () => {
    withKv();
    mocks.kv.get.mockResolvedValue(null);
    mocks.findAppSheetRows.mockResolvedValue([{ Id: "1" }]);
    await getTableRows("EC_Asistencias");

    await editRows("EC_Asistencias", [{ AsistenciaID: "A1", Estado: "ausente" }]);
    expect(mocks.kv.delete).toHaveBeenCalledWith(kvKey("EC_Asistencias"));
  });
});