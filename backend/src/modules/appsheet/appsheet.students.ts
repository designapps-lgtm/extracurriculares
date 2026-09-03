import { config } from "../../config";
import { sql } from "../../config/db";
import { importStudents } from "../../import/excel/studentImporter";
import { normalizeGradeAndGroup, normalizeStudentCode } from "../../import/excel/normalization";
import type { MappedStudent } from "../../import/excel/excelMapper";
import { findAppSheetRows, type AppSheetRow } from "./appsheet.service";

const DAY_COLUMN_KEYS: Array<{ keys: string[]; diaSemana: string }> = [
  { keys: ["CC_LUNES", "CC LUNES", "CC_LUNES_", "CCLUNES", "LUNES"], diaSemana: "LUNES" },
  { keys: ["CC_MARTES", "CC MARTES", "CC_MARTES_", "CCMARTES", "MARTES"], diaSemana: "MARTES" },
  { keys: ["CC_MIERCOLES", "CC MIERCOLES", "CC_MIERCOLES_", "CCMIERCOLES", "MIERCOLES", "MIÉRCOLES"], diaSemana: "MIERCOLES" },
  { keys: ["CC_JUEVES", "CC JUEVES", "CC_JUEVES_", "CCJUEVES", "JUEVES"], diaSemana: "JUEVES" },
  { keys: ["CC_VIERNES", "CC VIERNES", "CC_VIERNES_", "CCVIERNES", "VIERNES"], diaSemana: "VIERNES" },
  { keys: ["CC_SABADO", "CC SABADO", "CC_SABADO_", "CCSABADO", "SABADO", "SÁBADO"], diaSemana: "SABADO" },
];

