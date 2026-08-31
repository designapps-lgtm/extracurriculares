import rateLimit from "express-rate-limit";
import type { RequestHandler } from "express";

// En Cloudflare Workers, ejecutar express-rate-limit en el load-time del módulo
// (como hace app.ts al importar) dispara un setInterval del MemoryStore en
// global scope, que el runtime edge PROHÍBE ("Disallowed operation called
// within global scope"). Además, un store en memoria no tiene sentido en
// Workers: no persiste entre instancias y hay una instancia por request.
//
// En Workers el rate limiting lo hace Cloudflare mismo (a nivel de zona/plan),
// así que acá exportamos middlewares no-op. En Node/Render se mantiene real.
// Detección: en Workers (workerd) `WebSocket` es global; en Node no lo es.
const isWorkersRuntime = typeof WebSocket !== "undefined";

const noopLimiter: RequestHandler = (_req, _res, next) => next();

const rateLimitMessage = (message: string) => ({
  success: false,
  error: { code: "RATE_LIMITED", message },
});

const toInt = (value: string | undefined, fallback: number) => {
  const parsed = parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

// En Workers: sin rate limit en app (lo maneja Cloudflare).
// En Node/Render: real.
export const authLimiter: RequestHandler = isWorkersRuntime
  ? noopLimiter
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: toInt(process.env.AUTH_RATE_LIMIT, 100),
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: rateLimitMessage("Demasiados intentos de acceso. Intentá de nuevo en unos minutos."),
    });

export const apiLimiter: RequestHandler = isWorkersRuntime
  ? noopLimiter
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: toInt(process.env.API_RATE_LIMIT, 1000),
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: rateLimitMessage("Demasiadas solicitudes. Intentá de nuevo en unos minutos."),
    });
