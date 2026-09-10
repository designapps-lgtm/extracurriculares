import dotenv from "dotenv";

dotenv.config();

const nodeEnv = process.env.NODE_ENV || "development";

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
  // Sin barra final: el header Origin nunca la trae y la comparación debe ser exacta.
  frontendUrl: (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, ""),
  nodeEnv,
  get jwtSecret() {
    return requireProductionSecret("JWT_SECRET", process.env.JWT_SECRET);
  },
  accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m",
  sessionDurationHours: parseInt(process.env.SESSION_DURATION_HOURS || "168", 10),
  googleServiceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || null,
  googleDriveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || null,
  googleDriveWebhookUrl: process.env.GOOGLE_DRIVE_WEBHOOK_URL || null,
  googleDriveWebhookToken: process.env.GOOGLE_DRIVE_WEBHOOK_TOKEN || null,
  appsheetNovedadesAppId: process.env.APPSHEET_NOVEDADES_APP_ID || null,
  appsheetNovedadesAccessKey: process.env.APPSHEET_NOVEDADES_APPLICATION_ACCESS_KEY || null,
  appsheetNovedadesTable: process.env.APPSHEET_NOVEDADES_TABLE || null,
  googleClientId: process.env.GOOGLE_CLIENT_ID || null,
  googleInstitutionDomain: process.env.GOOGLE_INSTITUTION_DOMAIN || "gi.edu.co",
  db: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "app",
    password: process.env.DB_PASSWORD || "app-local-dev",
    database: process.env.DB_NAME || "extracurriculares",
    // En dev solo: el pool creado al boot no debe tirar abajo el server si la
    // DB aún no está levantada; las queries fallan puntualmente recién cuando
    // se usan.
    connectTimeoutMS: parseInt(process.env.DB_CONNECT_TIMEOUT_MS || "5000", 10),
  },
};

export { nodeEnv };
