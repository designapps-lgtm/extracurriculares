import * as XLSX from "xlsx";

// Alias de headers tal como aparecen en el Excel → nombre de campo
const HEADER_ALIASES: Record<string, string[]> = {
  novedadId: ["NovedadID_M", "NovedadID", "Novedad Id"],
  listaEstudiantes: ["Lista_Estudiantes", "StudentID"],
  descripcion: [
    "Novedad_de_Salida_Diaria_M",
    "Novedad de Salida Diaria M",
    "Novedad_de_Salida_Diaria",
    "Novedad de Salida Diaria",
    "Descripcion de la Novedad",
    "Descripción de la Novedad",
    "Descripcion",
    "Descripción",
  ],
  seAusentaCon: ["Se ausenta con", "Se_Ausenta_Con"],
  grados: ["Grados", "Grado"],
  fotos: ["Fotos", "Foto_Estudiante_Snap", "Foto Estudiante", "Foto_Estudiante", "Foto"],
  nombresEstudiantes: ["Nombres_Estudiantes", "Nombre_Estudiante_Snap", "Student Name"],
  fechaHora: [
    "FechaHora",
    "Fecha Hora",
    "Fecha y Hora de La Novedad",
    "Fecha y Hora de la Novedad",
  ],
  scanCodes: ["ScanCode", "Scan Code"],
  fechaCreacion: ["Fecha_Creacion", "Fecha Creacion", "Fecha_Creacion", "Fecha de Creacion", "CreatedAt"],
  registradoPor: ["RegistradoPor", "Registrado Por", "Autorizado Por", "AutorizadoPor"],
  procesado: ["Procesado"],
  tipoNovedad: ["Tipo de Novedad", "Tipo_Novedad"],
  seAusentaConOtro: ["Se ausenta con Otro", "Se_Ausenta_Con_Otro"],
  regresaAlColegio: ["Regresa_Al_Colegio", "Regresa Al Colegio"],
  horaEstimadaRegreso: ["Hora_Estimada_Regreso", "Hora Estimada Regreso"],
  flujoNovedad: ["Flujo_Novedad", "Flujo Novedad"],
  fechaNovedad: ["Fecha_Novedad", "Fecha Novedad"],
  seAusentaConTipo: [
    "Se_AusentaCon_Tipo_M",
    "Se_AusentaCon_Tipo",
    "Se Ausenta Con Tipo",
    "Motivo",
  ],
};

function normalizeHeader(value: string): string {
  return value
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/[^A-Z0-9 ]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

// Todas las formas canónicas de cada campo (permite varias variantes de header).
const CANONICALS_BY_FIELD: Record<string, string[]> = {};
for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
  CANONICALS_BY_FIELD[field] = aliases.map(normalizeHeader);
}

export interface ParsedNovedadRow {
  novedadId: string;
  codigoEstudiante: string;
  descripcion: string;
  seAusentaCon: string;
  grados: string;
  fotoUrls: string;
  nombresEstudiantes: string;
  fechaHora: Date | null;
  scanCodes: string;
  fechaCreacion: Date | null;
  registradoPor: string;
  procesado: string;
  tipoNovedad: string;
  seAusentaConOtro: string;
  regresaAlColegio: boolean;
  horaEstimadaRegreso: string;
  flujoNovedad: string;
  fechaNovedad: Date | null;
  seAusentaConTipo: string;
  excelRow: number;
}

