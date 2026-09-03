import { config } from "../../config";
import { importStudents } from "../../import/excel/studentImporter";
import { normalizeStudentName, type MappedStudent } from "../../import/excel/excelMapper";
import { findAppSheetRows, type AppSheetRow } from "./appsheet.service";

// Fuente de verdad de estudiantes en AppSheet (tabla Demograficos del Sheet
// "DEMOGRAFICOS 2026-2027"). El Sheet se comparte con la cuenta del colegio y
// AppSheet expone la tabla por API; por eso no hace falta el acceso de la
// service account al archivo.
const DEMOGRAFICOS_TABLE = config.appsheetDemograficosTable;

const DAY_COLUMN_KEYS: Array<{ keys: string[]; diaSemana: string }> = [
  { keys: ["CC_LUNES", "CC LUNES", "CC_LUNES_", "CCLUNES"], diaSemana: "LUNES" },
  { keys: ["CC_MARTES", "CC MARTES", "CC_MARTES_", "CCMARTES"], diaSemana: "MARTES" },
  { keys: ["CC_MIERCOLES", "CC MIERCOLES", "CC_MIERCOLES_", "CCMIERCOLES"], diaSemana: "MIERCOLES" },
  { keys: ["CC_JUEVES", "CC JUEVES", "CC_JUEVES_", "CCJUEVES"], diaSemana: "JUEVES" },
  { keys: ["CC_VIERNES", "CC VIERNES", "CC_VIERNES_", "CCVIERNES"], diaSemana: "VIERNES" },
  { keys: ["CC_SABADO", "CC SABADO", "CC_SABADO_", "CCSABADO"], diaSemana: "SABADO" },
];

function normalizeKey(value: string): string {
  return normalizeStudentName(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function getCell(row: AppSheetRow, candidates: string[]): string {
  for (const candidate of candidates) {
    const exact = row[candidate];
    if (exact !== undefined && exact !== null) {
      return String(exact).trim();
    }
  }
  const normalizedCandidates = new Set(candidates.map(normalizeKey));
  for (const [key, value] of Object.entries(row)) {
    if (normalizedCandidates.has(normalizeKey(key)) && value !== undefined && value !== null) {
      return String(value).trim();
    }
  }
  return "";
}

function mapEstado(value: string): "activo" | "inactivo" | undefined {
  const normalized = value.trim().toUpperCase();
  if (["ACTIVE", "ACTIVO", "ACTIVA"].includes(normalized)) return "activo";
  if (["INACTIVE", "INACTIVO", "INACTIVA"].includes(normalized)) return "inactivo";
  return undefined;
}

export function mapAppSheetStudents(rows: AppSheetRow[]): MappedStudent[] {
  return rows
    .map((row, index): MappedStudent | null => {
      if (!row || typeof row !== "object") return null;

      const barcode = getCell(row, ["BARCODE"]);
      if (!barcode) return null;

      const firstName = normalizeStudentName(getCell(row, [
        "FIRST NAME", "FIRST_NAME", "FIRSTNAME", "NOMBRE", "PRIMER NOMBRE", "PRIMER_NOMBRE",
      ]));
      const middleName = normalizeStudentName(getCell(row, [
        "MIDDLE NAME", "MIDDLE_NAME", "MIDDLENAME", "SECOND NAME", "SECOND_NAME",
        "SEGUNDO NOMBRE", "SEGUNDO_NOMBRE", "NOMBRE 2", "NOMBRE2",
      ]));
      const lastName = normalizeStudentName(getCell(row, [
        "LAST NAME", "LAST_NAME", "LASTNAME", "APELLIDO", "APELLIDOS",
      ]));
      const gradeNombre = getCell(row, ["GRADE", "GRADO"]);
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
        nombre: [firstName, middleName].filter(Boolean).join(" "),
        apellido: lastName,
        gradeNombre,
        grupo: homeroom || null,
        correo: email || null,
        schedules,
        _excelRow: index + 2,
        estado: estadoValue ? mapEstado(estadoValue) : undefined,
        sourceFirstName: firstName,
        sourceMiddleName: middleName,
        sourceEstado: estadoValue,
      };
    })
    .filter((student): student is MappedStudent => student !== null);
}

export interface AppSheetStudentSyncResult {
  ok: boolean;
  table: string;
  received: number;
  mapped: number;
  middleNames: number;
  rejected: number;
  processed: number;
  created: number;
  updated: number;
  errors: string[];
}

function failedSync(
  errors: string[],
  received = 0,
  mapped = 0,
  rejected = 0,
): AppSheetStudentSyncResult {
  return {
    ok: false,
    table: DEMOGRAFICOS_TABLE,
    received,
    mapped,
    middleNames: 0,
    rejected,
    processed: 0,
    created: 0,
    updated: 0,
    errors,
  };
}

function validateMappedStudents(rows: AppSheetRow[], students: MappedStudent[]): string[] {
  const errors: string[] = [];
  const missingBarcode = rows.length - students.length;
  if (missingBarcode > 0) {
    errors.push(`${missingBarcode} fila(s) no tienen BARCODE; se descartó el lote completo`);
  }

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const student of students) {
    if (seen.has(student.codigoEstudiante)) duplicates.add(student.codigoEstudiante);
    seen.add(student.codigoEstudiante);

    const missing: string[] = [];
    if (!student.sourceFirstName) missing.push("FIRST NAME");
    if (!student.apellido) missing.push("LAST NAME");
    if (!student.gradeNombre) missing.push("GRADE");
    if (student.sourceEstado && !student.estado) missing.push("ACTIVE_INACTIVE válido");
    if (missing.length > 0) {
      errors.push(`${student.codigoEstudiante}: faltan ${missing.join(", ")}`);
    }
  }

  if (duplicates.size > 0) {
    errors.push(`BARCODE duplicado(s): ${[...duplicates].slice(0, 10).join(", ")}`);
  }
  return errors;
}

