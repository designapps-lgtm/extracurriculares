// Semántica de fechas (heredada de AppSheet, preservada en MySQL):
// - createdAt/updatedAt se escriben con nowIso() (UTC con Z) y AppSheet los
//   devolvía con Z; el frontend los parsea como instante absoluto.
// - registeredAt se escribe con nowBogotaLocal() (reloj de pared naive sin
//   zona); al leerlo se devuelve esa hora local sin Z.
// MySQL guarda DATETIME como "YYYY-MM-DD HH:MM:SS". Estos helpers traducen
// entre ese formato y los dos convenios ISO que el dominio/distribuye.

export function isoToMysql(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.trim();
  const time = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/.exec(text);
  if (time) return `${time[1]} ${time[2]}`;
  const dateOnly = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  if (dateOnly) return `${dateOnly[1]} 00:00:00`;
  return null;
}

export function mysqlToIsoUtc(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/.exec(value.trim());
  if (!match) return null;
  return `${match[1]}T${match[2]}.000Z`;
}

export function mysqlToIsoLocal(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/.exec(value.trim());
  if (!match) return null;
  return `${match[1]}T${match[2]}`;
}

export function mysqlDateToDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  if (!match) return null;
  return match[1];
}