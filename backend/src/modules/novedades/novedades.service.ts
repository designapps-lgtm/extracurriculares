import { sql, first } from "../../config/db";
import { config } from "../../config";
import {
  parseServiceAccount,
  isDriveConfigured,
  listFolderFiles,
  downloadSpreadsheet,
  type DriveFile,
} from "./googleDrive.service";
import { parseNovedadesSheet } from "./novedades.parser";

export interface SyncResult {
  ok: boolean;
  driveConfigured: boolean;
  files: number;
  novedades: number;
  errors: string[];
}

export async function syncNovedadesFromDrive(): Promise<SyncResult> {
  if (!isDriveConfigured(config.googleServiceAccountJson || "", config.googleDriveFolderId || "")) {
    return { ok: false, driveConfigured: false, files: 0, novedades: 0, errors: ["Drive no configurado: faltan GOOGLE_SERVICE_ACCOUNT_JSON o GOOGLE_DRIVE_FOLDER_ID"] };
  }

  const creds = parseServiceAccount(config.googleServiceAccountJson!);
  const folderId = config.googleDriveFolderId!;

  const errors: string[] = [];
  let totalNovedades = 0;
  let totalFiles = 0;

  let files: DriveFile[];
  try {
    files = await listFolderFiles(folderId, creds);
  } catch (e: any) {
    return { ok: false, driveConfigured: true, files: 0, novedades: 0, errors: [e.message || "Error listando archivos"] };
  }

  const spreadsheets = files.filter(
    (f) => f.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || f.mimeType === "application/vnd.google-apps.spreadsheet" || f.name.toLowerCase().endsWith(".xlsx")
  );

  for (const file of spreadsheets) {
    try {
      const buffer = await downloadSpreadsheet(file, creds);
      const rows = parseNovedadesSheet(buffer, file.name);

      if (rows.length === 0) continue;

      // Transacción HTTP batched: el callback DEBE devolver un array de queries.
      // neon() las ejecuta todas en un solo request HTTP → atomicidad garantizada.
      // Patrón: DELETE + N×INSERT con ON CONFLICT para upsert.
      await sql.transaction((tx) => [
        tx`DELETE FROM "Novedad" WHERE "archivo" = ${file.name}`,
        ...rows.map((r) => tx(
          `INSERT INTO "Novedad" (
            "id", "novedadId", "archivo", "codigoEstudiante", "descripcion",
            "seAusentaCon", "seAusentaConOtro", "seAusentaConTipo",
            "tipoNovedad", "flujoNovedad", "grados", "nombresEstudiantes",
            "fotoUrls", "fechaHora", "scanCodes", "fechaCreacion",
            "registradoPor", "procesado", "regresaAlColegio",
            "horaEstimadaRegreso", "fechaNovedad", "updatedAt"
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, now()
          ) ON CONFLICT ("novedadId", "codigoEstudiante") DO UPDATE SET
            "archivo" = EXCLUDED."archivo",
            "descripcion" = EXCLUDED."descripcion",
            "seAusentaCon" = EXCLUDED."seAusentaCon",
            "seAusentaConOtro" = EXCLUDED."seAusentaConOtro",
            "seAusentaConTipo" = EXCLUDED."seAusentaConTipo",
            "tipoNovedad" = EXCLUDED."tipoNovedad",
            "flujoNovedad" = EXCLUDED."flujoNovedad",
            "grados" = EXCLUDED."grados",
            "nombresEstudiantes" = EXCLUDED."nombresEstudiantes",
            "fotoUrls" = EXCLUDED."fotoUrls",
            "fechaHora" = EXCLUDED."fechaHora",
            "scanCodes" = EXCLUDED."scanCodes",
            "fechaCreacion" = EXCLUDED."fechaCreacion",
            "registradoPor" = EXCLUDED."registradoPor",
            "procesado" = EXCLUDED."procesado",
            "regresaAlColegio" = EXCLUDED."regresaAlColegio",
            "horaEstimadaRegreso" = EXCLUDED."horaEstimadaRegreso",
            "fechaNovedad" = EXCLUDED."fechaNovedad",
            "updatedAt" = now()
          `,
          [
            r.novedadId,
            file.name,
            r.codigoEstudiante,
            r.descripcion || null,
            r.seAusentaCon || null,
            r.seAusentaConOtro || null,
            r.seAusentaConTipo || null,
            r.tipoNovedad || null,
            r.flujoNovedad || null,
            r.grados || null,
            r.nombresEstudiantes || null,
            r.fotoUrls || null,
            r.fechaHora,
            r.scanCodes || null,
            r.fechaCreacion,
            r.registradoPor || null,
            r.procesado || null,
            r.regresaAlColegio,
            r.horaEstimadaRegreso || null,
            r.fechaNovedad,
          ]
        )),
      ]);

      totalNovedades += rows.length;
      totalFiles += 1;
    } catch (e: any) {
      errors.push(`${file.name}: ${e.message || "error desconocido"}`);
    }
  }

  return { ok: errors.length === 0, driveConfigured: true, files: totalFiles, novedades: totalNovedades, errors };
}

export async function getNovedadesForStudent(codigoEstudiante: string): Promise<any[]> {
  return (await sql`
    SELECT * FROM "Novedad"
    WHERE "codigoEstudiante" = ${codigoEstudiante}
    ORDER BY "fechaNovedad" DESC NULLS LAST, "fechaCreacion" DESC NULLS LAST
  `) as unknown as any[];
}

interface GroupByRow {
  archivo: string;
  _count_all: number;
  _max_updated_at: Date | string | null;
}

export async function getNovedadesStatus(): Promise<{ driveConfigured: boolean; folderId: string | null; archivos: { archivo: string; total: number; ultimaSync: Date }[] }> {
  const archivos = (await sql`
    SELECT "archivo", COUNT(*)::int AS "_count_all", MAX("updatedAt") AS "_max_updated_at"
    FROM "Novedad"
    GROUP BY "archivo"
  `) as unknown as GroupByRow[];

  return {
    driveConfigured: isDriveConfigured(config.googleServiceAccountJson || "", config.googleDriveFolderId || ""),
    folderId: config.googleDriveFolderId || null,
    archivos: archivos.map((a) => ({
      archivo: a.archivo,
      total: a._count_all,
      ultimaSync: new Date(a._max_updated_at!),
    })),
  };
}
