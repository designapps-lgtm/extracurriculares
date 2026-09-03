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
    try {
      let shouldSyncDriveStudents = true;
      if (config.appsheetAppId && config.appsheetAccessKey) {
        const students = await syncAppSheetStudents();
        // Sólo es seguro usar Drive cuando AppSheet no llegó a iniciar la
        // importación. Si hubo errores después de comenzar, el lote pudo ser
        // aplicado parcialmente y Drive no debe pisarlo.
        shouldSyncDriveStudents = !students.ok && students.processed === 0;
        if (students.errors.length > 0) {
          console.error(`[AppSheet] Sync de estudiantes con errores (${students.received} recibidas, ${students.mapped} mapeadas, ${students.middleNames} con segundo nombre): ${students.errors.join(" | ")}`);
        } else {
          console.log(`[AppSheet] Estudiantes OK: ${students.processed} procesados (${students.created} nuevos, ${students.updated} actualizados, ${students.middleNames} con segundo nombre)`);
        }
      } else {
        console.log("[AppSheet] Sync desactivado: faltan APPSHEET_APP_ID o APPSHEET_APPLICATION_ACCESS_KEY");
      }

      // AppSheet y Drive son integraciones independientes. Si AppSheet falla
      // o recibe un lote incompleto, el Excel actualizado de Drive actúa como
      // respaldo y evita dejar la base con datos antiguos.
      if (!config.googleServiceAccountJson || !config.googleDriveFolderId) {
        console.log("[Drive] Sync desactivado: faltan GOOGLE_SERVICE_ACCOUNT_JSON o GOOGLE_DRIVE_FOLDER_ID");
        return;
      }

      if (config.googleDriveWebhookUrl && config.googleDriveWebhookToken) {
        await ensureDriveWatch();
      } else {
        console.log("[Drive] Webhook no configurado; se ejecuta solo sync de respaldo");
      }

      const driveResult = await syncDriveSources({ syncStudents: shouldSyncDriveStudents });
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
