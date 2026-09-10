import { Router, type Request, type Response } from "express";
import { config } from "../../config";
import { getUsers } from "../../db/domain";

const router = Router();

// Diagnóstico para el flujo de deploy: si un deploy pierde bindings (por
// ejemplo, una publicación de assets que pisa al worker de la API), los
// secretos pueden faltar y el login rompe con 500/404 "mudo". Este chequeo
// reporta qué secretos faltan (incluido el service account de Drive, porque
// sin él el proxy de fotos responde 503) para que /api/health lo diga claro
// y el smoke test post-deploy lo detecte antes de dar un deploy por bueno.
function missingSecrets(): string[] {
  const missing: string[] = [];
  try {
    if (!config.jwtSecret) missing.push("JWT_SECRET");
  } catch {
    missing.push("JWT_SECRET");
  }
  if (!config.googleClientId) missing.push("GOOGLE_CLIENT_ID");
  if (!config.googleServiceAccountJson) missing.push("GOOGLE_SERVICE_ACCOUNT_JSON");
  return missing;
}

router.get("/health", async (_req: Request, res: Response) => {
  try {
    const users = await getUsers({ fresh: true });
    const secrets = missingSecrets();
    res.json({
      status: "ok",
      database: "connected",
      novedades: config.appsheetNovedadesTable && config.appsheetNovedadesAppId && config.appsheetNovedadesAccessKey
        ? "appsheet"
        : "disabled",
      checks: { usuariosRoles: users.length, secrets: secrets.length === 0 ? "ok" : secrets },
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      database: "disconnected",
      novedades: "unknown",
    });
  }
});

export { router as healthRouter };
