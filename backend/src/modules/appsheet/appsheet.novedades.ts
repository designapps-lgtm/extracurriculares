import { sql } from "../../config/db";
import { config } from "../../config";
import { parseBoolean, parseFlexibleDate } from "../novedades/novedades.parser";
import { findAppSheetRows, type AppSheetRow } from "./appsheet.service";

const TRANSLATE_FROM = "áéíóúüñÁÉÍÓÚÜÑ";
const TRANSLATE_TO = "aeiouunAEIOUUN";

const SOURCE_NAME = "AppSheet";

const ALIASES = {
  novedadId: ["NovedadID_M", "NovedadID", "Novedad Id", "ID", "Id"],
  student: [
    "StudentID",
    "CodigoEstudiante",
    "Codigo Estudiante",
    "BARCODE",
    "Barcode",
    "ScanCode",
    "Scan Code",
  ],
  studentName: ["Nombres_Estudiantes", "Nombres Estudiantes", "Nombre Estudiante", "Student Name"],
  description: [
    "Novedad_de_Salida_Diaria_M",
    "Novedad de Salida Diaria M",
    "Descripcion de la Novedad",
    "Descripción de la Novedad",
    "Descripcion",
    "Descripción",
  ],
  accompanies: ["Se ausenta con", "Se_Ausenta_Con"],
  accompaniesOther: ["Se ausenta con Otro", "Se_Ausenta_Con_Otro"],
  motive: [
    "Motivo",
    "Se_AusentaCon_Tipo_M",
    "Se_Ausenta_Con_Tipo_M",
    "Se_AusentaCon_Tipo",
    "Se_Ausenta_Con_Tipo",
    "Se Ausenta Con Tipo",
  ],
  type: ["Tipo de Novedad", "Tipo_Novedad", "Tipo Novedad"],
  flow: ["Flujo_Novedad", "Flujo Novedad"],
  grade: ["Grado", "Grados"],
  photo: ["Foto Estudiante", "Foto_Estudiante", "Fotos", "Foto_Estudiante_Snap", "Foto", "Image"],
  createdBy: ["Autorizado Por", "AutorizadoPor", "RegistradoPor", "Registrado Por"],
  date: [
    "Fecha y Hora de La Novedad",
    "Fecha y Hora de la Novedad",
    "FechaHora",
    "Fecha Hora",
    "Fecha_Novedad",
    "Fecha Novedad",
  ],
  createdAt: ["Fecha_Creacion", "Fecha Creacion", "Fecha de Creacion", "CreatedAt"],
  processed: ["Procesado"],
  returns: ["Regresa_Al_Colegio", "Regresa Al Colegio", "Regresa al Colegio"],
  returnTime: ["Hora_Estimada_Regreso", "Hora Estimada Regreso"],
};

export interface AppSheetNovedadSyncResult {
  ok: boolean;
  source: string;
  received: number;
  accepted: number;
  errors: string[];
}

