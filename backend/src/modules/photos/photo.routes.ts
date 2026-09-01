import { Router } from "express";
import { config } from "../../config";
import { asyncHandler, AppError } from "../../middlewares/errorHandler";
import { sql } from "../../config/db";
import { apiLimiter } from "../../middlewares/rateLimiter";
import { getDriveToken, parseServiceAccount } from "../novedades/googleDrive.service";

export const photoRouter = Router();

photoRouter.use(apiLimiter);

// La foto solo se sirve si el fileId corresponde a una foto conocida en la base
// de datos (estudiantes, profesores, supervisores, secretarias o novedades).
// Esto evita usar el proxy para leer archivos arbitrarios del Drive de la
// service account (que tiene acceso a toda la cuenta con scope read-only).
async function isKnownPhotoId(fileId: string): Promise<boolean> {
  // fotoUrl se guarda como URL completa (…/api/photos/drive/<fileId>); el
  // último segmento es el id. Comparamos por sufijo para no depender del host.
  const [students, teachers, supervisors, secretaries] = await Promise.all([
    sql`SELECT 1 FROM "Student" WHERE "fotoUrl" LIKE ${`%/${fileId}`} LIMIT 1`,
    sql`SELECT 1 FROM "Teacher" WHERE "fotoUrl" LIKE ${`%/${fileId}`} LIMIT 1`,
    sql`SELECT 1 FROM "Supervisor" WHERE "fotoUrl" LIKE ${`%/${fileId}`} LIMIT 1`,
    sql`SELECT 1 FROM "Secretary" WHERE "fotoUrl" LIKE ${`%/${fileId}`} LIMIT 1`,
  ]);
  if (students.length > 0 || teachers.length > 0 || supervisors.length > 0 || secretaries.length > 0) {
    return true;
  }

  // Novedades guardan fotos como lista separada por comas en "fotoUrls".
  const novedades = (await sql`
    SELECT 1 FROM "Novedad" WHERE "fotoUrls" LIKE ${`%${fileId}%`} LIMIT 1
  `) as unknown as Array<{ "?column?": number }>;
  return novedades.length > 0;
}

photoRouter.get("/drive/:fileId", asyncHandler(async (req, res) => {
  if (!config.googleServiceAccountJson) {
    throw new AppError(503, "DRIVE_NOT_CONFIGURED", "Google Drive no está configurado");
  }

  const fileId = String(req.params.fileId || "").trim();
  if (!fileId) {
    throw new AppError(400, "VALIDATION_ERROR", "fileId es requerido");
  }
  if (!/^[A-Za-z0-9_-]{10,}$/.test(fileId)) {
    throw new AppError(400, "VALIDATION_ERROR", "fileId inválido");
  }

  if (!(await isKnownPhotoId(fileId))) {
    throw new AppError(404, "PHOTO_NOT_FOUND", "Foto no encontrada");
  }

  const creds = parseServiceAccount(config.googleServiceAccountJson);
  const token = await getDriveToken(creds);
  const metaUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,thumbnailLink&supportsAllDrives=true`;
  const metaRes = await fetch(metaUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (!metaRes.ok) {
    if (metaRes.status === 404) throw new AppError(404, "PHOTO_NOT_FOUND", "Foto no encontrada");
    throw new AppError(502, "DRIVE_ERROR", "No se pudo obtener la foto desde Drive");
  }

  const meta = await metaRes.json() as { mimeType?: string; thumbnailLink?: string };
  if (!meta.thumbnailLink) {
    throw new AppError(404, "PHOTO_THUMBNAIL_NOT_FOUND", "La foto no tiene miniatura disponible");
  }

  const imageRes = await fetch(meta.thumbnailLink, { headers: { Authorization: `Bearer ${token}` } });
  if (!imageRes.ok || !imageRes.body) {
    throw new AppError(502, "DRIVE_THUMBNAIL_ERROR", "No se pudo descargar la miniatura desde Drive");
  }

  res.setHeader("Content-Type", imageRes.headers.get("content-type") || meta.mimeType || "image/jpeg");
  res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.send(Buffer.from(await imageRes.arrayBuffer()));
}));
