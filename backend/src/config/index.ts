import dotenv from "dotenv";

dotenv.config();

// En Cloudflare Workers, workerd fija process.env.NODE_ENV en "development" de
// forma inmutable (no se puede cambiar). Como este Worker ES el de producción,
// detectamos el runtime edge y usamos "production" directamente.
//
// OJO: no usar `typeof WebSocket !== "undefined"` para detectar Workers: desde
// Node 22 WebSocket es un global nativo y el backend normal queda marcado como
// edge, forzando NODE_ENV=production y rompiendo el arranque en desarrollo.
// `caches` (CacheStorage) sí es exclusivo de Workers en este stack.
const isWorkersRuntime = "caches" in globalThis;

const nodeEnv = isWorkersRuntime ? "production" : process.env.NODE_ENV || "development";

if (nodeEnv === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET es obligatorio en producción");
}

if (!process.env.JWT_SECRET && nodeEnv !== "production") {
  console.warn("[config] JWT_SECRET no definido — usando secret de desarrollo");
}

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  nodeEnv,
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-in-production",
  accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m",
  sessionDurationHours: parseInt(process.env.SESSION_DURATION_HOURS || "168", 10),
  googleServiceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || null,
  googleDriveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || null,
  googleDriveWebhookUrl: process.env.GOOGLE_DRIVE_WEBHOOK_URL || null,
  googleDriveWebhookToken: process.env.GOOGLE_DRIVE_WEBHOOK_TOKEN || null,
  appsheetWebhookToken: process.env.APPSHEET_WEBHOOK_TOKEN || null,
  appsheetAppId: process.env.APPSHEET_APP_ID || null,
  appsheetAccessKey: process.env.APPSHEET_APPLICATION_ACCESS_KEY || null,
  appsheetDemograficosTable: process.env.APPSHEET_DEMOGRAFICOS_TABLE || "Demograficos",
  // La fuente primaria de estudiantes es el Excel de Drive. AppSheet queda
  // como respaldo si Drive no está configurado o el archivo no llega.
  studentsSyncSource: process.env.STUDENTS_SYNC_SOURCE?.toLowerCase() === "appsheet" ? "appsheet" : "drive",
  novedadesSyncMinutes: parseInt(process.env.NOVEDADES_SYNC_MINUTES || "10", 10),
  googleClientId: process.env.GOOGLE_CLIENT_ID || null,
  googleInstitutionDomain: process.env.GOOGLE_INSTITUTION_DOMAIN || "gi.edu.co",
};

export { nodeEnv };
