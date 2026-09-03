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

  const runStudentSync = async () => {
    let shouldSyncDriveStudents = true;
    if (config.appsheetAppId && config.appsheetAccessKey) {
      const result = await syncAppSheetStudents();
      // No usar un Excel posiblemente viejo después de una importación AppSheet
      // parcial: sólo se habilita el fallback si no se procesó ninguna fila.
      shouldSyncDriveStudents = !result.ok && result.processed === 0;
      if (result.errors.length > 0) {
        console.error(`[AppSheet] Sync con errores (${result.received} recibidas, ${result.mapped} mapeadas, ${result.middleNames} con segundo nombre): ${result.errors.join(" | ")}`);
      } else {
        console.log(`[AppSheet] Estudiantes OK: ${result.processed} procesados (${result.created} nuevos, ${result.updated} actualizados, ${result.middleNames} con segundo nombre)`);
      }
    }

    if (shouldSyncDriveStudents && config.googleServiceAccountJson && config.googleDriveFolderId) {
      const fallback = await syncDriveSources({ syncStudents: true });
      if (fallback.errors.length > 0) {
        console.error(`[Drive] Fallback de estudiantes con errores: ${fallback.errors.join(" | ")}`);
      } else {
        console.log(`[Drive] Fallback de estudiantes OK: ${fallback.students} procesados`);
      }
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

  if (config.appsheetAppId || (config.googleServiceAccountJson && config.googleDriveFolderId)) {
    setTimeout(() => { runStudentSync().catch((e) => console.error("[Students] Error en sync inicial:", e.message)); }, 5000);
    setInterval(() => { runStudentSync().catch((e) => console.error("[Students] Error en sync periódico:", e.message)); }, config.novedadesSyncMinutes * 60 * 1000);
    console.log(`[Students] Sync programado cada ${config.novedadesSyncMinutes} minutos`);
  } else {
    console.log("[Students] Sync desactivado: faltan credenciales de AppSheet y Drive");
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
