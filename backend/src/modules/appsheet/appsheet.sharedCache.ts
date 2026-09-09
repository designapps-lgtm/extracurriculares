import type { AppSheetRow } from "./appsheet.service";

// Snapshot compartido entre isolates via Cloudflare KV. En Docker/Node no hay
// binding APPSHEET_KV y todas las funciones son no-op: la app vuelve a su
// comportamiento de sola memoria, que es suficiente localmente.
//
// Ventanas propias de la capa compartida: son MÁS amplias que las de memoria
// (cacheMs=15s/stale 60s) a propósito. El cron precarga KV cada 10 min, y al
// leer queremos poder servir ese snapshot durante la siguiente ventana sin
// volver a pegar a AppSheet. Son las ventanas de tolerancia de la app real:
// un dato de hasta 15 min es "fresco"; hasta 30 se sirve mientras se refresca.
export const SHARED_CACHE_MS = 15 * 60_000;
export const SHARED_STALE_MS = 30 * 60_000;
const KEY_PREFIX = "appsheet::table::";

type KvLike = {
  get(key: string, type: "json"): Promise<unknown>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
};

export type SharedTableEntry = { cachedAt: number; rows: AppSheetRow[] };

// `env.ts` (Workers) expone el binding de KV en globalThis.__APPSHEET_KV (NO en
// process.env: ahí los valores se stringifican y el namespace quedaría como
// "[object Object]"). En Docker/Node no existe y todas las funciones son no-op.
function kvBinding(): KvLike | null {
  const kv = (globalThis as Record<string, unknown>)["__APPSHEET_KV"];
  if (!kv || typeof kv !== "object") return null;
  const maybe = kv as Partial<KvLike>;
  if (typeof maybe.get !== "function" || typeof maybe.put !== "function" || typeof maybe.delete !== "function") {
    return null;
  }
  return kv as KvLike;
}

function keyOf(tableName: string): string {
  return `${KEY_PREFIX}${tableName}`;
}

export async function sharedGetTable(tableName: string): Promise<SharedTableEntry | null> {
  const kv = kvBinding();
  if (!kv) return null;
  try {
    const raw = await kv.get(keyOf(tableName), "json");
    if (!raw || typeof raw !== "object") return null;
    const { cachedAt, rows } = raw as Partial<SharedTableEntry>;
    if (typeof cachedAt !== "number" || !Array.isArray(rows)) return null;
    return { cachedAt, rows: rows as AppSheetRow[] };
  } catch (error) {
    console.error(`[appsheet.sharedCache] get falló para ${tableName}`, error);
    return null;
  }
}

export async function sharedSetTable(tableName: string, rows: AppSheetRow[], cachedAt = Date.now()): Promise<void> {
  const kv = kvBinding();
  if (!kv) return;
  try {
    const value = JSON.stringify({ cachedAt, rows } satisfies SharedTableEntry);
    await kv.put(keyOf(tableName), value);
  } catch (error) {
    console.error(`[appsheet.sharedCache] put falló para ${tableName}`, error);
  }
}

export async function sharedInvalidateTable(tableName: string): Promise<void> {
  const kv = kvBinding();
  if (!kv) return;
  try {
    await kv.delete(keyOf(tableName));
  } catch (error) {
    console.error(`[appsheet.sharedCache] delete falló para ${tableName}`, error);
  }
}

export async function sharedInvalidateTables(tableNames: string[]): Promise<void> {
  await Promise.allSettled(tableNames.map((name) => sharedInvalidateTable(name)));
}