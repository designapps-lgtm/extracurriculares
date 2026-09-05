import "./env";
import { httpServerHandler } from "cloudflare:node";
import app from "../src/app";
import { config } from "../src/config";
import { syncNovedadesFromConfiguredSource } from "../src/modules/novedades/novedades.sync";
import { ensureDriveWatch, syncDriveSources } from "../src/modules/driveSync/driveSync.service";
import { syncAppSheetStudents } from "../src/modules/appsheet/appsheet.students";

app.listen(config.port);

const expressHandler = httpServerHandler({ port: config.port });

export default {
  ...expressHandler,

  // Cron trigger definido en wrangler.toml. AppSheet es la fuente de estudiantes,
  // inscripciones y Novedades_Diarias; Drive sólo actualiza la oferta.
  async scheduled(_controller: unknown, _env: unknown, _ctx: unknown) {
    try {
      if (!config.appsheetAppId || !config.appsheetAccessKey) {
        console.error("[AppSheet] Sincronización desactivada: faltan credenciales");
      } else {
        const students = await syncAppSheetStudents();
        if (students.errors.length > 0) {
          console.error(`[AppSheet] Sync de estudiantes con errores (${students.received} recibidas, ${students.mapped} mapeadas, ${students.middleNames} con segundo nombre): ${students.errors.join(" | ")}`);
        } else {
          console.log(`[AppSheet] Estudiantes OK: ${students.processed} procesados (${students.created} nuevos, ${students.updated} actualizados, ${students.middleNames} con segundo nombre)`);
        }
      }

      const novedadesResult = await syncNovedadesFromConfiguredSource({ force: true });
      if (novedadesResult.errors.length > 0) {
        console.error(`[Novedades:${novedadesResult.source}] Sync con errores: ${novedadesResult.errors.join(" | ")}`);
      } else {
        const warnings = novedadesResult.warnings.length > 0 ? `; avisos: ${novedadesResult.warnings.join(" | ")}` : "";
        console.log(`[Novedades:${novedadesResult.source}] Sync OK: ${novedadesResult.novedades} novedades${warnings}`);
      }

      const driveConfigured = Boolean(config.googleServiceAccountJson && config.googleDriveFolderId);
      if (!driveConfigured) {
        console.log("[Drive] Oferta desactivada: faltan GOOGLE_SERVICE_ACCOUNT_JSON o GOOGLE_DRIVE_FOLDER_ID");
        return;
      }

      if (config.googleDriveWebhookUrl && config.googleDriveWebhookToken) {
        await ensureDriveWatch();
      } else {
        console.log("[Drive] Webhook no configurado; se ejecuta solo sync periódico");
      }

      const driveResult = await syncDriveSources();
      if (driveResult.errors.length > 0) {
        console.error(`[Drive] Sync de oferta con errores: ${driveResult.errors.join(" | ")}`);
      } else {
        console.log(`[Drive] Oferta OK: ${driveResult.offerEntries} entradas, ${driveResult.files} archivos procesados`);
      }
    } catch (e: any) {
      console.error("[Sync] Error en sync periódico:", e?.message || e);
    }
  },
};
