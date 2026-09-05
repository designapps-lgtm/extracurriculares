import app from "./app";
import { config } from "./config";
import { syncNovedadesFromConfiguredSource } from "./modules/novedades/novedades.sync";
import { syncAppSheetStudents } from "./modules/appsheet/appsheet.students";
import { syncDriveSources } from "./modules/driveSync/driveSync.service";

const PORT = config.port;

async function start() {
  app.listen(PORT, () => {
    console.log(`[Backend] Server running on port ${PORT}`);
  });

  // AppSheet/Demograficos es la única fuente de Student y StudentSchedule.
  // Ante un fallo se conserva el último snapshot válido; nunca se usa Drive
  // como fallback para no reintroducir datos externos.
  const runStudentSync = async () => {
    if (!config.appsheetAppId || !config.appsheetAccessKey) {
      console.log("[AppSheet] Sync de estudiantes desactivado: faltan APPSHEET_APP_ID o APPSHEET_APPLICATION_ACCESS_KEY");
      return;
    }

    const result = await syncAppSheetStudents();
    if (result.errors.length > 0) {
      console.error(`[AppSheet] Sync con errores (${result.received} recibidas, ${result.mapped} mapeadas, ${result.middleNames} con segundo nombre): ${result.errors.join(" | ")}`);
    } else {
      console.log(`[AppSheet] Estudiantes OK: ${result.processed} procesados (${result.created} nuevos, ${result.updated} actualizados, ${result.middleNames} con segundo nombre)`);
    }
  };

  const runNovedadesSync = async () => {
    const result = await syncNovedadesFromConfiguredSource({ force: true });
    if (result.errors.length > 0) {
      console.error(`[Novedades:${result.source}] Sync con errores: ${result.errors.join(" | ")}`);
    } else {
      const warnings = result.warnings.length > 0 ? `; avisos: ${result.warnings.join(" | ")}` : "";
      console.log(`[Novedades:${result.source}] Sync OK: ${result.novedades} novedades${warnings}`);
    }
  };

  // Drive se conserva únicamente para oferta y horarios.
  const runDriveSync = async () => {
    if (!config.googleServiceAccountJson || !config.googleDriveFolderId) return;

    const offerResult = await syncDriveSources();
    if (offerResult.errors.length > 0) {
      console.error(`[Drive] Sync de oferta con errores: ${offerResult.errors.join(" | ")}`);
    } else {
      console.log(`[Drive] Oferta OK: ${offerResult.offerEntries} entradas, ${offerResult.files} archivos procesados`);
    }
  };

  if (config.appsheetAppId && config.appsheetAccessKey) {
    setTimeout(() => { runStudentSync().catch((e) => console.error("[AppSheet] Error en sync inicial:", e.message)); }, 5000);
    setInterval(() => { runStudentSync().catch((e) => console.error("[AppSheet] Error en sync periódico:", e.message)); }, config.novedadesSyncMinutes * 60 * 1000);
    console.log(`[AppSheet] Sync de estudiantes programado cada ${config.novedadesSyncMinutes} minutos`);
  } else {
    console.log("[AppSheet] Sync de estudiantes desactivado: faltan credenciales");
  }

  const novedadesConfigured = Boolean(
    (config.appsheetAppId && config.appsheetAccessKey)
      || (config.googleServiceAccountJson && config.googleDriveFolderId),
  );
  if (novedadesConfigured) {
    setTimeout(() => { runNovedadesSync().catch((e) => console.error("[Novedades] Error en sync inicial:", e.message)); }, 5000);
    setInterval(() => { runNovedadesSync().catch((e) => console.error("[Novedades] Error en sync periódico:", e.message)); }, config.novedadesSyncMinutes * 60 * 1000);
    console.log(`[Novedades] Sync programado cada ${config.novedadesSyncMinutes} minutos`);
  } else {
    console.log("[Novedades] Sync desactivado: faltan credenciales de AppSheet y Drive");
  }

  if (config.googleServiceAccountJson && config.googleDriveFolderId) {
    setTimeout(() => { runDriveSync().catch((e) => console.error("[Drive] Error en sync inicial:", e.message)); }, 5000);
    setInterval(() => { runDriveSync().catch((e) => console.error("[Drive] Error en sync periódico:", e.message)); }, config.novedadesSyncMinutes * 60 * 1000);
    console.log(`[Drive] Oferta programada cada ${config.novedadesSyncMinutes} minutos`);
  } else {
    console.log("[Drive] Oferta desactivada: faltan GOOGLE_SERVICE_ACCOUNT_JSON o GOOGLE_DRIVE_FOLDER_ID");
  }
}

start().catch((e) => {
  console.error("Failed to start server:", e);
  process.exit(1);
});
