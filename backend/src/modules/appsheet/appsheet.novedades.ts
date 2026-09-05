import { config } from "../../config";
import { CANONICAL_NOVEDADES_DB_NAMES } from "../novedades/novedades.service";
import { colombiaDateKey, novedadesForColombiaDay } from "../novedades/novedades.dates";
import { parseNovedadesRows } from "../novedades/novedades.parser";
import { persistNovedades } from "../novedades/novedades.repository";
import { findAppSheetRows, type AppSheetRow } from "./appsheet.service";

const SYNC_MIN_INTERVAL_MS = 30_000;

export interface AppSheetNovedadesSyncResult {
  ok: boolean;
  source: "appsheet";
  table: string;
  day: string;
  received: number;
  sourceRowsMapped: number;
  rejected: number;
  outOfDay: number;
  novedades: number;
  skipped: boolean;
  warnings: string[];
  errors: string[];
}

let runningSync: Promise<AppSheetNovedadesSyncResult> | null = null;
let lastSuccessfulSyncAt = 0;
let lastSuccessfulCount = 0;

function dailySelector(table: string): string {
  // AppSheet evalúa TODAY() usando la zona America/Bogota enviada por el cliente.
  // Se consultan las tres columnas de fecha porque varias filas históricas no
  // tienen Fecha_Novedad y usan FechaHora o Fecha_Creacion como respaldo.
  return `Filter(${table}, OR(AND(ISNOTBLANK([Fecha_Novedad]), DATE([Fecha_Novedad]) = TODAY()), AND(ISNOTBLANK([FechaHora]), DATE([FechaHora]) = TODAY()), AND(ISNOTBLANK([Fecha_Creacion]), DATE([Fecha_Creacion]) = TODAY())))`;
}

function failedResult(
  table: string,
  day: string,
  errors: string[],
  received = 0,
): AppSheetNovedadesSyncResult {
  return {
    ok: false,
    source: "appsheet",
    table,
    day,
    received,
    sourceRowsMapped: 0,
    rejected: received,
    outOfDay: 0,
    novedades: 0,
    skipped: false,
    warnings: [],
    errors,
  };
}

async function runSync(): Promise<AppSheetNovedadesSyncResult> {
  const table = config.appsheetNovedadesTable;
  const now = new Date();
  const day = colombiaDateKey(now);
  let rows: AppSheetRow[];
  try {
    rows = await findAppSheetRows(table, dailySelector(table));
  } catch (error) {
    return failedResult(table, day, [error instanceof Error ? error.message : String(error)]);
  }

  const parsedRows = parseNovedadesRows(rows, table);
  const mappedSourceRows = new Set(parsedRows.map((row) => row.excelRow)).size;
  const rejected = Math.max(0, rows.length - mappedSourceRows);

  // Una respuesta no vacía pero completamente inválida normalmente indica un
  // cambio de columnas. En ese caso se conserva el snapshot y se informa error.
  if (rows.length > 0 && parsedRows.length === 0) {
    return failedResult(
      table,
      day,
      [`AppSheet devolvió ${rows.length} filas, pero ninguna tenía NovedadID y ScanCode/Lista_Estudiantes válidos`],
      rows.length,
    );
  }

  // Segunda barrera: nunca confiar únicamente en el Selector remoto. Sólo las
  // novedades cuyo día efectivo sea hoy en Colombia llegan a PostgreSQL.
  const dailyRows = novedadesForColombiaDay(parsedRows, now);
  const sourceRowsMapped = new Set(dailyRows.map((row) => row.excelRow)).size;
  const outOfDay = Math.max(0, mappedSourceRows - sourceRowsMapped);
  const warnings: string[] = [];
  if (rejected > 0) {
    warnings.push(`${rejected} fila(s) sin NovedadID o código de estudiante fueron omitidas`);
  }
  if (outOfDay > 0) {
    warnings.push(`${outOfDay} fila(s) fuera del día ${day} fueron omitidas`);
  }

  try {
    const novedades = await persistNovedades(table, dailyRows, {
      // El almacenamiento es un cache del día actual, no un histórico. Una
      // respuesta válida sin filas para hoy limpia el snapshot del día anterior.
      replaceSources: CANONICAL_NOVEDADES_DB_NAMES,
    });
    lastSuccessfulSyncAt = Date.now();
    lastSuccessfulCount = novedades;
    return {
      ok: true,
      source: "appsheet",
      table,
      day,
      received: rows.length,
      sourceRowsMapped,
      rejected,
      outOfDay,
      novedades,
      skipped: false,
      warnings,
      errors: [],
    };
  } catch (error) {
    return failedResult(
      table,
      day,
      [`Error guardando novedades de AppSheet: ${error instanceof Error ? error.message : String(error)}`],
      rows.length,
    );
  }
}

/** Lee directamente de AppSheet únicamente las novedades del día actual en Colombia. */
export function syncAppSheetNovedades(options: { force?: boolean } = {}): Promise<AppSheetNovedadesSyncResult> {
  if (runningSync) return runningSync;
  if (!options.force && Date.now() - lastSuccessfulSyncAt < SYNC_MIN_INTERVAL_MS) {
    return Promise.resolve({
      ok: true,
      source: "appsheet",
      table: config.appsheetNovedadesTable,
      day: colombiaDateKey(new Date()),
      received: 0,
      sourceRowsMapped: 0,
      rejected: 0,
      outOfDay: 0,
      novedades: lastSuccessfulCount,
      skipped: true,
      warnings: [],
      errors: [],
    });
  }

  const current = runSync();
  runningSync = current.finally(() => {
    runningSync = null;
  });
  return runningSync;
}
