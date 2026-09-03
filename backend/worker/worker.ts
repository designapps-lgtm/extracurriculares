import "./env";
import { httpServerHandler } from "cloudflare:node";
import app from "../src/app";
import { config } from "../src/config";
import { syncNovedadesFromDrive } from "../src/modules/novedades/novedades.service";
import { ensureDriveWatch, syncDriveSources } from "../src/modules/driveSync/driveSync.service";
import { syncAppSheetStudents } from "../src/modules/appsheet/appsheet.students";

app.listen(config.port);

const expressHandler = httpServerHandler({ port: config.port });

export default {
  ...expressHandler,

  // Cron trigger definido en wrangler.toml. Reemplaza al setInterval de server.ts.
  async scheduled(_controller: unknown, _env: unknown, _ctx: unknown) {
    if (!config.googleServiceAccountJson || !config.googleDriveFolderId) {
      console.log("[Novedades] Sync desactivado: faltan GOOGLE_SERVICE_ACCOUNT_JSON o GOOGLE_DRIVE_FOLDER_ID");
      return;
    }

    try {
      // Estudiantes: si AppSheet está configurado, la fuente de verdad es la
      // tabla "Demograficos" (evita depender de permisos de la service account
      // sobre el Sheet compartido con la cuenta del colegio).
      if (config.appsheetAppId && config.appsheetAccessKey) {
        const students = await syncAppSheetStudents();
        if (students.errors.length > 0) {
          console.error(`[AppSheet] Sync de estudiantes con errores: ${students.errors.join(" | ")}`);
        } else {
          console.log(`[AppSheet] Estudiantes OK: ${students.processed} procesados (${students.created} nuevos, ${students.updated} actualizados)`);
        }
      } else {
        console.log("[AppSheet] Sync desactivado: faltan APPSHEET_APP_ID o APPSHEET_APPLICATION_ACCESS_KEY");
      }

      if (config.googleDriveWebhookUrl && config.googleDriveWebhookToken) {
        await ensureDriveWatch();
      } else {
        console.log("[Drive] Webhook no configurado; se ejecuta solo sync de respaldo");
      }

      const driveResult = await syncDriveSources();
      if (driveResult.errors.length > 0) {
        console.error(`[Drive] Sync con errores: ${driveResult.errors.join(" | ")}`);
      } else {
        console.log(`[Drive] Sync OK: ${driveResult.files} archivos procesados`);
      }

      const result = await syncNovedadesFromDrive();
      if (result.errors.length > 0) {
        console.error(`[Novedades] Sync con errores: ${result.errors.join(" | ")}`);
      } else {
        console.log(`[Novedades] Sync OK: ${result.files} archivos, ${result.novedades} novedades`);
      }
    } catch (e: any) {
      console.error("[Novedades] Error en sync periódico:", e?.message || e);
    }
  },
};
