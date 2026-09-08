// Verificación previa al deploy manual del Worker.
// Se corre con `npm run deploy:safe` (o `npm run secret:check` solo para auditar).
// Falla con exit 1 si falta algún secreto obligatorio, para no publicar
// un Worker que luego responde 500 por configuración ausente.
//
// Solo usa módulos nativos de Node: no agrega dependencias.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const WORKER_NAME = "extracurriculares-api";

// Secretos obligatorios en producción. GOOGLE_SERVICE_ACCOUNT_JSON es
// requerido porque sin él el proxy de fotos (/api/photos/drive/:fileId)
// responde 503 y las imágenes se rompen. Los opcionales de Drive/webhooks
// (GOOGLE_DRIVE_WEBHOOK_TOKEN, APPSHEET_WEBHOOK_TOKEN) solo se exigen si el
// watch está habilitado, es decir, si GOOGLE_DRIVE_FOLDER_ID tiene valor real
// en wrangler.toml.
const REQUIRED_SECRETS = [
  "JWT_SECRET",
  "GOOGLE_CLIENT_ID",
  "APPSHEET_APPLICATION_ACCESS_KEY",
  "APPSHEET_NOVEDADES_APPLICATION_ACCESS_KEY",
  "GOOGLE_SERVICE_ACCOUNT_JSON",
];

// Toda var no secreta DEBE vivir en wrangler.toml: `wrangler deploy`
// sincroniza ese bloque y borra del dashboard lo que no esté declarado ahí.
const REQUIRED_VARS = [
  "NODE_ENV",
  "PORT",
  "FRONTEND_URL",
  "ACCESS_TOKEN_EXPIRES_IN",
  "SESSION_DURATION_HOURS",
  "GOOGLE_INSTITUTION_DOMAIN",
  "APPSHEET_APP_ID",
  "APPSHEET_DEMOGRAFICOS_TABLE",
  "APPSHEET_NOVEDADES_APP_ID",
  "APPSHEET_NOVEDADES_TABLE",
  "GOOGLE_DRIVE_FOLDER_ID",
  "GOOGLE_DRIVE_WEBHOOK_URL",
];

const workerDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd) {
  try {
    return execSync(cmd, { cwd: workerDir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    const stderr = error?.stderr?.toString() ?? "";
    const hint = stderr.includes("Not logged in") || stderr.includes("login")
      ? "\nCorré `npx wrangler login` y verificá la cuenta con `npx wrangler whoami`."
      : "";
    console.error(`Falló: ${cmd}\n${stderr}${hint}`);
    process.exit(1);
  }
}

function containsName(output, name) {
  return new RegExp(`(^|[^A-Z0-9_])${name}([^A-Z0-9_]|$)`, "m").test(output);
}

// 1. Vars declaradas en wrangler.toml (fuente de verdad del deploy).
const toml = readFileSync(join(workerDir, "wrangler.toml"), "utf8");
const missingVars = REQUIRED_VARS.filter((v) => !containsName(toml, v));
if (missingVars.length > 0) {
  console.error(
    `[predeploy] Faltan en wrangler.toml [vars]: ${missingVars.join(", ")}\n` +
      "Todo lo que solo exista en el dashboard SE BORRA con el deploy. Agregalo al toml primero.",
  );
  process.exit(1);
}

// 2. Secretos cargados en Cloudflare (sobreviven al deploy, pero solo
// si se cargaron con `wrangler secret put`, nunca como vars de texto).
const secretsOutput = run(`npx wrangler secret list --name ${WORKER_NAME}`);
const missingSecrets = REQUIRED_SECRETS.filter((s) => !containsName(secretsOutput, s));
if (missingSecrets.length > 0) {
  console.error(
    `[predeploy] Faltan secrets en el Worker "${WORKER_NAME}": ${missingSecrets.join(", ")}\n` +
      "Cargalos con `npx wrangler secret put <NOMBRE>` (te lo pide interactivo) y reintentá.",
  );
  process.exit(1);
}

// 3. Si el watch de Drive está habilitado en el toml, sus secrets pasan a ser obligatorios.
const driveEnabled = /GOOGLE_DRIVE_FOLDER_ID\s*=\s*"[^"]+"/.test(toml);
if (driveEnabled) {
  const driveSecrets = ["GOOGLE_DRIVE_WEBHOOK_TOKEN"];
  const missingDrive = driveSecrets.filter((s) => !containsName(secretsOutput, s));
  if (missingDrive.length > 0) {
    console.error(
      `[predeploy] El watch de Drive está habilitado en wrangler.toml pero faltan secrets: ${missingDrive.join(", ")}`,
    );
    process.exit(1);
  }
}

console.log(`[predeploy] OK: ${REQUIRED_VARS.length} vars en wrangler.toml, ${REQUIRED_SECRETS.length} secretos obligatorios presentes en "${WORKER_NAME}".`);
