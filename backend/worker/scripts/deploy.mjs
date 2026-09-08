// Deploy verificado y autocurativo del Worker (npm run deploy:safe).
//
// Por qué existe este script: cada vez que se publicaba una versión sin las
// bindings de secretos (por ejemplo, desplegando assets o desde el dashboard
// con otra configuración), Vercel seguía apuntando a la MISMA URL pero la API
// respondía 404 en /api/* y el login se rompía. Peor: ese tipo de deploy
// también borra los secretos del Worker.
//
// Este pipeline lo impide de forma definitiva:
//   1. preflight   -> valida vars de wrangler.toml y secretos remotos.
//   2. restaurar   -> si faltan secretos y existe .secrets.production local
//                     (archivo gitignored, solo en la máquina del deployer),
//                     los recrea con `wrangler secret bulk` antes de publicar.
//   3. deploy      -> publica el Worker.
//   4. smoke test  -> verifica /api/health (+ login con token falso) contra la
//                     URL real de producción.
//   5. rollback    -> si el smoke test falla, vuelve automáticamente a la
//                     versión anterior y aborta con exit 1.
//
// Solo usa módulos nativos de Node (Node 20+ incluye fetch).
import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const WORKER_NAME = "extracurriculares-api";
const REQUIRED_SECRETS = [
  "JWT_SECRET",
  "GOOGLE_CLIENT_ID",
  "APPSHEET_APPLICATION_ACCESS_KEY",
  "APPSHEET_NOVEDADES_APPLICATION_ACCESS_KEY",
  // Sin el service account de Drive, el proxy de fotos
  // (/api/photos/drive/:fileId) responde 503 y las imágenes se rompen.
  "GOOGLE_SERVICE_ACCOUNT_JSON",
];
const KNOWN_URL = `https://${WORKER_NAME}.gi-school.workers.dev`;

const workerDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const secretsFile = join(workerDir, ".secrets.production");

