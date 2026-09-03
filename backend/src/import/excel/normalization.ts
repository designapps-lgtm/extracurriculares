/** Normaliza identificadores sin convertirlos a número, para conservar ceros iniciales. */
export function normalizeStudentCode(value: unknown): string {
  let text = String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, "");
  // Google Sheets/AppSheet puede serializar un código entero como 12345.0.
  if (/^\d+\.0+$/.test(text)) text = text.replace(/\.0+$/, "");
  return text;
}

export function normalizeLookupText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/** Convierte grados como 8A/8-B a la clave académica 8. */
export function canonicalGradeName(value: unknown): string {
  const text = String(value ?? "").normalize("NFKC").trim().toUpperCase();
  const match = text.match(/^(\d{1,2})\s*[-\/]?\s*[A-Z]$/);
  return match ? match[1] : text;
}

export function normalizeGradeAndGroup(grade: unknown, group: unknown): { grade: string; group: string | null } {
  const rawGrade = String(grade ?? "").normalize("NFKC").trim().toUpperCase();
  const rawGroup = String(group ?? "").normalize("NFKC").trim();
  const match = rawGrade.match(/^(\d{1,2})\s*[-\/]?\s*([A-Z])$/);
  if (match && !rawGroup) return { grade: match[1], group: match[2] };
  return { grade: canonicalGradeName(rawGrade), group: rawGroup || null };
}
