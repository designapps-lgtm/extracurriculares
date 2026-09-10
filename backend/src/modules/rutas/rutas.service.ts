import { AppError } from "../../middlewares/errorHandler";
import { query } from "../../db/mysql";
import { buildRutasReport, type RutasReport } from "./rutas.domain";

interface DemographicRow {
  code: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  homeroom: string | null;
}

interface RouteRow extends DemographicRow {
  column_key: string | null;
}

/**
 * Reporte de ruta: estudiantes marcados en las columnas de día/hora de
 * Demograficos. Las columnas dinámicas viven normalizadas en student_routes;
 * aquí se reconstruyen como filas planas para el domain.
 */
export async function getRutasReport(): Promise<RutasReport> {
  let rows: RouteRow[];
  try {
    rows = await query<RouteRow[]>(
      `SELECT d.code, d.first_name, d.middle_name, d.last_name, d.homeroom, r.column_key
       FROM demographics d
       LEFT JOIN student_routes r ON r.demographic_code = d.code
       ORDER BY d.code, r.column_key`,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new AppError(
      503,
      "RUTAS_FUENTE_NO_DISPONIBLE",
      `No se pudo leer Demograficos desde MySQL. ${detail}`,
    );
  }

  if (rows.length === 0) {
    throw new AppError(503, "RUTAS_SIN_DATOS", "No hay estudiantes en Demograficos para reportar rutas");
  }

  const normalized = normalizeRowsForReport(rows);
  return buildRutasReport(normalized);
}

function normalizeRowsForReport(rows: RouteRow[]): Array<Record<string, unknown>> {
  const byCode = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    let result = byCode.get(row.code);
    if (!result) {
      result = {
        BARCODE: row.code,
        "FIRST NAME": row.first_name,
        "MIDDLE NAME": row.middle_name,
        "LAST NAME": row.last_name,
        HOMEROOM: row.homeroom ?? "",
      };
      byCode.set(row.code, result);
    }
    if (row.column_key) result[row.column_key] = "1";
  }
  return [...byCode.values()];
}