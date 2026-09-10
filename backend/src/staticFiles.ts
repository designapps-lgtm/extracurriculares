import fs from "fs";
import path from "path";

/**
 * Build del frontend servido por Express (deploy single-origin).
 * Resolución: FRONTEND_DIST si está definido, si no "../frontend/dist"
 * relativo a backend/src (ts-node) o backend/dist (build). En ambos casos
 * subir dos niveles llega a la raíz del repo.
 */
export function frontendDistDir(): string {
  if (process.env.FRONTEND_DIST) return path.resolve(process.env.FRONTEND_DIST);
  return path.resolve(__dirname, "..", "..", "frontend", "dist");
}

export function hasFrontendBuild(): boolean {
  return fs.existsSync(path.join(frontendDistDir(), "index.html"));
}