function normalizeKey(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function getCell(row: AppSheetRow, candidates: string[]): string {
  const candidateKeys = new Set(candidates.map(normalizeKey));
  for (const [key, value] of Object.entries(row)) {
    if (candidateKeys.has(normalizeKey(key)) && value !== undefined && value !== null) {
      return String(value).trim();
    }
  }
  return "";
}

function mapEstado(value: string): "activo" | "inactivo" {
  return value.toUpperCase().includes("INACT") ? "inactivo" : "activo";
}

function hasRecognizedDayColumns(rows: AppSheetRow[]): boolean {
  const recognized = new Set(DAY_COLUMN_KEYS.flatMap((day) => day.keys.map(normalizeKey)));
  return rows.some((row) => Object.keys(row).some((key) => recognized.has(normalizeKey(key))));
}

export function mapAppSheetStudents(rows: AppSheetRow[]): MappedStudent[] {
  return rows
    .map((row, index): MappedStudent | null => {
      const codigoEstudiante = normalizeStudentCode(getCell(row, [
        "BARCODE",
        "CODIGO",
        "CÓDIGO",
        "CODIGO_ESTUDIANTE",
        "CÓDIGO_ESTUDIANTE",
        "ID_ESTUDIANTE",
        "STUDENT_ID",
        "STUDENTID",
      ]));
      if (!codigoEstudiante) return null;

      const firstName = getCell(row, ["FIRST NAME", "FIRST_NAME", "FIRSTNAME", "NOMBRE", "NOMBRES"]);
      const middleName = getCell(row, ["MIDDLE NAME", "MIDDLE_NAME", "MIDDLENAME", "SEGUNDO_NOMBRE"]);
      const lastName = getCell(row, ["LAST NAME", "LAST_NAME", "LASTNAME", "APELLIDO", "APELLIDOS"]);
      const gradeAndGroup = normalizeGradeAndGroup(
        getCell(row, ["GRADE", "GRADO", "NIVEL"]),
        getCell(row, ["HOMEROOM", "GRUPO", "CURSO", "SALON"]),
      );
      const email = getCell(row, ["STUDENT_EMAIL", "STUDENTEMAIL", "EMAIL", "CORREO"]);
      const estadoValue = getCell(row, ["ACTIVE_INACTIVE", "ACTIVE INACTIVE", "ACTIVEINACTIVE", "ESTADO"]);

      const schedules = DAY_COLUMN_KEYS.flatMap((day) => {
        const codigoDisciplina = getCell(row, day.keys);
        if (!codigoDisciplina) return [];
        return [{ codigoDisciplina: codigoDisciplina.trim(), diaSemana: day.diaSemana }];
      });

      return {
        codigoEstudiante,
        nombre: [firstName, middleName].filter(Boolean).join(" ") || "SIN_NOMBRE",
        apellido: lastName || "SIN_APELLIDO",
        gradeNombre: gradeAndGroup.grade,
        grupo: gradeAndGroup.group,
        correo: email || null,
        schedules,
        _excelRow: index + 2,
        estado: estadoValue ? mapEstado(estadoValue) : undefined,
      };
    })
    .filter((student): student is MappedStudent => student !== null);
}

export interface AppSheetStudentDiagnostic {
  sourceRows: number;
  mappedStudents: number;
  sourceSchedules: number;
  databaseStudents: number;
  databaseSchedules: number;
  studentsWithoutSchedules: Array<{
    codigoEstudiante: string;
    nombre: string;
    apellido: string;
    sourceSchedules: number;
    databaseSchedules: number;
    reason: "student_not_found" | "schedule_not_created";
  }>;
  scheduleMismatches: Array<{
    codigoEstudiante: string;
    sourceSchedules: number;
    databaseSchedules: number;
  }>;
}

function emptyDiagnostic(): AppSheetStudentDiagnostic {
  return {
    sourceRows: 0,
    mappedStudents: 0,
    sourceSchedules: 0,
    databaseStudents: 0,
    databaseSchedules: 0,
    studentsWithoutSchedules: [],
    scheduleMismatches: [],
  };
}

export async function diagnoseMappedAppSheetStudents(
  rows: AppSheetRow[],
  students: MappedStudent[],
): Promise<AppSheetStudentDiagnostic> {
  const databaseRows = (await sql`
    SELECT s."codigoEstudiante", COUNT(ss."id")::int AS "scheduleCount"
    FROM "Student" s
    LEFT JOIN "StudentSchedule" ss ON ss."codigoEstudiante" = s."codigoEstudiante"
    GROUP BY s."codigoEstudiante"
  `) as unknown as Array<{ codigoEstudiante: string; scheduleCount: number }>;
  const databaseByCode = new Map(databaseRows.map((row) => [normalizeStudentCode(row.codigoEstudiante), row]));
  const withoutSchedules: AppSheetStudentDiagnostic["studentsWithoutSchedules"] = [];
  const mismatches: AppSheetStudentDiagnostic["scheduleMismatches"] = [];

  for (const student of students) {
    const sourceSchedules = student.schedules.length;
    const database = databaseByCode.get(normalizeStudentCode(student.codigoEstudiante));
    const databaseSchedules = database?.scheduleCount ?? 0;
    if (sourceSchedules !== databaseSchedules) {
      mismatches.push({ codigoEstudiante: student.codigoEstudiante, sourceSchedules, databaseSchedules });
    }
    if (sourceSchedules > 0 && databaseSchedules === 0) {
      withoutSchedules.push({
        codigoEstudiante: student.codigoEstudiante,
        nombre: student.nombre,
        apellido: student.apellido,
        sourceSchedules,
        databaseSchedules,
        reason: database ? "schedule_not_created" : "student_not_found",
      });
    }
  }

  return {
    sourceRows: rows.length,
    mappedStudents: students.length,
    sourceSchedules: students.reduce((total, student) => total + student.schedules.length, 0),
    databaseStudents: databaseRows.length,
    databaseSchedules: databaseRows.reduce((total, row) => total + row.scheduleCount, 0),
    studentsWithoutSchedules: withoutSchedules,
    scheduleMismatches: mismatches,
  };
}

export interface AppSheetStudentSyncResult {
  ok: boolean;
  table: string;
  processed: number;
  created: number;
  updated: number;
  errors: string[];
  diagnostic: AppSheetStudentDiagnostic;
}

function failedResult(table: string, message: string): AppSheetStudentSyncResult {
  return {
    ok: false,
    table,
    processed: 0,
    created: 0,
    updated: 0,
    errors: [message],
    diagnostic: emptyDiagnostic(),
  };
}

async function readAndMapStudents(): Promise<{ table: string; rows: AppSheetRow[]; students: MappedStudent[] }> {
  const table = config.appsheetDemograficosTable;
  const rows = await findAppSheetRows(table);
  if (rows.length === 0) throw new Error("AppSheet devolvió 0 filas; no se aplicó ningún cambio");
  // Si cambia el nombre de la tabla o el API devuelve una forma distinta,
  // jamás debemos interpretar la ausencia de CC_* como "eliminar horarios".
  if (!hasRecognizedDayColumns(rows)) {
    throw new Error(`La tabla ${table} no contiene columnas de actividades CC_* reconocidas; no se aplicó ningún cambio`);
  }
  const students = mapAppSheetStudents(rows);
  if (students.length === 0) {
    throw new Error("AppSheet devolvió filas, pero ninguna contiene un código de estudiante válido; no se aplicó ningún cambio");
  }
  const codes = students.map((student) => student.codigoEstudiante);
  if (new Set(codes).size !== codes.length) {
    throw new Error("AppSheet devolvió códigos de estudiante duplicados después de normalizarlos; no se aplicó ningún cambio");
  }
  return { table, rows, students };
}

export async function syncAppSheetStudents(): Promise<AppSheetStudentSyncResult> {
  let source: { table: string; rows: AppSheetRow[]; students: MappedStudent[] };
  try {
    source = await readAndMapStudents();
  } catch (error) {
    return failedResult(config.appsheetDemograficosTable, error instanceof Error ? error.message : String(error));
  }

  const result = await importStudents(source.students, false);
  let diagnostic: AppSheetStudentDiagnostic;
  try {
    diagnostic = await diagnoseMappedAppSheetStudents(source.rows, source.students);
  } catch (error) {
    return {
      ok: false,
      table: source.table,
      processed: result.processed,
      created: result.created,
      updated: result.updated,
      errors: [...result.errorDetails.slice(0, 10).map((e) => `${e.codigo}: ${e.error}`), `Diagnóstico falló: ${error instanceof Error ? error.message : String(error)}`],
      diagnostic: emptyDiagnostic(),
    };
  }

  const diagnosticErrors = diagnostic.scheduleMismatches.slice(0, 10).map((item) =>
    `${item.codigoEstudiante}: AppSheet=${item.sourceSchedules} horario(s), base de datos=${item.databaseSchedules}`,
  );
  const errors = [
    ...result.errorDetails.slice(0, 10).map((e) => `${e.codigo}: ${e.error}`),
    ...diagnosticErrors,
  ];

  return {
    ok: errors.length === 0,
    table: source.table,
    processed: result.processed,
    created: result.created,
    updated: result.updated,
    errors,
    diagnostic,
  };
}

/** Diagnóstico de solo lectura para comprobar AppSheet contra StudentSchedule. */
export async function diagnoseAppSheetStudents(): Promise<AppSheetStudentDiagnostic> {
  const source = await readAndMapStudents();
  return diagnoseMappedAppSheetStudents(source.rows, source.students);
}
