import {
  addAppSheetRows,
  deleteAppSheetRows,
  editAppSheetRows,
  findAppSheetRows,
  type AppSheetRow,
} from "./appsheet.service";

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
} as const;

export type AppSheetTableName = (typeof APPSHEET_TABLES)[keyof typeof APPSHEET_TABLES];

const DEFAULT_CACHE_MS = 15_000;
type CacheEntry = { expiresAt: number; promise: Promise<AppSheetRow[]> };
const cache = new Map<string, CacheEntry>();

export function clearAppSheetCache(tableName?: string): void {
  if (tableName) cache.delete(tableName);
  else cache.clear();
}

export async function getTableRows(
  tableName: AppSheetTableName,
  options: { fresh?: boolean; cacheMs?: number; selector?: string } = {},
): Promise<AppSheetRow[]> {
  if (options.fresh) cache.delete(tableName);
  const now = Date.now();
  const current = cache.get(tableName);
  if (current && current.expiresAt > now) return current.promise;

  const promise = findAppSheetRows(tableName, options.selector).catch((error) => {
    cache.delete(tableName);
    throw error;
  });
  cache.set(tableName, { expiresAt: now + (options.cacheMs ?? DEFAULT_CACHE_MS), promise });
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
