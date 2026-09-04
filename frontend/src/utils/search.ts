export function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .trim();
}

export function matchesSearchText(value: string | null | undefined, query: string | null | undefined): boolean {
  const normalizedValue = normalizeSearchText(value);
  const tokens = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  return tokens.every((token) => normalizedValue.includes(token));
}