interface NormalizedNovedad {
  novedadId: string;
  codigoEstudiante: string;
  archivo: string;
  descripcion: string | null;
  seAusentaCon: string | null;
  seAusentaConOtro: string | null;
  seAusentaConTipo: string | null;
  tipoNovedad: string | null;
  flujoNovedad: string | null;
  grados: string | null;
  nombresEstudiantes: string | null;
  fotoUrls: string | null;
  fechaHora: Date | null;
  scanCodes: string | null;
  fechaCreacion: Date | null;
  registradoPor: string | null;
  procesado: string | null;
  regresaAlColegio: boolean;
  horaEstimadaRegreso: string | null;
  fechaNovedad: Date | null;
}

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normalizeLookup(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getCell(row: AppSheetRow, candidates: string[]): string {
  const normalized = new Map<string, unknown>();
  for (const [key, value] of Object.entries(row)) normalized.set(normalizeKey(key), value);

  for (const candidate of candidates) {
    const value = normalized.get(normalizeKey(candidate));
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function splitIdentifiers(value: string): string[] {
  return value
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function payloadRows(payload: unknown): AppSheetRow[] {
  if (Array.isArray(payload)) return payload.filter((row): row is AppSheetRow => Boolean(row && typeof row === "object"));
  if (!payload || typeof payload !== "object") return [];

  const record = payload as Record<string, unknown>;
  for (const key of ["Rows", "rows", "data", "Data", "row", "Row"]) {
    const value = record[key];
    if (Array.isArray(value)) return value.filter((row): row is AppSheetRow => Boolean(row && typeof row === "object"));
    if (value && typeof value === "object") return [value as AppSheetRow];
  }
  return [record];
}

async function resolveStudentCode(identifier: string): Promise<string> {
  const normalized = normalizeLookup(identifier);
  const rows = (await sql`
    SELECT "codigoEstudiante", "nombre", "apellido"
    FROM "Student"
    WHERE "codigoEstudiante" = ${identifier}
       OR LOWER(TRANSLATE(TRIM(COALESCE("nombre", '') || ' ' || COALESCE("apellido", '')), ${TRANSLATE_FROM}, ${TRANSLATE_TO})) = ${normalized}
       OR LOWER(TRANSLATE(TRIM(COALESCE("apellido", '') || ' ' || COALESCE("nombre", '')), ${TRANSLATE_FROM}, ${TRANSLATE_TO})) = ${normalized}
    LIMIT 5
  `) as unknown as Array<{ codigoEstudiante: string; nombre: string; apellido: string }>;

  if (rows.length === 1) return rows[0].codigoEstudiante;
  if (rows.length > 1) throw new Error(`StudentID ambiguo: ${identifier}`);
  throw new Error(`No se encontró el estudiante para StudentID: ${identifier}`);
}

async function mapRow(row: AppSheetRow, archivo: string): Promise<NormalizedNovedad[]> {
  const novedadId = getCell(row, ALIASES.novedadId);
  if (!novedadId) throw new Error("Falta NovedadID");

  const rawStudent = getCell(row, ALIASES.student);
  if (!rawStudent) throw new Error(`${novedadId}: falta StudentID`);

  const identifiers = splitIdentifiers(rawStudent);
  const codes: string[] = [];
  for (const identifier of identifiers) {
    const code = await resolveStudentCode(identifier);
    if (!codes.includes(code)) codes.push(code);
  }

  const dateValue = getCell(row, ALIASES.date);
  const createdAtValue = getCell(row, ALIASES.createdAt);
  const fechaHora = parseFlexibleDate(dateValue);
  const fechaCreacion = parseFlexibleDate(createdAtValue) || new Date();
  const studentName = getCell(row, ALIASES.studentName) || (/^\d+$/.test(rawStudent) ? "" : rawStudent);

  return codes.map((codigoEstudiante) => ({
    novedadId,
    codigoEstudiante,
    archivo,
    descripcion: getCell(row, ALIASES.description) || null,
    seAusentaCon: getCell(row, ALIASES.accompanies) || null,
    seAusentaConOtro: getCell(row, ALIASES.accompaniesOther) || null,
    seAusentaConTipo: getCell(row, ALIASES.motive) || null,
    tipoNovedad: getCell(row, ALIASES.type) || null,
    flujoNovedad: getCell(row, ALIASES.flow) || null,
    grados: getCell(row, ALIASES.grade) || null,
    nombresEstudiantes: studentName || null,
    fotoUrls: getCell(row, ALIASES.photo) || null,
    fechaHora,
    scanCodes: getCell(row, ["ScanCode", "Scan Code"]) || null,
    fechaCreacion,
    registradoPor: getCell(row, ALIASES.createdBy) || null,
    procesado: getCell(row, ALIASES.processed) || null,
    regresaAlColegio: parseBoolean(getCell(row, ALIASES.returns)),
    horaEstimadaRegreso: getCell(row, ALIASES.returnTime) || null,
    fechaNovedad: fechaHora,
  }));
}

async function upsertRows(rows: NormalizedNovedad[]): Promise<void> {
  await sql.transaction((tx) => rows.map((row) => tx(
    `INSERT INTO "Novedad" (
      "id", "novedadId", "archivo", "codigoEstudiante", "descripcion",
      "seAusentaCon", "seAusentaConOtro", "seAusentaConTipo", "tipoNovedad",
      "flujoNovedad", "grados", "nombresEstudiantes", "fotoUrls", "fechaHora",
      "scanCodes", "fechaCreacion", "registradoPor", "procesado", "regresaAlColegio",
      "horaEstimadaRegreso", "fechaNovedad", "updatedAt"
    ) VALUES (
      gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, now()
    ) ON CONFLICT ("novedadId", "codigoEstudiante") DO UPDATE SET
      "archivo" = EXCLUDED."archivo", "descripcion" = EXCLUDED."descripcion",
      "seAusentaCon" = EXCLUDED."seAusentaCon", "seAusentaConOtro" = EXCLUDED."seAusentaConOtro",
      "seAusentaConTipo" = EXCLUDED."seAusentaConTipo", "tipoNovedad" = EXCLUDED."tipoNovedad",
      "flujoNovedad" = EXCLUDED."flujoNovedad", "grados" = EXCLUDED."grados",
      "nombresEstudiantes" = EXCLUDED."nombresEstudiantes", "fotoUrls" = EXCLUDED."fotoUrls",
      "fechaHora" = EXCLUDED."fechaHora", "scanCodes" = EXCLUDED."scanCodes",
      "fechaCreacion" = EXCLUDED."fechaCreacion", "registradoPor" = EXCLUDED."registradoPor",
      "procesado" = EXCLUDED."procesado", "regresaAlColegio" = EXCLUDED."regresaAlColegio",
      "horaEstimadaRegreso" = EXCLUDED."horaEstimadaRegreso", "fechaNovedad" = EXCLUDED."fechaNovedad",
      "updatedAt" = now()
    `,
    [
      row.novedadId,
      row.archivo,
      row.codigoEstudiante,
      row.descripcion,
      row.seAusentaCon,
      row.seAusentaConOtro,
      row.seAusentaConTipo,
      row.tipoNovedad,
      row.flujoNovedad,
      row.grados,
      row.nombresEstudiantes,
      row.fotoUrls,
      row.fechaHora,
      row.scanCodes,
      row.fechaCreacion,
      row.registradoPor,
      row.procesado,
      row.regresaAlColegio,
      row.horaEstimadaRegreso,
      row.fechaNovedad,
    ],
  )));
}

export async function ingestAppSheetNovedades(payload: unknown, source = SOURCE_NAME): Promise<AppSheetNovedadSyncResult> {
  const rows = payloadRows(payload);
  if (rows.length === 0) {
    return { ok: false, source, received: 0, accepted: 0, errors: ["El payload no contiene filas"] };
  }

  const archivo = `${source}:${config.appsheetNovedadesTable || "Novedades"}`;
  const mapped: NormalizedNovedad[] = [];
  const errors: string[] = [];

  for (const [index, row] of rows.entries()) {
    try {
      mapped.push(...await mapRow(row, archivo));
    } catch (error) {
      errors.push(`Fila ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (mapped.length > 0) await upsertRows(mapped);

  return {
    ok: errors.length === 0 && mapped.length > 0,
    source,
    received: rows.length,
    accepted: mapped.length,
    errors: errors.slice(0, 20),
  };
}

export async function syncAppSheetNovedades(): Promise<AppSheetNovedadSyncResult> {
  const table = config.appsheetNovedadesTable;
  if (!table) {
    return { ok: true, source: "AppSheet API desactivada", received: 0, accepted: 0, errors: [] };
  }

  try {
    const rows = await findAppSheetRows(table);
    return ingestAppSheetNovedades(rows, `AppSheet API:${table}`);
  } catch (error) {
    return {
      ok: false,
      source: `AppSheet API:${table}`,
      received: 0,
      accepted: 0,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}
