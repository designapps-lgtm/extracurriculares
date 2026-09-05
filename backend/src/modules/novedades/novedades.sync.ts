import { config } from "../../config";
import { syncAppSheetNovedades } from "../appsheet/appsheet.novedades";
import { syncNovedadesFromDrive } from "./novedades.service";

export interface NovedadesSyncResult {
  ok: boolean;
  source: "appsheet" | "drive";
  table?: string;
  files?: number;
  novedades: number;
  skipped?: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * AppSheet/Novedades_Diarias es la fuente autoritativa cuando sus credenciales
 * están configuradas. Drive queda sólo como fallback de desarrollo/legacy y
 * nunca sobrescribe un fallo temporal de AppSheet con un archivo más viejo.
 */
export async function syncNovedadesFromConfiguredSource(options: { force?: boolean } = {}): Promise<NovedadesSyncResult> {
  if (config.appsheetAppId && config.appsheetAccessKey) {
    const result = await syncAppSheetNovedades(options);
    return {
      ok: result.ok,
      source: "appsheet",
      table: result.table,
      novedades: result.novedades,
      skipped: result.skipped,
      warnings: result.warnings,
      errors: result.errors,
    };
  }

  const result = await syncNovedadesFromDrive();
  return {
    ok: result.ok,
    source: "drive",
    files: result.files,
    novedades: result.novedades,
    warnings: [],
    errors: result.errors,
  };
}
