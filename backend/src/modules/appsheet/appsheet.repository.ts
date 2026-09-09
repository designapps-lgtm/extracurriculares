import {
  addAppSheetRows,
  deleteAppSheetRows,
  editAppSheetRows,
  findAppSheetRows,
  type AppSheetRow,
} from "./appsheet.service";
import {
  SHARED_CACHE_MS,
  SHARED_STALE_MS,
  sharedGetTable,
  sharedInvalidateTables,
  sharedSetTable,
} from "./appsheet.sharedCache";

export const APPSHEET_TABLES = {
  demographics: "Demograficos",
  assignmentSchedules: "EC_Asignacion_Horarios",
  attendance: "EC_Asistencias",
  audit: "EC_Auditoria",
  students: "EC_Estudiantes",
  grades: "EC_Grados",
  schedules: "EC_Horarios",
  enrollments: "EC_Inscripciones",
  stays: "EC_Permanencias",
  syncState: "EC_Sync_State",
  transfers: "EC_Traslados",
  teacherSchedules: "Profesores_Horarios",
  users: "Usuarios_Roles",
  reports: "EC_Reportes_Problemas",
} as const;

export type AppSheetTableName = (typeof APPSHEET_TABLES)[keyof typeof APPSHEET_TABLES];

const DEFAULT_CACHE_MS = 15_000;
// Cuánto se tolera servir el dato vencido mientras se refresca en background
// para absorber picos de concurrencia sin pegarle a AppSheet.
const DEFAULT_STALE_MS = 60_000;
type CacheEntry = {
  data: AppSheetRow[];
  cachedAt: number;
  /** Fetch que los callers esperan (arranque en frío, dato muy vencido o fresh). */
  promise: Promise<AppSheetRow[]> | null;
  /** Refresh en background de la ventana stale; los callers NO lo esperan. */
  revalidate: Promise<AppSheetRow[]> | null;
};
const cache = new Map<string, CacheEntry>();

export function clearAppSheetCache(tableName?: string): void {
  if (tableName) {
    cache.delete(tableName);
    void sharedInvalidateTables([tableName]);
  } else {
    cache.clear();
    void sharedInvalidateTables(Object.values(APPSHEET_TABLES));
  }
}

function now(): number {
  return Date.now();
}

export async function getTableRows(
  tableName: AppSheetTableName,
  options: { fresh?: boolean; cacheMs?: number; staleMs?: number; selector?: string } = {},
): Promise<AppSheetRow[]> {
  const ttl = options.cacheMs ?? DEFAULT_CACHE_MS;
  const staleAllowed = options.staleMs ?? DEFAULT_STALE_MS;
  const nowMs = now();

  if (options.fresh) {
    // Forzamos un fetch nuevo, sin servir dato previo.
    return refreshFresh(tableName, options.selector);
  }

  const current = cache.get(tableName);

  // Hay un fetch que los callers deben esperar (arranque en frío, muy vencido
  // o fresh en vuelo): lo compartimos para no pegar a AppSheet una vez por llamada.
  if (current?.promise) return current.promise;

  // Ya hay un refresh (en memoria o KV) en vuelo: servimos la última copia que
  // tengamos mientras llega. Evita duplicar fetches cuando la ventana stale se
  // extiende porque AppSheet tarda o devuelve 429.
  if (current?.revalidate) return Promise.resolve(current.data);

  if (current && nowMs - current.cachedAt < ttl) {
    // Dentro de la ventana fresca: servimos sin pegar a AppSheet.
    return Promise.resolve(current.data);
  }

  if (current && nowMs - current.cachedAt < ttl + staleAllowed) {
    // Ventana stale-while-revalidate: servimos el dato vencido ya y refrescamos
    // en background (single-flight) sin bloquear a quien lo pidió.
    if (!current.revalidate) {
      current.revalidate = performRefresh(tableName, options.selector, "background");
    }
    return Promise.resolve(current.data);
  }

  // Sin dato servible en esta isolate o muy vencido: resolvemos primero contra
  // la caché compartida (KV), y solo si ahí tampoco hay, a AppSheet. El promise
  // se publica ANTES de await para que la concurrencia comparta una sola resolución.
  const settled = resolveTable(tableName, options.selector);
  cache.set(tableName, {
    data: current?.data ?? [],
    cachedAt: current?.cachedAt ?? 0,
    promise: settled,
    revalidate: null,
  });
  return settled;
}

