import { config } from "../../config";
import { AppError } from "../../middlewares/errorHandler";
import { findAppSheetRows } from "../appsheet/appsheet.service";
import { buildRutasReport, type RutasReport } from "./rutas.domain";

const DEMOGRAFICOS_TABLE = config.appsheetDemograficosTable;

/** Reporte de ruta: estudiantes marcados en las columnas de día/hora de Demograficos. */
export async function getRutasReport(): Promise<RutasReport> {
  let rows;
  try {
    rows = await findAppSheetRows(DEMOGRAFICOS_TABLE);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new AppError(
      503,
      "RUTAS_FUENTE_NO_DISPONIBLE",
      `No se pudo leer Demograficos (¿columnas nuevas sin regenerar en AppSheet?). ${detail}`,
    );
  }

  if (rows.length === 0) {
    throw new AppError(503, "RUTAS_SIN_DATOS", "No hay estudiantes en Demograficos para reportar rutas");
  }

  return buildRutasReport(rows);
}