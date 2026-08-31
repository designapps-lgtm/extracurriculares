import { Router } from "express";
import { config } from "../../config";
import { asyncHandler, AppError } from "../../middlewares/errorHandler";
import { getDriveToken, parseServiceAccount } from "../novedades/googleDrive.service";

export const photoRouter = Router();

photoRouter.get("/drive/:fileId", asyncHandler(async (req, res) => {
  if (!config.googleServiceAccountJson) {
    throw new AppError(503, "DRIVE_NOT_CONFIGURED", "Google Drive no está configurado");
  }

  const fileId = String(req.params.fileId || "").trim();
  if (!fileId) {
    throw new AppError(400, "VALIDATION_ERROR", "fileId es requerido");
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
  res.send(Buffer.from(await imageRes.arrayBuffer()));
}));
