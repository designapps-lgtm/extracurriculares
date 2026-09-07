const DAY_NAMES = ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"] as const;

function bogotaParts(date = new Date()): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function todayColombia(date = new Date()): string {
  const parts = bogotaParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function dayColombia(date = new Date()): string {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/Bogota", weekday: "short" }).format(date);
  const index: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return DAY_NAMES[index[weekday] ?? 0];
}

export function nowIso(): string {
  return new Date().toISOString();
}

// AppSheet devuelve las fechas en "MM/DD/YYYY HH:mm:ss" en el Find, pero al
// hacer Edit recha esos mismos valores si se reenvían tal cual (los re-interpreta
// y falla). Convertimos a formato ISO local (sin Z) que AppSheet acepta como input.
export function appSheetDateTimeToIso(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/.exec(text);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}T${iso[4]}:${iso[5]}:${iso[6]}`;
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T]?(\d{2})?:?(\d{2})?:?(\d{2})?/.exec(text);
  if (slash) {
    const [, month, day, year, hh = "00", mm = "00", ss = "00"] = slash;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hh.padStart(2, "0")}:${mm.padStart(2, "0")}:${ss.padStart(2, "0")}`;
  }
  return null;
}

export function normalizeDateOnly(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const slash = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(text);
  if (slash) return `${slash[3]}-${slash[2].padStart(2, "0")}-${slash[1].padStart(2, "0")}`;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : todayColombia(parsed);
}

export function normalizeDayName(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toUpperCase();
}
