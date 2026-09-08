import "./env";
import { httpServerHandler } from "cloudflare:node";
import app from "../src/app";
import { config } from "../src/config";
import { syncAppSheetStudents } from "../src/modules/appsheet/appsheet.students";

app.listen(config.port);

const expressHandler = httpServerHandler({ port: config.port });

export default {
  ...expressHandler,
  async scheduled(): Promise<void> {
    // AppSheet es la fuente de verdad en vivo. Cada 10 min se validan las
    // columnas CC_* de Demograficos y se reconcilia EC_Inscripciones para que
    // la app refleje lo que el colegio carga en el Sheet (opción B).
    try {
      const result = await syncAppSheetStudents();
      console.log(
        `[AppSheet] Sync estudiantes: ok=${result.ok} altas=${result.enrollmentAdded} ` +
        `bajas=${result.enrollmentRemoved} estudiantes=${result.enrollmentChangedStudents} ` +
        `huerfanas=${result.enrollmentOrphanCodes.join(",") || "ninguna"} errores=${result.errors.join("; ") || "ninguno"}`,
      );
    } catch (error) {
      console.error(`[AppSheet] Sync estudiantes falló: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};