export function parseFlexibleDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date && !isNaN(value.getTime())) return value;

  const str = String(value).trim();
  if (!str) return null;

  // Las celdas de fecha del sheet se mantienen en hora local de Colombia (UTC-5, sin DST).
  // Para que el "día calendario de Colombia" calce con el filtro, los valores sin zona
  // horaria explícita se interpretan como reloj de pared de Bogotá (local + 5h = UTC).
  const toBogotaUtc = (d: Date): Date => new Date(d.getTime() + 5 * 3600 * 1000);

  if (/^\d+(\.\d+)?$/.test(str)) {
    const serial = parseFloat(str);
    if (serial > 0 && serial < 80000) {
      const ms = Math.round((serial - 25569) * 86400 * 1000);
      const d = new Date(ms);
      if (!isNaN(d.getTime())) return toBogotaUtc(d);
    }
  }

  const dmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (dmy) {
    const [, dd, mm, yyyy, hh, min, ss] = dmy;
    // Date(year, ...) depende del huso horario del runtime; usar UTC evita
    // sumar dos veces las cinco horas cuando el proceso corre en Bogotá.
    const d = new Date(Date.UTC(
      parseInt(yyyy, 10),
      parseInt(mm, 10) - 1,
      parseInt(dd, 10),
      parseInt(hh || "0", 10),
      parseInt(min || "0", 10),
      parseInt(ss || "0", 10),
    ));
    return toBogotaUtc(d);
  }

  // ISO con zona horaria explícita (Z/±HH:MM) ya es un instante absoluto → no ajustar.
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(str)) {
    const iso = new Date(str);
    return isNaN(iso.getTime()) ? null : iso;
  }

  // ISO sin zona: p.ej. "2026-09-01" o "2026-09-01T14:30:00" → reloj de pared de Bogotá.
  const naiveISO = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (naiveISO) {
    const [, yyyy, mm, dd, hh, min, ss] = naiveISO;
    const d = new Date(Date.UTC(
      parseInt(yyyy, 10),
      parseInt(mm, 10) - 1,
      parseInt(dd, 10),
      parseInt(hh || "0", 10),
      parseInt(min || "0", 10),
      parseInt(ss || "0", 10),
    ));
    return toBogotaUtc(d);
  }

  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}

export function parseBoolean(value: unknown): boolean {
  const str = String(value ?? "").trim().toUpperCase();
  return str === "TRUE" || str === "VERDADERO" || str === "1" || str === "SI";
}

function splitCodes(value: unknown): string[] {
  return String(value ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

function normalizeRow(row: Record<string, unknown>): Record<string, string> {
  // Mapea cada header real (normalizado) de la fila a su valor
  const rawByCanonical: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(row)) {
    const canonical = normalizeHeader(rawKey);
    if (canonical && !(canonical in rawByCanonical)) {
      rawByCanonical[canonical] = String(rawValue ?? "").trim();
    }
  }

  const out: Record<string, string> = {};
  for (const field of Object.keys(HEADER_ALIASES)) {
    let value = "";
    for (const canonical of CANONICALS_BY_FIELD[field]) {
      if (canonical in rawByCanonical) {
        value = rawByCanonical[canonical];
        break;
      }
    }
    out[field] = value;
  }
  return out;
}

export function parseNovedadesSheet(buffer: Buffer, fileId: string): ParsedNovedadRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error(`El archivo ${fileId} no tiene hojas`);

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });

  return rowsToNovedades(rows, fileId);
}

export function parseNovedadesJson(rawJson: string, fileId: string): ParsedNovedadRow[] {
  const json = JSON.parse(rawJson) as Record<string, unknown>[];
  return rowsToNovedades(json, fileId);
}

function rowsToNovedades(rows: Record<string, unknown>[], fileId: string): ParsedNovedadRow[] {
  const results: ParsedNovedadRow[] = [];

  rows.forEach((row, index) => {
    const values = normalizeRow(row);
    const novedadId = values.novedadId;
    const codes = splitCodes(values.scanCodes).length > 0 ? splitCodes(values.scanCodes) : splitCodes(values.listaEstudiantes);
    if (!novedadId || codes.length === 0) return;

    for (const codigoEstudiante of codes) {
      results.push({
        novedadId,
        codigoEstudiante,
        descripcion: values.descripcion,
        seAusentaCon: values.seAusentaCon,
        grados: values.grados,
        fotoUrls: values.fotos,
        nombresEstudiantes: values.nombresEstudiantes,
        fechaHora: parseFlexibleDate(values.fechaHora),
        scanCodes: values.scanCodes,
        fechaCreacion: parseFlexibleDate(values.fechaCreacion),
        registradoPor: values.registradoPor,
        procesado: values.procesado,
        tipoNovedad: values.tipoNovedad,
        seAusentaConOtro: values.seAusentaConOtro,
        regresaAlColegio: parseBoolean(values.regresaAlColegio),
        horaEstimadaRegreso: values.horaEstimadaRegreso,
        flujoNovedad: values.flujoNovedad,
        fechaNovedad: parseFlexibleDate(values.fechaNovedad),
        seAusentaConTipo: values.seAusentaConTipo,
        excelRow: index + 2,
      });
    }
  });

  return results;
}
