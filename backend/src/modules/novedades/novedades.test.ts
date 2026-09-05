import { describe, it, expect } from "vitest";
import {
  colombiaDateKey,
  colombiaStartOfDay,
  dayBounds,
  isOnDay,
  isActive,
  novedadesForColombiaDay,
  novedadDayName,
} from "./novedades.dates";
import { parseNovedadesJson, parseNovedadesRows } from "./novedades.parser";

// Helper: crear una fecha UTC explícita evitando ambigüedad de zona del runner.
const utc = (y: number, m: number, d: number, h = 0, mi = 0) =>
  new Date(Date.UTC(y, m - 1, d, h, mi));

describe("novedades.dates: día calendario de Colombia", () => {
  it("dayBounds de un día (YYYY-MM-DD) va 05:00Z → 05:00Z+1", () => {
    const { start, end } = dayBounds("2026-09-01")!;
    expect(start.toISOString()).toBe("2026-09-01T05:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-02T05:00:00.000Z");
  });

  it("isOnDay: novedad del 1/09 guardada como medianoche Bogotá (05:00Z) matchea el 1/09", () => {
    const novedad = { fechaNovedad: utc(2026, 9, 1, 5), fechaCreacion: null };
    expect(isOnDay(novedad, dayBounds("2026-09-01")!)).toBe(true);
  });

  it("isOnDay: novedad del 1/09 NO matchea el 2/09 ni el 31/08", () => {
    const novedad = { fechaNovedad: utc(2026, 9, 1, 5), fechaCreacion: null };
    expect(isOnDay(novedad, dayBounds("2026-09-02")!)).toBe(false);
    expect(isOnDay(novedad, dayBounds("2026-08-31")!)).toBe(false);
  });

  it("filtra el snapshot para conservar únicamente las novedades del día solicitado", () => {
    const rows = [
      { id: "anterior", fechaNovedad: utc(2026, 9, 1, 12) },
      { id: "actual", fechaNovedad: null, fechaHora: utc(2026, 9, 2, 15) },
      { id: "siguiente", fechaNovedad: utc(2026, 9, 3, 5) },
      { id: "sin-fecha", fechaNovedad: null, fechaHora: null, fechaCreacion: null },
    ];

    expect(novedadesForColombiaDay(rows, utc(2026, 9, 2, 18)).map((row) => row.id)).toEqual(["actual"]);
  });

  it("colombiaDateKey de un instante a las 00:00Z del 1/09 es el 31/08 (Bogotá)", () => {
    // 2026-09-01T00:00:00Z son las 19:00 del 31/08 en Bogotá.
    expect(colombiaDateKey(utc(2026, 9, 1, 0))).toBe("2026-08-31");
  });

  it("colombiaStartOfDay usa 05:00Z", () => {
    expect(colombiaStartOfDay(utc(2026, 9, 1, 12)).toISOString()).toBe("2026-09-01T05:00:00.000Z");
  });

  it("novedadDayName: miércoles 2026-09-02 (Bogotá) es MIERCOLES", () => {
    // 2026-09-02T12:00:00Z = 07:00 Bogotá del 02/09 → miércoles.
    expect(novedadDayName({ fechaNovedad: utc(2026, 9, 2, 12) })).toBe("MIERCOLES");
  });
});

describe("novedades.parser: fechas se guardan como reloj de Bogotá", () => {
  function parseRow(fechaNovedad: string) {
    const json = [
      {
        NovedadID_M: "N1",
        ScanCode: "12345",
        Fecha_Novedad: fechaNovedad,
      },
    ];
    return parseNovedadesJson(JSON.stringify(json), "test.xlsx");
  }

  it("fecha de solo-día '1/09/2026' se guarda como medianoche Bogotá = 05:00Z", () => {
    const [row] = parseRow("1/09/2026");
    expect(row.fechaNovedad!.toISOString()).toBe("2026-09-01T05:00:00.000Z");
    expect(colombiaDateKey(row.fechaNovedad!)).toBe("2026-09-01");
  });

  it("fecha con hora '1/09/2026 14:30' se guarda como 19:30Z (14:30 Bogotá)", () => {
    const [row] = parseRow("1/09/2026 14:30");
    expect(row.fechaNovedad!.toISOString()).toBe("2026-09-01T19:30:00.000Z");
    expect(colombiaDateKey(row.fechaNovedad!)).toBe("2026-09-01");
  });

  it("ISO con zona explícita no se desplaza", () => {
    const [row] = parseRow("2026-09-01T14:00:00Z");
    expect(row.fechaNovedad!.toISOString()).toBe("2026-09-01T14:00:00.000Z");
  });

  it("isActive: novedad de hoy/después es activa; una vieja no", () => {
    const hoy = colombiaStartOfDay(new Date());
    const futura = { fechaNovedad: new Date(hoy.getTime() + 3600_000), fechaCreacion: null };
    const vieja = { fechaNovedad: new Date(hoy.getTime() - 24 * 3600_000), fechaCreacion: null };
    expect(isActive(futura)).toBe(true);
    expect(isActive(vieja)).toBe(false);
  });
});

describe("novedades.parser: filas directas de AppSheet", () => {
  it("mapea una fila de Novedades_Diarias y expande los códigos", () => {
    const rows = parseNovedadesRows([
      {
        NovedadID_M: "NOV-APP-1",
        ScanCode: "1001, 1002",
        Fecha_Novedad: "4/09/2026",
        "Tipo de Novedad": "Salida",
      },
    ], "Novedades_Diarias");

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.codigoEstudiante)).toEqual(["1001", "1002"]);
    expect(rows[0].fechaNovedad?.toISOString()).toBe("2026-09-04T05:00:00.000Z");
  });

  it("descarta fechas numéricas fuera del rango escolar en lugar de crear años anómalos", () => {
    const [row] = parseNovedadesRows([
      {
        NovedadID_M: "NOV-APP-2",
        ScanCode: "1001",
        Fecha_Novedad: "2251719",
      },
    ], "Novedades_Diarias");

    expect(row.fechaNovedad).toBeNull();
  });
});
