export type Nivel = "prescolar" | "primaria" | "secundaria";

export const NIVELES: Nivel[] = ["prescolar", "primaria", "secundaria"];

export function nivelDeGrado(grado: string | null | undefined): Nivel | null {
  if (!grado) return null;
  const value = grado.trim().toUpperCase();
  if (["PV", "K3", "K4", "K5"].includes(value)) return "prescolar";

  const number = Number.parseInt(value, 10);
  if (number >= 1 && number <= 5) return "primaria";
  if (number >= 6 && number <= 12) return "secundaria";
  return null;
}

export function nivelLabel(nivel: Nivel): string {
  return nivel === "prescolar" ? "Prescolar" : nivel[0].toUpperCase() + nivel.slice(1);
}
