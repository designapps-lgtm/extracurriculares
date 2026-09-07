import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../config", () => ({
  config: {
    appsheetAppId: "test-app-id",
    appsheetAccessKey: "test-access-key",
  },
}));

import {
  AppSheetApiError,
  addAppSheetRows,
  findAppSheetRows,
} from "./appsheet.service";

const fetchMock = vi.fn();

function response(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AppSheet HTTP client", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("ejecuta Find y extrae filas de una respuesta válida", async () => {
    fetchMock.mockResolvedValue(response(JSON.stringify({ Rows: [{ UsuarioID: "U1" }] })));

    await expect(findAppSheetRows("Usuarios_Roles", "Filter(Usuarios_Roles, true)")).resolves.toEqual([
      { UsuarioID: "U1" },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/test-app-id/tables/Usuarios_Roles/Action");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("ApplicationAccessKey")).toBe("test-access-key");
    expect(JSON.parse(String(init.body))).toMatchObject({
      Action: "Find",
      Properties: { Locale: "es-CO", Timezone: "America/Bogota", Selector: "Filter(Usuarios_Roles, true)" },
      Rows: [],
    });
  });

  it("reintenta Find hasta tres veces ante HTTP 429", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async () => response("rate limited", 429));

    const pending = findAppSheetRows("Usuarios_Roles");
    const assertion = expect(pending).rejects.toMatchObject({
      status: 429,
      table: "Usuarios_Roles",
      action: "Find",
    });

    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("aborta Find por timeout y reporta un error estructurado", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      }, { once: true });
    }));

    const pending = findAppSheetRows("EC_Estudiantes");
    const assertion = expect(pending).rejects.toMatchObject({
      status: 504,
      table: "EC_Estudiantes",
      action: "Find",
      timedOut: true,
    });

    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("rechaza una respuesta JSON inválida sin ocultar el tipo de fallo", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async () => response("{not-json"));

    const pending = findAppSheetRows("EC_Horarios");
    const assertion = expect(pending).rejects.toSatisfy((error: unknown) =>
      error instanceof AppSheetApiError
      && error.status === 502
      && error.message.includes("JSON inválido")
      && error.responseBody === "{not-json",
    );

    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("no reintenta mutaciones aunque AppSheet responda 429", async () => {
    fetchMock.mockImplementation(async () => response("rate limited", 429));

    await expect(addAppSheetRows("EC_Asistencias", [{ AsistenciaID: "A1" }])).rejects.toMatchObject({
      status: 429,
      action: "Add",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
