import rateLimit from "express-rate-limit";

const rateLimitMessage = (message: string) => ({
  success: false,
  error: { code: "RATE_LIMITED", message },
});

const toInt = (value: string | undefined, fallback: number) => {
  const parsed = parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

// Antes: 20/15min compartido entre login + refresh + logout de los 3 roles.
// Eso rompía en cadena: cuando el access token expira, el frontend hace
// /refresh, y si el bucket ya estaba agotado por logins (o por el NAT del
// colegio), daba 429 en TODO. Por eso:
//   - Solo login/logout cuentan contra authLimiter (refresh nunca).
//   - El límite es configurable por env, default 100/15min.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: toInt(process.env.AUTH_RATE_LIMIT, 100),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: rateLimitMessage("Demasiados intentos de acceso. Intentá de nuevo en unos minutos."),
});

// Endpoints públicos: compartidos por toda la IP (los profesores/supervisoras
// del colegio suelen estar detrás del mismo NAT), 300/15min era poco con el
// dashboard del supervisor (varias requests por carga). Default 1000/15min.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: toInt(process.env.API_RATE_LIMIT, 1000),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: rateLimitMessage("Demasiadas solicitudes. Intentá de nuevo en unos minutos."),
});