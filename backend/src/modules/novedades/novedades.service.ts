import prisma from "../../config/prisma";
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

      // Reemplazo completo por archivo: la fuente de verdad es el Drive
      if (rows.length === 0) continue;

      await prisma.$transaction(async (tx) => {
        await tx.novedad.deleteMany({ where: { archivo: file.name } });
        await tx.novedad.createMany({
          data: rows.map((r) => ({
            novedadId: r.novedadId,
            archivo: file.name,
            codigoEstudiante: r.codigoEstudiante,
            descripcion: r.descripcion || null,
            seAusentaCon: r.seAusentaCon || null,
            seAusentaConOtro: r.seAusentaConOtro || null,
            seAusentaConTipo: r.seAusentaConTipo || null,
            tipoNovedad: r.tipoNovedad || null,
            flujoNovedad: r.flujoNovedad || null,
            grados: r.grados || null,
            nombresEstudiantes: r.nombresEstudiantes || null,
            fotoUrls: r.fotoUrls || null,
            fechaHora: r.fechaHora,
            scanCodes: r.scanCodes || null,
            fechaCreacion: r.fechaCreacion,
            registradoPor: r.registradoPor || null,
            procesado: r.procesado || null,
            regresaAlColegio: r.regresaAlColegio,
            horaEstimadaRegreso: r.horaEstimadaRegreso || null,
            fechaNovedad: r.fechaNovedad,
          })),
        });
      });

      totalNovedades += rows.length;
      totalFiles += 1;
    } catch (e: any) {
      errors.push(`${file.name}: ${e.message || "error desconocido"}`);
    }
  }

  return { ok: errors.length === 0, driveConfigured: true, files: totalFiles, novedades: totalNovedades, errors };
}

export async function getNovedadesForStudent(codigoEstudiante: string): Promise<any[]> {
  return prisma.novedad.findMany({
    where: { codigoEstudiante },
    orderBy: [{ fechaNovedad: "desc" }, { fechaCreacion: "desc" }],
  });
}

export async function getNovedadesStatus(): Promise<{ driveConfigured: boolean; folderId: string | null; archivos: { archivo: string; total: number; ultimaSync: Date }[] }> {
  const archivos = await prisma.novedad.groupBy({
    by: ["archivo"],
    _count: { _all: true },
    _max: { updatedAt: true },
  });
  return {
    driveConfigured: isDriveConfigured(config.googleServiceAccountJson || "", config.googleDriveFolderId || ""),
    folderId: config.googleDriveFolderId || null,
    archivos: archivos.map((a) => ({ archivo: a.archivo, total: a._count._all, ultimaSync: a._max.updatedAt! })),
  };
}