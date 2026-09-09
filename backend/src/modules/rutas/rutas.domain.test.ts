import { describe, expect, it } from "vitest";
import { parseRutaColumnKey, buildRutasReport } from "./rutas.domain";

describe("rutas.domain: parseRutaColumnKey", () => {
  it("LU_7_AM es LUNES 7:00 AM", () => {
    const slot = parseRutaColumnKey("LU_7_AM");
    expect(slot).toEqual({
      columnKey: "LU_7_AM",
      diaSemana: "LUNES",
      hora: "7:00 AM",
      sortKey: "0-0420",
    });
  });

  it("LU_7_30_AM es 7:30 AM", () => {
    const slot = parseRutaColumnKey("LU_7_30_AM");
    expect(slot?.hora).toBe("7:30 AM");
  });

  it("MA_1_PM ordena como 13:00 (después de las 12 del mediodía)", () => {
    const slot = parseRutaColumnKey("MA_1_PM");
    expect(slot).toMatchObject({ diaSemana: "MARTES", hora: "1:00 PM", sortKey: "1-0780" });
  });

  it("MI_12_PM es mediodía (12:00 PM) y JU_12_AM es 12:00 AM", () => {
    expect(parseRutaColumnKey("MI_12_PM")).toMatchObject({ hora: "12:00 PM", sortKey: "2-0720" });
    expect(parseRutaColumnKey("JU_12_AM")).toMatchObject({ hora: "12:00 AM", sortKey: "3-0000" });
  });

  it("VI_5_PM y VI_7_AM son VIERNES", () => {
    expect(parseRutaColumnKey("VI_5_PM")).toMatchObject({ diaSemana: "VIERNES", hora: "5:00 PM" });
    expect(parseRutaColumnKey("vi_7_am")).toMatchObject({ diaSemana: "VIERNES", hora: "7:00 AM" });
  });

  it("sin meridiem (LU_8) se interpreta como hora de 24h", () => {
    expect(parseRutaColumnKey("LU_8")).toMatchObject({ diaSemana: "LUNES", hora: "8:00" });
  });

  it("columnas que no son de ruta devuelven null", () => {
    expect(parseRutaColumnKey("CC_LUNES")).toBeNull();
    expect(parseRutaColumnKey("GRADE")).toBeNull();
    expect(parseRutaColumnKey("FIRST NAME")).toBeNull();
    expect(parseRutaColumnKey("HOMEROOM")).toBeNull();
  });
});

describe("rutas.domain: buildRutasReport", () => {
  const row = (overrides: Record<string, unknown>) => ({
    BARCODE: "1000000001",
    "FIRST NAME": "Ana",
    "MIDDLE NAME": "Sofía",
    "LAST NAME": "López",
    GRADO: "3A",
    HOMEROOM: "301",
    ...overrides,
  });

  it("arma el reporte con el día y hora de cada celda marcada", () => {
    const report = buildRutasReport([
      row({ LU_7_AM: "X", MA_1_PM: "Ruta 1" }),
    ]);

    expect(report.slots.map((s) => s.diaSemana)).toEqual(["LUNES", "MARTES"]);
    expect(report.estudiantes).toHaveLength(1);
    expect(report.estudiantes[0]).toMatchObject({
      codigo: "1000000001",
      nombre: "Ana Sofia Lopez",
      grupo: "301",
    });
    expect(report.estudiantes[0].ruta.map((s) => `${s.diaSemana} ${s.hora}`)).toEqual([
      "LUNES 7:00 AM",
      "MARTES 1:00 PM",
    ]);
  });

  it("cualquier valor no vacío (incluso '0') cuenta como va en ruta", () => {
    const report = buildRutasReport([
      row({ LU_7_AM: "0", VI_5_PM: "  " }),
    ]);
    expect(report.estudiantes[0].ruta).toHaveLength(1);
    expect(report.estudiantes[0].ruta[0].diaSemana).toBe("LUNES");
  });

  it("excluye estudiantes sin ninguna marca de ruta y filas sin BARCODE", () => {
    const report = buildRutasReport([
      row({ LU_7_AM: "X" }),
      row({ LU_7_AM: "" }),
      { "FIRST NAME": "Sin código", LU_7_AM: "X" },
    ]);
    expect(report.estudiantes).toHaveLength(1);
    expect(report.estudiantes[0].codigo).toBe("1000000001");
  });

  it("ordena slots por día (LU→VI) y por hora (7 AM antes de 12 PM)", () => {
    const report = buildRutasReport([
      row({ VI_12_PM: "X", LU_7_AM: "X", SA_7_AM: "X" }),
    ]);
    expect(report.slots.map((s) => s.diaSemana)).toEqual(["LUNES", "VIERNES", "SABADO"]);
    expect(report.estudiantes[0].ruta.map((s) => `${s.diaSemana} ${s.hora}`)).toEqual([
      "LUNES 7:00 AM",
      "VIERNES 12:00 PM",
      "SABADO 7:00 AM",
    ]);
  });

  it("deduplica estudiantes con BARCODE repetido (queda el primero) y ordena por nombre", () => {
    const report = buildRutasReport([
      row({ BARCODE: "2", "FIRST NAME": "Berta", LU_7_AM: "X" }),
      row({ BARCODE: "1", "FIRST NAME": "Ana", LU_7_AM: "X" }),
      row({ BARCODE: "1", "FIRST NAME": "Ana Duplicada", MA_1_PM: "X" }),
    ]);
    expect(report.estudiantes).toHaveLength(2);
    expect(report.estudiantes.map((e) => e.codigo)).toEqual(["1", "2"]);
    expect(report.estudiantes.find((e) => e.codigo === "1")?.ruta).toHaveLength(1);
  });
});