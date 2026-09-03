// Convención de fechas para novedades: "día calendario de Colombia".
// Un día en Bogotá arranca a las 00:00 hora local = 05:00 UTC (Colombia es UTC-5).
// Todas las funciones de este módulo usan esa misma convención para evitar desfases.

const TZ = "America/Bogota";

function colombiaParts(d: Date): {
  year: string;
  month: string;
  day: string;
  weekday: string;
} {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
  }).formatToParts(d);
  const get = (t: string) => fmt.find((p) => p.type === t)?.value || "";
  return { year: get("year"), month: get("month"), day: get("day"), weekday: get("weekday").toUpperCase() };
}

export const DAY_NAME_MAP: Record<string, string> = {
  MONDAY: "LUNES",
  TUESDAY: "MARTES",
  WEDNESDAY: "MIERCOLES",
  THURSDAY: "JUEVES",
  FRIDAY: "VIERNES",
  SATURDAY: "SABADO",
  SUNDAY: "DOMINGO",
};

// "YYYY-MM-DD" del día calendario de Colombia de la fecha dada.
export function colombiaDateKey(d: Date): string {
  const p = colombiaParts(d);
  return `${p.year}-${p.month}-${p.day}`;
}

// Inicio del día calendario de Colombia que contiene `d` (05:00Z).
export function colombiaStartOfDay(d: Date): Date {
  const p = colombiaParts(d);
  return new Date(`${p.year}-${p.month}-${p.day}T05:00:00.000Z`);
}

export function todayColombiaStart(): Date {
  return colombiaStartOfDay(new Date());
}

export function novedadDayName(n: {
  fechaNovedad?: Date | null;
  fechaHora?: Date | null;
  fechaCreacion?: Date | null;
}): string {
  const d = n.fechaNovedad || n.fechaHora || n.fechaCreacion;
  if (!d) return "";
  return DAY_NAME_MAP[colombiaParts(d).weekday] || "";
}

// Rango [inicio, fin) del día calendario de Colombia (05:00Z del día → 05:00Z del día siguiente).
// Recibe una fecha de consulta; si es solo "YYYY-MM-DD" se interpreta como ese día de Colombia.
export function dayBounds(fechaISO: string): { start: Date; end: Date } | null {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(fechaISO);
  let d: Date;
  if (dateOnly) {
    d = new Date(`${fechaISO}T05:00:00.000Z`);
  } else {
    d = new Date(fechaISO);
  }
  if (isNaN(d.getTime())) return null;

  const start = colombiaStartOfDay(d);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

// True si la novedad pertenece al día calendario de Colombia consultado.
// Compara por clave de fecha (robusto ante el huso de guardado de cada fecha).
export function isOnDay(
  n: { fechaNovedad?: Date | null; fechaCreacion?: Date | null },
  bounds: { start: Date; end: Date }
): boolean {
  const d = n.fechaNovedad || n.fechaCreacion;
  if (!d) return false;
  const startKey = colombiaDateKey(bounds.start);
  const novedadKey = colombiaDateKey(d);
  return novedadKey === startKey;
}

// True si la novedad es de "hoy o después" (visión por defecto, sin fecha).
export function isActive(n: { fechaNovedad?: Date | null; fechaCreacion?: Date | null }): boolean {
  const todayStart = todayColombiaStart();
  if (n.fechaNovedad) return n.fechaNovedad >= todayStart;
  if (n.fechaCreacion) return n.fechaCreacion >= todayStart;
  return false;
}
