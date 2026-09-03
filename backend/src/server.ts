import app from "./app";
import { config } from "./config";
import { syncNovedadesFromDrive } from "./modules/novedades/novedades.service";
import { syncAppSheetStudents } from "./modules/appsheet/appsheet.students";

const PORT = config.port;

async function start() {
  app.listen(PORT, () => {
    console.log(`[Backend] Server running on port ${PORT}`);
  });

  const runAppSheetSync = async () => {
    if (!config.appsheetAppId || !config.appsheetAccessKey) {
      return;
    }
    const result = await syncAppSheetStudents();
    if (result.errors.length > 0) {
      console.error(`[AppSheet] Sync con errores: ${result.errors.join(" | ")}`);
    } else {
      console.log(`[AppSheet] Estudiantes OK: ${result.processed} procesados (${result.created} nuevos, ${result.updated} actualizados)`);
    }
  };

  const runDriveSync = async () => {
    if (!config.googleServiceAccountJson || !config.googleDriveFolderId) {
      return;
    }
    const result = await syncNovedadesFromDrive();
    if (result.errors.length > 0) {
      console.error(`[Novedades] Sync con errores: ${result.errors.join(" | ")}`);
    } else {
      console.log(`[Novedades] Sync OK: ${result.files} archivos, ${result.novedades} novedades`);
    }
  };

  if (config.appsheetAppId && config.appsheetAccessKey) {
    setTimeout(() => { runAppSheetSync().catch((e) => console.error("[AppSheet] Error en sync inicial:", e.message)); }, 5000);
    setInterval(() => { runAppSheetSync().catch((e) => console.error("[AppSheet] Error en sync periódico:", e.message)); }, config.novedadesSyncMinutes * 60 * 1000);
    console.log(`[AppSheet] Sync programado cada ${config.novedadesSyncMinutes} minutos`);
  } else {
    console.log("[AppSheet] Sync desactivado: faltan APPSHEET_APP_ID o APPSHEET_APPLICATION_ACCESS_KEY");
  }

  if (config.googleServiceAccountJson && config.googleDriveFolderId) {
    // Primer sync unos segundos después de arrancar (espera a que la DB esté lista)
    setTimeout(() => { runDriveSync().catch((e) => console.error("[Novedades] Error en sync inicial:", e.message)); }, 5000);
    setInterval(() => { runDriveSync().catch((e) => console.error("[Novedades] Error en sync periódico:", e.message)); }, config.novedadesSyncMinutes * 60 * 1000);
    console.log(`[Novedades] Sync programado cada ${config.novedadesSyncMinutes} minutos`);
  } else {
    console.log("[Novedades] Sync desactivado: faltan GOOGLE_SERVICE_ACCOUNT_JSON o GOOGLE_DRIVE_FOLDER_ID");
  }
}

start().catch((e) => {
  console.error("Failed to start server:", e);
  process.exit(1);
});
