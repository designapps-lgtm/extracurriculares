import { normalizeStudentName } from "../../import/excel/excelMapper";

/** Fila plana de estudiante con columnas de ruta; las claves LU_7_AM viven normalizadas en student_routes. */
type RutaRow = Record<string, unknown>;

const DAY_CODES: Record<string, string> = {
  LU: "LUNES",
  MA: "MARTES",
  MI: "MIERCOLES",
  JU: "JUEVES",
  VI: "VIERNES",
  SA: "SABADO",
};

const DAY_ORDER: Record<string, number> = {
  LUNES: 0,
  MARTES: 1,
  MIERCOLES: 2,
  JUEVES: 3,
  VIERNES: 4,
  SABADO: 5,
};

export interface RutaSlot {
  columnKey: string;
  diaSemana: string;
  hora: string;
  sortKey: string;
}

export interface RutaEstudiante {
  codigo: string;
  nombre: string;
  grupo: string | null;
  ruta: RutaSlot[];
}

export interface RutasReport {
  generatedAt: string;
  slots: RutaSlot[];
  estudiantes: RutaEstudiante[];
}

function normalizeKey(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function formatHora12(hour: number, minuto: number, meridiem: "AM" | "PM"): string {
  return `${hour}:${String(minuto).padStart(2, "0")} ${meridiem}`;
}

function toMinutes24(hour: number, minuto: number, meridiem: "AM" | "PM"): number {
  const base = hour % 12;
  return base * 60 + minuto + (meridiem === "PM" ? 12 * 60 : 0);
}

/**
 * Detecta columnas de ruta tipo "LU_7_AM", "MA_1_PM", "MI_7_30_AM", "LU_8"...
 * Normaliza la clave (mayúsculas, sin símbolos) y parsea día + hora + meridiem.
 */
export function parseRutaColumnKey(columnKey: string): RutaSlot | null {
  if (!columnKey) return null;

  const normalized = normalizeKey(columnKey);
  const match = /^(LU|MA|MI|JU|VI|SA)(\d{1,2})(\d{2})?(AM|PM)?$/.exec(normalized);
  if (!match) return null;

  const diaSemana = DAY_CODES[match[1]];
  const hora = parseInt(match[2], 10);
  const minuto = match[3] ? parseInt(match[3], 10) : 0;
  if (minuto > 59 || hora > 23) return null;

  const meridiem = match[4] as "AM" | "PM" | undefined;
  let label: string;
  let sortMinutes: number;
  if (meridiem) {
    label = formatHora12(hora, minuto, meridiem);
    sortMinutes = toMinutes24(hora, minuto, meridiem);
  } else {
    label = `${hora}:${String(minuto).padStart(2, "0")}`;
    sortMinutes = hora * 60 + minuto;
  }

  return {
    columnKey,
    diaSemana,
    hora: label,
    sortKey: `${DAY_ORDER[diaSemana]}-${String(sortMinutes).padStart(4, "0")}`,
  };
}

function getCell(row: RutaRow, candidates: string[]): string {
  for (const candidate of candidates) {
    const value = row[candidate];
    if (value !== undefined && value !== null) return String(value).trim();
  }
  return "";
}

function isSlotMarked(row: RutaRow, columnKey: string): boolean {
  const value = row[columnKey];
  if (value === undefined || value === null) return false;
  return String(value).trim().length > 0;
}

function sortSlots(slots: RutaSlot[]): RutaSlot[] {
  return [...slots].sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));
}

/** Reporte de estudiantes que se van en ruta: cruza las columnas de día/hora de Demograficos. */
export function buildRutasReport(rows: RutaRow[]): RutasReport {
  const slotByKey = new Map<string, RutaSlot>();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    for (const columnKey of Object.keys(row)) {
      if (!slotByKey.has(columnKey)) {
        const slot = parseRutaColumnKey(columnKey);
        if (slot) slotByKey.set(columnKey, slot);
      }
    }
  }

  const byCodigo = new Map<string, RutaEstudiante>();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;

    const barcode = getCell(row, ["BARCODE"]);
    if (!barcode) continue;

    const ruta: RutaSlot[] = [];
    for (const slot of slotByKey.values()) {
      if (isSlotMarked(row, slot.columnKey)) ruta.push(slot);
    }
    if (ruta.length === 0) continue;

    if (byCodigo.has(barcode)) continue;

    const firstName = normalizeStudentName(getCell(row, ["FIRST NAME", "FIRST_NAME", "NOMBRE", "PRIMER NOMBRE", "PRIMER_NOMBRE"]));
    const middleName = normalizeStudentName(getCell(row, ["MIDDLE NAME", "MIDDLE_NAME", "SEGUNDO NOMBRE", "SEGUNDO_NOMBRE", "NOMBRE 2", "NOMBRE2"]));
    const lastName = normalizeStudentName(getCell(row, ["LAST NAME", "LAST_NAME", "APELLIDO", "APELLIDOS"]));
    const grupo = getCell(row, ["HOMEROOM"]) || null;

    byCodigo.set(barcode, {
      codigo: barcode,
      nombre: [firstName, middleName, lastName].filter(Boolean).join(" "),
      grupo: grupo || null,
      ruta: sortSlots(ruta),
    });
  }

  const estudiantes = [...byCodigo.values()].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }) || a.codigo.localeCompare(b.codigo),
  );

  return {
    generatedAt: new Date().toISOString(),
    slots: sortSlots([...slotByKey.values()]),
    estudiantes,
  };
}