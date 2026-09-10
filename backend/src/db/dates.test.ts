import { describe, expect, it } from "vitest";
import { isoToMysql, mysqlDateToDateOnly, mysqlToIsoLocal, mysqlToIsoUtc } from "./dates";

describe("helpers de fechas MySQL", () => {
  it("isoToMysql normaliza ISO/naive a 'YYYY-MM-DD HH:MM:SS'", () => {
    expect(isoToMysql("2026-09-01T15:00:00.000Z")).toBe("2026-09-01 15:00:00");
    expect(isoToMysql("2026-09-01T10:00:00")).toBe("2026-09-01 10:00:00");
    expect(isoToMysql("2026-09-01")).toBe("2026-09-01 00:00:00");
    expect(isoToMysql(null)).toBeNull();
    expect(isoToMysql("")).toBeNull();
  });

  it("mysqlToIsoUtc convierte el DATETIME leído a ISO UTC con Z (como nowIso)", () => {
    expect(mysqlToIsoUtc("2026-09-01 15:00:00")).toBe("2026-09-01T15:00:00.000Z");
    expect(mysqlToIsoUtc(null)).toBeNull();
    expect(mysqlToIsoUtc("")).toBeNull();
  });

  it("mysqlToIsoLocal preserva el reloj naive de Bogotá (como nowBogotaLocal)", () => {
    expect(mysqlToIsoLocal("2026-09-01 10:00:00")).toBe("2026-09-01T10:00:00");
    expect(mysqlToIsoLocal(null)).toBeNull();
  });

  it("mysqlDateToDateOnly normaliza una fecha DATE", () => {
    expect(mysqlDateToDateOnly("2026-09-01")).toBe("2026-09-01");
    expect(mysqlDateToDateOnly(null)).toBeNull();
  });
});