// Resuelve una tabla sin dato servible en la isolate: prueba la caché de KV
// (otro isolate ya la rellenó, p. ej. vía cron) y solo si está vacía o muy
// vencida cae a AppSheet. El resultado siempre se persiste en memoria local.
async function resolveTable(tableName: AppSheetTableName, selector?: string): Promise<AppSheetRow[]> {
  const shared = await sharedGetTable(tableName);
  const nowMs = now();
  if (shared) {
    const isFresh = nowMs - shared.cachedAt < SHARED_CACHE_MS;
    const isStale = nowMs - shared.cachedAt < SHARED_CACHE_MS + SHARED_STALE_MS;
    if (isFresh) {
      cache.set(tableName, { data: shared.rows, cachedAt: shared.cachedAt, promise: null, revalidate: null });
      return shared.rows;
    }
    if (isStale) {
      // Snapshot compartido ya vencido: lo servimos y refrescamos en background
      // (el refresh escribe de vuelta a KV, así todos los isolates se actualizan).
      const entry: CacheEntry = { data: shared.rows, cachedAt: shared.cachedAt, promise: null, revalidate: null };
      cache.set(tableName, entry);
      if (!entry.revalidate) {
        entry.revalidate = performRefresh(tableName, selector, "background");
      }
      return shared.rows;
    }
  }
  return performRefresh(tableName, selector, "await");
}

// Reemplaza por completo la entrada caché, sin conservar dato viejo (usado
// por `fresh: true`, que no debe servir datos precedentes).
function refreshFresh(tableName: AppSheetTableName, selector?: string): Promise<AppSheetRow[]> {
  const current = cache.get(tableName);
  // Si ya hay un fetch en vuelo, compartirlo es correcto: es un dato fresco.
  if (current?.promise) return current.promise;
  cache.delete(tableName);
  const promise = findAppSheetRows(tableName, selector).then((rows) => {
    cache.set(tableName, { data: rows, cachedAt: now(), promise: null, revalidate: null });
    void sharedSetTable(tableName, rows);
    return rows;
  }).catch((error) => {
    cache.delete(tableName);
    throw error;
  });
  cache.set(tableName, { data: [], cachedAt: 0, promise, revalidate: null });
  return promise;
}

function performRefresh(
  tableName: AppSheetTableName,
  selector: string | undefined,
  mode: "await" | "background",
): Promise<AppSheetRow[]> {
  const current = cache.get(tableName);
  const promise = findAppSheetRows(tableName, selector).then((rows) => {
    cache.set(tableName, { data: rows, cachedAt: now(), promise: null, revalidate: null });
    // Write-through a la caché compartida: los demás isolates leen el dato
    // nuevo desde KV sin volver a pegar a AppSheet.
    void sharedSetTable(tableName, rows);
    return rows;
  }).catch((error) => {
    // Si falla un refresh y existía una última buena copia, la conservamos para
    // no tumbar la vista; si no hay copia, se descarta. NO invalidamos KV: la
    // copia compartida puede ser lo único bueno que tengan otros isolates.
    const existing = cache.get(tableName);
    if (!existing || !existing.cachedAt) cache.delete(tableName);
    else cache.set(tableName, { ...existing, promise: null, revalidate: null });
    throw error;
  });
  cache.set(tableName, {
    data: current?.data ?? [],
    cachedAt: current?.cachedAt ?? 0,
    promise: mode === "await" ? promise : null,
    revalidate: mode === "background" ? promise : null,
  });
  return promise;
}

