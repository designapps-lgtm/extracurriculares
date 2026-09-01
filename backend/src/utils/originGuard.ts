import { Request } from "express";
import { config } from "../config";
import { AppError } from "../middlewares/errorHandler";

const isVercelPreview = (origin: string) => /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin);

// Valida que el Origin/Referer de la request sea uno de los permitidos
// (frontend de producción, localhost de desarrollo o previews de Vercel).
// Se usa en endpoints sensibles (refresh, logout) para mitigar CSRF: un sitio
// ajeno no puede forzar rotación de tokens ni cierre de sesión.
export function assertTrustedOrigin(req: Request): void {
  const origin = req.headers.origin || req.headers.referer || "";
  if (!origin) return;

  const allowed = [config.frontendUrl, "http://localhost:5173"];
  const normalized = origin.replace(/\/$/, "");
  const isAllowed =
    allowed.some((a) => a.replace(/\/$/, "") === normalized) ||
    (typeof origin === "string" && isVercelPreview(origin.replace(/\/$/, "")));
  if (!isAllowed) {
    throw new AppError(403, "FORBIDDEN_ORIGIN", "Origen no permitido");
  }
}
