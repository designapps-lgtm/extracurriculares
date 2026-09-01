import rateLimit from "express-rate-limit";
import type { RequestHandler } from "express";

// En Cloudflare Workers, ejecutar express-rate-limit en el load-time del módulo
// (como hace app.ts al importar) dispara un setInterval del MemoryStore en
// global scope, que el runtime edge PROHÍBE ("Disallowed operation called
// within global scope"). Además, un store en memoria no tiene sentido en
// Workers: no persiste entre instancias y hay una instancia por request.
//
// El servidor SOLO corre en Cloudflare Workers en producción, y el rate
// limiting ahí lo maneja Cloudflare mismo (a nivel de edge/plan). Por eso estos
// middlewares son no-op por defecto: evitar que la app bloquee tráfico legítimo
// con 429 (una escuela detrás de un NAT comparte la misma IP → se satura fácil).
//
// Si alguna vez se corre en Node (dev con docker o un servidor propio), el
// limitador SOLO se activa cuando se define explícitamente un límite por env
// (AUTH_RATE_LIMIT / API_RATE_LIMIT). Sin env → no-op. Así nunca bloqueamos
// por muchas peticiones sin que el operador lo decida a propósito.
const noopLimiter: RequestHandler = (_req, _res, next) => next();

const rateLimitMessage = (message: string) => ({
  success: false,
  error: { code: "RATE_LIMITED", message },
});

const positiveInt = (value: string | undefined): number | null => {
  const parsed = parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const makeLimiter = (envName: string, message: string): RequestHandler => {
  const limit = positiveInt(process.env[envName]);
  if (limit === null) return noopLimiter;
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: rateLimitMessage(message),
  });
};

export const authLimiter: RequestHandler = makeLimiter(
  "AUTH_RATE_LIMIT",
  "Demasiados intentos de acceso. Intentá de nuevo en unos minutos.",
);

export const apiLimiter: RequestHandler = makeLimiter(
  "API_RATE_LIMIT",
  "Demasiadas solicitudes. Intentá de nuevo en unos minutos.",
);
