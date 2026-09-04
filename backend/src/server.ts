import app from "./app";
import { config } from "./config";
import { syncNovedadesFromDrive } from "./modules/novedades/novedades.service";
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

  // Drive se conserva únicamente para oferta/horarios y novedades; no importa
  // estudiantes ni inscripciones.
  const runDriveSync = async () => {
    if (!config.googleServiceAccountJson || !config.googleDriveFolderId) {
      return;
    }

    const offerResult = await syncDriveSources();
    if (offerResult.errors.length > 0) {
      console.error(`[Drive] Sync de oferta con errores: ${offerResult.errors.join(" | ")}`);
    } else {
      console.log(`[Drive] Oferta OK: ${offerResult.offerEntries} entradas, ${offerResult.files} archivos procesados`);
    }

    const novedadesResult = await syncNovedadesFromDrive();
    if (novedadesResult.errors.length > 0) {
      console.error(`[Novedades] Sync con errores: ${novedadesResult.errors.join(" | ")}`);
    } else {
      console.log(`[Novedades] Sync OK: ${novedadesResult.files} archivos, ${novedadesResult.novedades} novedades`);
    }
  };

  if (config.appsheetAppId && config.appsheetAccessKey) {
    setTimeout(() => { runStudentSync().catch((e) => console.error("[AppSheet] Error en sync inicial:", e.message)); }, 5000);
    setInterval(() => { runStudentSync().catch((e) => console.error("[AppSheet] Error en sync periódico:", e.message)); }, config.novedadesSyncMinutes * 60 * 1000);
    console.log(`[AppSheet] Sync de estudiantes programado cada ${config.novedadesSyncMinutes} minutos`);
  } else {
    console.log("[AppSheet] Sync de estudiantes desactivado: faltan credenciales");
  }

  if (config.googleServiceAccountJson && config.googleDriveFolderId) {
    setTimeout(() => { runDriveSync().catch((e) => console.error("[Drive] Error en sync inicial:", e.message)); }, 5000);
    setInterval(() => { runDriveSync().catch((e) => console.error("[Drive] Error en sync periódico:", e.message)); }, config.novedadesSyncMinutes * 60 * 1000);
    console.log(`[Drive] Oferta y novedades programadas cada ${config.novedadesSyncMinutes} minutos`);
  } else {
    console.log("[Drive] Oferta y novedades desactivadas: faltan GOOGLE_SERVICE_ACCOUNT_JSON o GOOGLE_DRIVE_FOLDER_ID");
  }
}

start().catch((e) => {
  console.error("Failed to start server:", e);
  process.exit(1);
});
