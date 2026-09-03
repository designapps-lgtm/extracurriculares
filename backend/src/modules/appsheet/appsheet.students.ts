import { findAppSheetRows, type AppSheetRow } from "./appsheet.service";
import { importStudents } from "../../import/excel/studentImporter";
import type { MappedStudent } from "../../import/excel/excelMapper";

// Fuente de verdad de estudiantes en AppSheet (tabla Demograficos del Sheet
// "DEMOGRAFICOS 2026-2027"). El Sheet se comparte con la cuenta del colegio y
// AppSheet expone la tabla por API; por eso no hace falta el acceso de la
// service account al archivo.
const DEMOGRAFICOS_TABLE = process.env.APPSHEET_DEMOGRAFICOS_TABLE || "Demograficos";

const DAY_COLUMN_KEYS: Array<{ keys: string[]; diaSemana: string }> = [
  { keys: ["CC_LUNES", "CC LUNES", "CC_LUNES_", "CCLUNES"], diaSemana: "LUNES" },
  { keys: ["CC_MARTES", "CC MARTES", "CC_MARTES_", "CCMARTES"], diaSemana: "MARTES" },
  { keys: ["CC_MIERCOLES", "CC MIERCOLES", "CC_MIERCOLES_", "CCMIERCOLES"], diaSemana: "MIERCOLES" },
  { keys: ["CC_JUEVES", "CC JUEVES", "CC_JUEVES_", "CCJUEVES"], diaSemana: "JUEVES" },
  { keys: ["CC_VIERNES", "CC VIERNES", "CC_VIERNES_", "CCVIERNES"], diaSemana: "VIERNES" },
  { keys: ["CC_SABADO", "CC SABADO", "CC_SABADO_", "CCSABADO"], diaSemana: "SABADO" },
];

function normalizeKey(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function getCell(row: AppSheetRow, candidates: string[]): string {
  for (const candidate of candidates) {
    const exact = row[candidate];
    if (exact !== undefined && exact !== null) {
      return String(exact).trim();
    }
  }
  const normalized = normalizeKey(candidates[0]);
  for (const [key, value] of Object.entries(row)) {
    if (normalizeKey(key) === normalized && value !== undefined && value !== null) {
      return String(value).trim();
    }
  }
  return "";
}

function mapEstado(value: string): "activo" | "inactivo" {
  const text = value.toUpperCase();
  if (text.includes("INACT")) return "inactivo";
  return "activo";
}

export function mapAppSheetStudents(rows: AppSheetRow[]): MappedStudent[] {
  return rows
    .map((row, index): MappedStudent | null => {
      const barcode = getCell(row, ["BARCODE"]);
      if (!barcode) return null;

      const firstName = getCell(row, ["FIRST NAME", "FIRST_NAME", "FIRSTNAME"]);
      const middleName = getCell(row, ["MIDDLE NAME", "MIDDLE_NAME", "MIDDLENAME"]);
      const lastName = getCell(row, ["LAST NAME", "LAST_NAME", "LASTNAME"]);
      const gradeNombre = getCell(row, ["GRADE"]);
      const homeroom = getCell(row, ["HOMEROOM"]);
      const email = getCell(row, ["STUDENT_EMAIL", "STUDENTEMAIL"]);
      const estadoValue = getCell(row, ["ACTIVE_INACTIVE", "ACTIVE INACTIVE", "ACTIVEINACTIVE", "ESTADO"]);

      const schedules = DAY_COLUMN_KEYS.flatMap((day) => {
        const disciplina = getCell(row, day.keys);
        if (!disciplina) return [];
        return [{ codigoDisciplina: disciplina, diaSemana: day.diaSemana }];
      });

      return {
        codigoEstudiante: barcode,
        nombre: middleName ? `${firstName} ${middleName}`.trim() : firstName,
        apellido: lastName,
        gradeNombre,
        grupo: homeroom || null,
        correo: email || null,
        schedules,
        _excelRow: index + 2,
        estado: estadoValue ? mapEstado(estadoValue) : undefined,
      };
    })
    .filter((student): student is MappedStudent => student !== null);
}

export interface AppSheetStudentSyncResult {
  ok: boolean;
  table: string;
  processed: number;
  created: number;
  updated: number;
  errors: string[];
}

export async function syncAppSheetStudents(): Promise<AppSheetStudentSyncResult> {
  let rows: AppSheetRow[];
  try {
    rows = await findAppSheetRows(DEMOGRAFICOS_TABLE);
  } catch (error) {
    return {
      ok: false,
      table: DEMOGRAFICOS_TABLE,
      processed: 0,
      created: 0,
      updated: 0,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
  // No borrar/desactivar toda la base si AppSheet devuelve una respuesta vacía
  // por un nombre de tabla incorrecto, una clave inválida o una falla temporal.
  if (rows.length === 0) {
    return {
      ok: false,
      table: DEMOGRAFICOS_TABLE,
      processed: 0,
      created: 0,
      updated: 0,
      errors: ["AppSheet devolvió 0 filas; no se aplicó ningún cambio"],
    };
  }

  const students = mapAppSheetStudents(rows);
  if (students.length === 0) {
    return {
      ok: false,
      table: DEMOGRAFICOS_TABLE,
      processed: 0,
      created: 0,
      updated: 0,
      errors: ["AppSheet devolvió filas, pero ninguna contiene BARCODE válido; no se aplicó ningún cambio"],
    };
  }

  const result = await importStudents(students, false);

  return {
    ok: result.errors === 0,
    table: DEMOGRAFICOS_TABLE,
    processed: result.processed,
    created: result.created,
    updated: result.updated,
    errors: result.errorDetails.slice(0, 10).map((e) => `${e.codigo}: ${e.error}`),
  };
}
