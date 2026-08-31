import "dotenv/config";
import { sql } from "../../config/db";
import {
  parseServiceAccount,
  listFolderFiles,
  type DriveFile,
} from "../../modules/novedades/googleDrive.service";

const DEFAULT_PHOTOS_FOLDER_ID = "1LvxHmcbVFJeSpnD2McK-ByN7QQddBVI4";
const PHOTOS_FOLDER_ID = process.env.GOOGLE_DRIVE_PHOTOS_FOLDER_ID || DEFAULT_PHOTOS_FOLDER_ID;
const WORKER_BASE_URL = (process.env.PHOTOS_WORKER_BASE_URL || "https://extracurriculares-api.gi-school.workers.dev").replace(/\/$/, "");
const DRY_RUN = process.argv.includes("--dry-run");

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

function codeFromName(name: string): string {
  const match = name.match(/\d{10}/);
  return match ? match[0] : name.split(".")[0].trim();
}

function isStudentPhoto(file: DriveFile): boolean {
  return file.mimeType === "image/jpeg" || file.mimeType === "image/png";
}

function photoProxyUrl(fileId: string): string {
  return `${WORKER_BASE_URL}/api/photos/drive/${encodeURIComponent(fileId)}`;
}

function newestPhotoByStudent(files: DriveFile[]): Map<string, DriveFile> {
  const byCode = new Map<string, DriveFile>();

  for (const file of files.filter(isStudentPhoto)) {
    const code = codeFromName(file.name);
    if (!code) continue;

    const current = byCode.get(code);
    const nextTime = file.modifiedTime || "";
    const currentTime = current?.modifiedTime || "";
    if (!current || nextTime > currentTime) byCode.set(code, file);
  }

  return byCode;
}

async function main() {
  const creds = parseServiceAccount(requireEnv("GOOGLE_SERVICE_ACCOUNT_JSON"));

  console.log(`[Fotos] Folder Drive: ${PHOTOS_FOLDER_ID}`);
  console.log(`[Fotos] Worker base URL: ${WORKER_BASE_URL}`);
  console.log(`[Fotos] Modo: ${DRY_RUN ? "dry-run" : "actualiza DB"}`);

  const files = await listFolderFiles(PHOTOS_FOLDER_ID, creds);
  const photos = files.filter(isStudentPhoto);
  const latestByCode = newestPhotoByStudent(files);

  const students = (await sql`SELECT "codigoEstudiante" FROM "Student"`) as unknown as Array<{ codigoEstudiante: string }>;
  const knownCodes = new Set(students.map((s) => s.codigoEstudiante));
  const matched = Array.from(latestByCode.entries()).filter(([code]) => knownCodes.has(code));
  const unmatched = Array.from(latestByCode.keys()).filter((code) => !knownCodes.has(code));

  console.log(`[Fotos] Archivos en Drive: ${files.length}`);
  console.log(`[Fotos] Imágenes: ${photos.length}`);
  console.log(`[Fotos] Estudiantes con al menos una foto: ${latestByCode.size}`);
  console.log(`[Fotos] Matches con Student: ${matched.length}`);
  console.log(`[Fotos] Sin match en Student: ${unmatched.length}`);

  if (DRY_RUN) {
    console.log("\nEjemplos:");
    for (const [code, file] of matched.slice(0, 10)) {
      console.log(`- ${code}: ${file.name} -> ${photoProxyUrl(file.id)}`);
    }
    return;
  }

  let updated = 0;
  for (const [code, file] of matched) {
    await sql`UPDATE "Student" SET "fotoUrl" = ${photoProxyUrl(file.id)}, "updatedAt" = now() WHERE "codigoEstudiante" = ${code}`;
    updated++;
    if (updated % 100 === 0) console.log(`[Fotos] ${updated} estudiantes actualizados...`);
  }

  console.log(`\n[Fotos] Listo: ${updated} estudiantes actualizados con proxy de Drive.`);
}

main().catch((e) => {
  console.error("[Fotos] Error fatal:", e.message);
  process.exit(1);
});
