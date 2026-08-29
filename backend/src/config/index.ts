import dotenv from "dotenv";

dotenv.config();

const nodeEnv = process.env.NODE_ENV || "development";

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
  refreshTokenExpiresInDays: parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS || "7", 10),
  googleServiceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || null,
  googleDriveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || null,
  novedadesSyncMinutes: parseInt(process.env.NOVEDADES_SYNC_MINUTES || "10", 10),
};

export { nodeEnv };
