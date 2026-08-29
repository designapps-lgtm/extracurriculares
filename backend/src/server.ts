import app from "./app";
import { config } from "./config";
import { syncNovedadesFromDrive } from "./modules/novedades/novedades.service";

const PORT = config.port;

async function start() {
  app.listen(PORT, () => {
    console.log(`[Backend] Server running on port ${PORT}`);
  });

  if (config.googleServiceAccountJson && config.googleDriveFolderId) {
    const runSync = async () => {
      const result = await syncNovedadesFromDrive();
      if (result.errors.length > 0) {
        console.error(`[Novedades] Sync con errores: ${result.errors.join(" | ")}`);
      } else {
        console.log(`[Novedades] Sync OK: ${result.files} archivos, ${result.novedades} novedades`);
      }
    };

    // Primer sync unos segundos después de arrancar (espera a que la DB esté lista)
    setTimeout(() => { runSync().catch((e) => console.error("[Novedades] Error en sync inicial:", e.message)); }, 5000);
    setInterval(() => { runSync().catch((e) => console.error("[Novedades] Error en sync periódico:", e.message)); }, config.novedadesSyncMinutes * 60 * 1000);
    console.log(`[Novedades] Sync programado cada ${config.novedadesSyncMinutes} minutos`);
  } else {
    console.log("[Novedades] Sync desactivado: faltan GOOGLE_SERVICE_ACCOUNT_JSON o GOOGLE_DRIVE_FOLDER_ID");
  }
}

start().catch((e) => {
  console.error("Failed to start server:", e);
  process.exit(1);
});
