export interface GradeLike {
  idGrado: number;
  nombre: string;
}

export function formatGradesRange(grades: GradeLike[]): string {
  const sorted = [...grades].sort((a, b) => a.idGrado - b.idGrado);
  if (sorted.length === 0) return "";
  const parts: string[] = [];
  let start = 0;
  for (let i = 1; i <= sorted.length; i++) {
    if (i < sorted.length && sorted[i].idGrado === sorted[i - 1].idGrado + 1) continue;
    const run = sorted.slice(start, i);
    parts.push(run.length >= 2 ? `${run[0].nombre} a ${run[run.length - 1].nombre}` : run[0].nombre);
    start = i;
  }
  return parts.join(", ");
}