function run(cmd) {
  try {
    return execSync(cmd, { cwd: workerDir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    const stderr = error?.stderr?.toString() ?? "";
    if (stderr) process.stderr.write(stderr);
    if (stderr.includes("Not logged in") || stderr.includes("login")) {
      console.error("\nCorré `npx wrangler login` y verificá la cuenta con `npx wrangler whoami`.");
    }
    throw error;
  }
}

function containsName(output, name) {
  return new RegExp(`(^|[^A-Z0-9_])${name}([^A-Z0-9_]|$)`, "m").test(output);
}

function remoteSecretNames() {
  return run(`npx wrangler secret list --name ${WORKER_NAME}`);
}

function missingRemoteSecrets() {
  const output = remoteSecretNames();
  return REQUIRED_SECRETS.filter((name) => !containsName(output, name));
}

function restoreMissingSecrets(missing) {
  if (!existsSync(secretsFile)) {
    console.error(
      `[deploy:safe] Faltan secretos en "${WORKER_NAME}" (${missing.join(", ")}) y no hay ${secretsFile} para restaurarlos.\n` +
        "Cargalos con `npx wrangler secret put <NOMBRE>` o creá el archivo local gitignored.",
    );
    process.exit(1);
  }
  const secrets = {};
  for (const line of readFileSync(secretsFile, "utf8").split("\n")) {
    const clean = line.trim();
    if (!clean || clean.startsWith("#") || !clean.includes("=")) continue;
    const [key, ...rest] = clean.split("=");
    const value = rest.join("=").trim();
    if (key && value && !secrets[key]) secrets[key] = value;
  }
  const payload = {};
  for (const name of missing) {
    if (!secrets[name]) {
      console.error(`[deploy:safe] ${name} no está en ${secretsFile}. Agregalo antes de reintentar.`);
      process.exit(1);
    }
    payload[name] = secrets[name];
  }
  const temp = join("/tmp", `extracurriculares-secrets-${process.pid}.json`);
  writeFileSync(temp, JSON.stringify(payload), "utf8");
  try {
    console.error(`[deploy:safe] Restaurando secretos faltantes: ${missing.join(", ")}`);
    run(`npx wrangler secret bulk ${temp}`);
  } finally {
    rmSync(temp, { force: true });
  }
  const stillMissing = missingRemoteSecrets();
  if (stillMissing.length > 0) {
    console.error(`[deploy:safe] No se pudieron restaurar: ${stillMissing.join(", ")}`);
    process.exit(1);
  }
  console.error(`[deploy:safe] Secretos restaurados correctamente.`);
}

function deployedUrl(output) {
  const match = output.match(/^\s*(https:\/\/[^\s]+\.workers\.dev)\s*$/m);
  return match ? match[1] : KNOWN_URL;
}

async function smokeTest(baseUrl) {
  const healthUrl = `${baseUrl}/api/health`;
  const loginUrl = `${baseUrl}/api/auth/google`;
  const timeoutMs = 30_000;

  const fetchWithTimeout = (url, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
  };

  const healthRes = await fetchWithTimeout(healthUrl);
  const healthBody = await healthRes.json().catch(() => null);
  const secretsOk = healthBody?.checks?.secrets === "ok";
  const healthOk = healthRes.status === 200 && healthBody?.status === "ok" && healthBody?.appsheet === "connected" && secretsOk;

  // El proxy de fotos debe estar configurado: un fileId desconocido responde
  // 400/404 cuando el service account está presente, y 503 DRIVE_NOT_CONFIGURED
  // cuando falta. Cualquier status distinto de 503 = configurado.
  const photoRes = await fetchWithTimeout(`${baseUrl}/api/photos/drive/unknown-file-id-0000`);
  const photosOk = photoRes.status !== 503;

  const loginRes = await fetchWithTimeout(loginUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential: "invalid-test-token" }),
  });
  const loginBody = await loginRes.json().catch(() => null);
  // 401 = la ruta y GOOGLE_CLIENT_ID están vivos. 429 = el rate limiter (ruta viva).
  const loginOk = loginRes.status === 401 || loginRes.status === 429;

  if (!healthOk || !loginOk || !photosOk) {
    console.error(
      `[deploy:safe] SMOKE TEST FALLÓ en ${baseUrl}\n` +
        `  /api/health            -> ${healthRes.status} ${healthOk ? "ok" : JSON.stringify(healthBody)}\n` +
        `  /api/photos/drive/...  -> ${photoRes.status} ${photosOk ? "ok" : "503 DRIVE_NOT_CONFIGURED (falta GOOGLE_SERVICE_ACCOUNT_JSON)"}\n` +
        `  /api/auth/google       -> ${loginRes.status} ${loginOk ? "ok" : JSON.stringify(loginBody)}`,
    );
    return false;
  }
  console.error(
    `[deploy:safe] Smoke test OK en ${baseUrl}\n` +
      `  /api/health -> ${healthRes.status}, /api/photos/drive -> ${photoRes.status}, /api/auth/google -> ${loginRes.status}`,
  );
  return true;
}

async function main() {
  console.error("[deploy:safe] 1/4 Preflight (vars + secretos)...");
  run(`node ${join(workerDir, "scripts", "predeploy.mjs")}`);

  const missing = missingRemoteSecrets();
  if (missing.length > 0) {
    console.error("[deploy:safe] 2/4 Restaurando secretos faltantes...");
    restoreMissingSecrets(missing);
  } else {
    console.error("[deploy:safe] 2/4 Secretos presentes, no hace falta restaurar.");
  }

  console.error("[deploy:safe] 3/4 Publicando Worker...");
  const deployOutput = run("npx wrangler deploy");
  process.stdout.write(deployOutput);
  const url = deployedUrl(deployOutput);
  console.error(`[deploy:safe] URL de producción: ${url}`);

  await new Promise((resolve) => setTimeout(resolve, 3000));
  console.error("[deploy:safe] 4/4 Smoke test post-deploy...");
  const ok = await smokeTest(url);
  if (!ok) {
    console.error("[deploy:safe] Intentando rollback automático a la versión anterior...");
    try {
      const rollbackOutput = run("npx wrangler rollback");
      process.stdout.write(rollbackOutput);
      console.error("[deploy:safe] Rollback completado. La versión anterior quedó activa.");
    } catch (rollbackError) {
      console.error("[deploy:safe] El rollback también falló. Revisá el worker manualmente.", rollbackError.message);
    }
    process.exit(1);
  }
  console.error("[deploy:safe] Deploy verificado y saludable. Listo.");
}

main().catch((error) => {
  console.error("[deploy:safe] Error:", error.message);
  process.exit(1);
});