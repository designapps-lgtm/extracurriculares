import { api } from "./api";
import type { ApiResponse, RutaSlot, RutasReport } from "../types";

export async function getRutas(): Promise<RutasReport> {
  const response = await api.get<ApiResponse<RutasReport>>("/api/rutas");
  return response.data;
}

/** Mapa código de estudiante → slots de ruta. Falla silenciosamente (mapa vacío) si la fuente no está disponible. */
export async function getRutasPorCodigo(): Promise<Record<string, RutaSlot[]>> {
  try {
    const report = await getRutas();
    return report.estudiantes.reduce((acc, student) => {
      if (student.ruta.length > 0) acc[student.codigo] = student.ruta;
      return acc;
    }, {} as Record<string, RutaSlot[]>);
  } catch {
    return {};
  }
}