let runningSync: Promise<AppSheetStudentSyncResult> | null = null;

async function runAppSheetStudentsSync(): Promise<AppSheetStudentSyncResult> {
  let rows: AppSheetRow[];
  try {
    rows = await findAppSheetRows(DEMOGRAFICOS_TABLE);
  } catch (error) {
    return failedSync([error instanceof Error ? error.message : String(error)]);
  }

  // No borrar/desactivar toda la base si AppSheet devuelve una respuesta vacía
  // por un nombre de tabla incorrecto, una clave inválida o una falla temporal.
  if (rows.length === 0) {
    return failedSync(["AppSheet devolvió 0 filas; no se aplicó ningún cambio"]);
  }

  const students = mapAppSheetStudents(rows);
  const validationErrors = validateMappedStudents(rows, students);
  if (validationErrors.length > 0) {
    return failedSync(validationErrors.slice(0, 20), rows.length, students.length, rows.length - students.length);
  }

  let result;
  try {
    result = await importStudents(students, false, {
      // Un snapshot AppSheet sin un indicador de completitud no permite saber
      // si una fila ausente fue eliminada o si la respuesta llegó truncada.
      // Los estados explícitos del origen sí se actualizan; no desactivamos por
      // ausencia hasta contar con una confirmación de snapshot completo.
      deactivateAbsent: false,
    });
  } catch (error) {
    return failedSync(
      [`Error de base de datos durante la importación: ${error instanceof Error ? error.message : String(error)}`],
      rows.length,
      students.length,
      0,
    );
  }

  return {
    ok: result.errors === 0,
    table: DEMOGRAFICOS_TABLE,
    received: rows.length,
    mapped: students.length,
    middleNames: students.filter((student) => Boolean(student.sourceMiddleName)).length,
    rejected: 0,
    processed: result.processed,
    created: result.created,
    updated: result.updated,
    errors: result.errorDetails.slice(0, 10).map((e) => `${e.codigo}: ${e.error}`),
  };
}

/** Evita que un webhook y el cron ejecuten dos importaciones simultáneas. */
export function syncAppSheetStudents(): Promise<AppSheetStudentSyncResult> {
  if (runningSync) return runningSync;

  const current = runAppSheetStudentsSync();
  runningSync = current.finally(() => {
    runningSync = null;
  });
  return runningSync;
}
