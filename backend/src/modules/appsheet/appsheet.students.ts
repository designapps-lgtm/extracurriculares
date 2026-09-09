import { config } from "../../config";
import { nowIso } from "../../utils/colombiaTime";
import { normalizeStudentName, type MappedStudent } from "../../import/excel/excelMapper";
import { findAppSheetRows, type AppSheetRow } from "./appsheet.service";
import { addRows, deleteRows, APPSHEET_TABLES } from "./appsheet.repository";
import { getEnrollments } from "./appsheet.domain";
import { computeEnrollmentReconcile } from "./appsheet.reconcile";

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

function deriveMiddleName(firstName: string, lastName: string, fullName: string): string {
  if (!firstName || !fullName) return "";

  const source = fullName.trim();
  const lastFirstPrefix = [lastName, firstName].filter(Boolean).join(" ");
  if (lastFirstPrefix && source.startsWith(`${lastFirstPrefix} `)) {
    return source.slice(lastFirstPrefix.length).trim();
  }

  if (source.startsWith(`${firstName} `)) {
    let remainder = source.slice(firstName.length).trim();
    if (lastName && remainder.endsWith(` ${lastName}`)) {
      remainder = remainder.slice(0, -(lastName.length + 1)).trim();
    }
    return remainder;
  }

  return "";
}

/** Mapea únicamente los campos vigentes del Sheet; ACTIVE_INACTIVE se ignora. */
export function mapAppSheetStudents(rows: AppSheetRow[]): MappedStudent[] {
  return rows
    .map((row, index): MappedStudent | null => {
      if (!row || typeof row !== "object") return null;

      const barcode = getCell(row, ["BARCODE"]);
      if (!barcode) return null;

      const firstName = normalizeStudentName(getCell(row, [
        "FIRST NAME", "FIRST_NAME", "FIRSTNAME", "NOMBRE", "PRIMER NOMBRE", "PRIMER_NOMBRE",
      ]));
      const middleNameFromColumn = normalizeStudentName(getCell(row, [
        "MIDDLE NAME", "MIDDLE_NAME", "MIDDLENAME", "SECOND NAME", "SECOND_NAME",
        "SEGUNDO NOMBRE", "SEGUNDO_NOMBRE", "NOMBRE 2", "NOMBRE2",
      ]));
      const lastName = normalizeStudentName(getCell(row, [
        "LAST NAME", "LAST_NAME", "LASTNAME", "APELLIDO", "APELLIDOS",
      ]));
      const fullName = normalizeStudentName(getCell(row, [
        "FULL_NAME", "FULL NAME", "FULLNAME", "NOMBRE COMPLETO", "NOMBRE_COMPLETO",
      ]));
      const middleName = middleNameFromColumn || deriveMiddleName(firstName, lastName, fullName);
      const gradeNombre = getCell(row, ["GRADE", "GRADO"]);
      const homeroom = getCell(row, ["HOMEROOM"]);
      const email = getCell(row, ["STUDENT_EMAIL", "STUDENTEMAIL"]);

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
        sourceFirstName: firstName,
        sourceMiddleName: middleName,
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
  /** Filas de EC_Inscripciones agregadas por el reconcile CC_* -> EC. */
  enrollmentAdded: number;
  /** Filas de EC_Inscripciones eliminadas por el reconcile CC_* -> EC. */
  enrollmentRemoved: number;
  /** Estudiantes cuyo conjunto de inscripciones cambió tras el reconcile. */
  enrollmentChangedStudents: number;
  /** Códigos de estudiantes con inscripciones en EC pero ausentes de Demograficos (no se tocan). */
  enrollmentOrphanCodes: string[];
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
    enrollmentAdded: 0,
    enrollmentRemoved: 0,
    enrollmentChangedStudents: 0,
    enrollmentOrphanCodes: [],
    errors,
  };
}

function validateMappedStudents(rows: AppSheetRow[], students: MappedStudent[]): string[] {
  const errors: string[] = [];
  // AppSheet puede devolver filas vacías del rango usado en Google Sheets.
  // No deben invalidar el lote completo: sólo se descartan esas filas sin BARCODE.
  if (students.length === 0) {
    errors.push("AppSheet no devolvió ninguna fila válida con BARCODE; no se aplicó ningún cambio");
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

export interface EnrollmentReconcileApplied {
  added: number;
  removed: number;
  changedStudents: number;
  orphanCodes: string[];
}

/**
 * Deja EC_Inscripciones como espejo de las columnas CC_* de Demograficos:
 * - Consulta el estado actual de EC_Inscripciones (fuera del caché compartido).
 * - Calcula el diff con computeEnrollmentReconcile.
 * - Agrega las filas faltantes y elimina las sobradas con la llave compuesta.
 * - Los huérfanos (estudiante ausente de Demograficos) se reportan, no se borran.
 */
export async function applyEnrollmentReconcile(students: MappedStudent[]): Promise<EnrollmentReconcileApplied> {
  if (students.length === 0) return { added: 0, removed: 0, changedStudents: 0, orphanCodes: [] };

  const enrollments = await getEnrollments({ fresh: true });
  const diff = computeEnrollmentReconcile(students, enrollments);

  const timestamp = nowIso();
  const additionRows: AppSheetRow[] = diff.additions.map((row) => ({
    InscripcionID: crypto.randomUUID(),
    CodigoEstudiante: row.studentCode,
    CodigoDisciplina: row.disciplineCode,
    DiaSemana: row.day,
    EstadoRegistro: "activo",
    CreatedAt: timestamp,
    UpdatedAt: timestamp,
  }));

  if (additionRows.length > 0) await addRows(APPSHEET_TABLES.enrollments, additionRows);
  if (diff.removals.length > 0) {
    await deleteRows(APPSHEET_TABLES.enrollments, diff.removals.map((row) => ({ InscripcionID: row.id })));
  }

  return {
    added: additionRows.length,
    removed: diff.removals.length,
    changedStudents: diff.changedStudents,
    orphanCodes: diff.orphanCodes,
  };
}

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

  // AppSheet/Sheets es ahora la fuente final; el snapshot se valida y luego se
  // reconcilian las inscripciones operativas (EC_Inscripciones) contra las
  // columnas CC_* para que la app refleje lo que el colegio carga en el Sheet.
  let reconciled: EnrollmentReconcileApplied;
  try {
    reconciled = await applyEnrollmentReconcile(students);
  } catch (error) {
    return failedSync([
      ...validationErrors,
      `reconcile de inscripciones falló: ${error instanceof Error ? error.message : String(error)}`,
    ], rows.length, students.length, rows.length - students.length);
  }

  return {
    ok: true,
    table: DEMOGRAFICOS_TABLE,
    received: rows.length,
    mapped: students.length,
    middleNames: students.filter((student) => Boolean(student.sourceMiddleName)).length,
    rejected: rows.length - students.length,
    processed: students.length,
    created: 0,
    updated: 0,
    enrollmentAdded: reconciled.added,
    enrollmentRemoved: reconciled.removed,
    enrollmentChangedStudents: reconciled.changedStudents,
    enrollmentOrphanCodes: reconciled.orphanCodes,
    errors: [],
  };
}

/** Evita que dos webhooks ejecuten la misma validación simultáneamente. */
export function syncAppSheetStudents(): Promise<AppSheetStudentSyncResult> {
  if (runningSync) return runningSync;

  const current = runAppSheetStudentsSync();
  runningSync = current.finally(() => {
    runningSync = null;
  });
  return runningSync;
}
