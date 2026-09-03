export function colombiaDateKey(value?: string | Date | null): string | undefined {
  if (!value) return undefined;
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function todayColombiaDateKey(): string {
  return colombiaDateKey(new Date())!;
}