export async function addRows(tableName: AppSheetTableName, rows: AppSheetRow[]): Promise<AppSheetRow[]> {
  const result = await addAppSheetRows(tableName, rows);
  clearAppSheetCache(tableName);
  return result;
}

export async function editRows(tableName: AppSheetTableName, rows: AppSheetRow[]): Promise<AppSheetRow[]> {
  const result = await editAppSheetRows(tableName, rows);
  clearAppSheetCache(tableName);
  return result;
}

export async function deleteRows(tableName: AppSheetTableName, rows: AppSheetRow[]): Promise<AppSheetRow[]> {
  const result = await deleteAppSheetRows(tableName, rows);
  clearAppSheetCache(tableName);
  return result;
}

// Precarga en la caché compartida (KV) las tablas más leídas. La corre el cron
// cada 10 min: ante un isolate frío que no tiene nada en memoria, el dato ya
// está en KV y no pega a AppSheet. `fresh: true` fuerza el fetch desde AppSheet
// y reescribe KV con un cachedAt nuevo. Una falla no tumba el prewarm.
export async function prewarmSharedCache(
  tablesToWarm: AppSheetTableName[] = [
    APPSHEET_TABLES.demographics,
    APPSHEET_TABLES.students,
    APPSHEET_TABLES.grades,
    APPSHEET_TABLES.schedules,
    APPSHEET_TABLES.enrollments,
    APPSHEET_TABLES.assignmentSchedules,
    APPSHEET_TABLES.teacherSchedules,
    APPSHEET_TABLES.users,
    APPSHEET_TABLES.attendance,
    APPSHEET_TABLES.stays,
    APPSHEET_TABLES.reports,
  ],
): Promise<void> {
  const results = await Promise.allSettled(
    tablesToWarm.map((table) => getTableRows(table, { fresh: true })),
  );
  for (let i = 0; i < results.length; i += 1) {
    const table = tablesToWarm[i];
    if (results[i].status === "rejected") {
      console.error(`[prewarm] falló ${table}`, (results[i] as PromiseRejectedResult).reason);
    }
  }
}

export function cell(row: AppSheetRow, ...names: string[]): unknown {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null) return row[name];
  }
  const normalized = new Map(Object.keys(row).map((key) => [normalizeColumn(key), key]));
  for (const name of names) {
    const actual = normalized.get(normalizeColumn(name));
    if (actual && row[actual] !== undefined && row[actual] !== null) return row[actual];
  }
  return undefined;
}

function normalizeColumn(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

export function textCell(row: AppSheetRow, ...names: string[]): string {
  const value = cell(row, ...names);
  return value === undefined || value === null ? "" : String(value).trim();
}

export function nullableTextCell(row: AppSheetRow, ...names: string[]): string | null {
  const value = textCell(row, ...names);
  return value || null;
}

/**
 * AppSheet serializa columnas de tipo Image/File como JSON crudo:
 *   {"Url":"https://...","LinkText":"https://..."}
 * Este helper extrae la URL real y la devuelve, o si el valor ya es una URL
 * plana (formato legado) la deja tal cual. Devuelve null cuando está vacío.
 */
export function photoUrlCell(row: AppSheetRow, ...names: string[]): string | null {
  const value = textCell(row, ...names);
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { Url?: string };
      return parsed.Url?.trim() || null;
    } catch {
      return null;
    }
  }
  return trimmed;
}

export function numberCell(row: AppSheetRow, ...names: string[]): number {
  const value = Number(textCell(row, ...names));
  return Number.isFinite(value) ? value : 0;
}

export function yesNoCell(row: AppSheetRow, ...names: string[]): boolean {
  const value = textCell(row, ...names).toLowerCase();
  return value === "y" || value === "yes" || value === "si" || value === "sí" || value === "true" || value === "1";
}

export function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export function isActiveValue(value: string): boolean {
  const normalized = normalizeSearch(value);
  return !["inactivo", "inactiva", "cancelado", "cancelada", "eliminado", "eliminada", "disabled", "n"].includes(normalized);
}
