import rateLimit from "express-rate-limit";
import type { RequestHandler } from "express";

// En producción (servidor Node), el rate limiting puede estar en el reverse
// proxy (Nginx/Caddy) que lo maneja a nivel de edge. Por eso estos middlewares
// son no-op por defecto: evitar que la app bloquee tráfico legítimo con 429
// (una escuela detrás de un NAT comparte la misma IP → se satura fácil).
//
// El limitador SOLO se activa cuando se define explícitamente un límite por env
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
