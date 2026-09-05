import dotenv from "dotenv";

dotenv.config();

// In Cloudflare Workers, workerd may expose NODE_ENV differently during module
// validation. `caches` is a reliable signal for this runtime in this stack.
const isWorkersRuntime = "caches" in globalThis;

const nodeEnv = isWorkersRuntime ? "production" : process.env.NODE_ENV || "development";

if (!process.env.JWT_SECRET && nodeEnv !== "production") {
  console.warn("[config] JWT_SECRET no definido; usando secret de desarrollo");
}

function requireProductionSecret(name: string, value: string | undefined): string {
  if (nodeEnv === "production" && !value) {
    throw new Error(`${name} es obligatorio en produccion`);
  }
  return value || "dev-secret-change-in-production";
}

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  nodeEnv,
  get jwtSecret() {
    return requireProductionSecret("JWT_SECRET", process.env.JWT_SECRET);
  },
  accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m",
  sessionDurationHours: parseInt(process.env.SESSION_DURATION_HOURS || "168", 10),
  googleServiceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || null,
  googleDriveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || null,
  googleDriveOfferFileNames: (process.env.GOOGLE_DRIVE_OFFER_FILE_NAMES || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean),
  googleDriveWebhookUrl: process.env.GOOGLE_DRIVE_WEBHOOK_URL || null,
  googleDriveWebhookToken: process.env.GOOGLE_DRIVE_WEBHOOK_TOKEN || null,
  appsheetWebhookToken: process.env.APPSHEET_WEBHOOK_TOKEN || null,
  appsheetAppId: process.env.APPSHEET_APP_ID || null,
  appsheetAccessKey: process.env.APPSHEET_APPLICATION_ACCESS_KEY || null,
  appsheetDemograficosTable: process.env.APPSHEET_DEMOGRAFICOS_TABLE || "Demograficos",
  appsheetNovedadesTable: process.env.APPSHEET_NOVEDADES_TABLE || "Novedades_Diarias",
  // Estudiantes, inscripciones y novedades diarias se leen desde AppSheet.
  // Google Drive solo queda para oferta/horarios si se configura explicitamente.
  novedadesSyncMinutes: parseInt(process.env.NOVEDADES_SYNC_MINUTES || "10", 10),
  googleClientId: process.env.GOOGLE_CLIENT_ID || null,
  googleInstitutionDomain: process.env.GOOGLE_INSTITUTION_DOMAIN || "gi.edu.co",
};

export { nodeEnv };
