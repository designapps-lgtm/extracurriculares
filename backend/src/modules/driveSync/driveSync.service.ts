import crypto from "crypto";
import { sql, first } from "../../config/db";
import { config } from "../../config";
import { validateRows } from "../../import/excel/excelValidator";
import { mapStudents } from "../../import/excel/excelMapper";
import { importStudents } from "../../import/excel/studentImporter";
import { readExcelBuffer } from "../../import/excel/excelReader";
import { parseOfferWorkbook } from "../../import/excel/offerWorkbook";
import { syncOfferEntries } from "../../import/excel/offerImporter";
import {
  downloadSpreadsheet,
  getStartPageToken,
  isDriveConfigured,
  listDriveChanges,
  listFolderFiles,
  findDriveFilesByName,
  parseServiceAccount,
  watchDriveChanges,
  type DriveFile,
} from "../novedades/googleDrive.service";

const STATE_KEY = "drive-watch";
const TARGET_FILES = [
  "Extracurriculares_base.xlsx",
  // Google Sheet real conectado a AppSheet en producción.
  "BAESE_QR_PLACAS",
  "DEMOGRAFICOS 2026-2027",
  "Horario por sección extracurricular.xlsx",
  "Horario por seccion extracurricular.xlsx",
];

type DriveWatchState = {
  pageToken: string;
  channelId: string;
  resourceId: string;
  expiration: string | null;
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function isStudentSourceFile(fileName: string): boolean {
  return [
    "Extracurriculares_base.xlsx",
    "BAESE_QR_PLACAS",
    "DEMOGRAFICOS 2026-2027",
    config.googleDriveStudentsFileName,
  ].some((name) => normalize(name) === normalize(fileName));
}

function studentSourceSheet(fileName: string): string {
  return ["BAESE_QR_PLACAS", "DEMOGRAFICOS 2026-2027", config.googleDriveStudentsFileName]
    .some((name) => normalize(name) === normalize(fileName))
    ? "Base_Demo"
    : "Base";
}

function readStudentSource(buffer: Buffer, fileName: string) {
  const preferredSheet = studentSourceSheet(fileName);
  try {
    return readExcelBuffer(buffer, preferredSheet);
  } catch (error) {
    if (preferredSheet !== "Base") return readExcelBuffer(buffer, "Base");
    throw error;
  }
}

async function ensureStateTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS "DriveSyncState" (
      "key" text PRIMARY KEY,
      "value" jsonb NOT NULL,
      "updatedAt" timestamp NOT NULL DEFAULT now()
    )
  `;
}

async function getState(): Promise<DriveWatchState | null> {
  await ensureStateTable();
  const row = await first<{ value: DriveWatchState }>(
    await sql`SELECT "value" FROM "DriveSyncState" WHERE "key" = ${STATE_KEY} LIMIT 1` as unknown as { value: DriveWatchState }[]
  );
  return row?.value ?? null;
}

async function setState(value: DriveWatchState): Promise<void> {
  await ensureStateTable();
  await sql`
    INSERT INTO "DriveSyncState" ("key", "value", "updatedAt")
    VALUES (${STATE_KEY}, ${JSON.stringify(value)}::jsonb, now())
    ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = now()
  `;
}

function callbackUrl(): string {
  if (!config.googleDriveWebhookUrl) {
    throw new Error("GOOGLE_DRIVE_WEBHOOK_URL es obligatorio para habilitar el webhook de Drive");
  }
  return config.googleDriveWebhookUrl;
}

function webhookToken(): string {
  if (!config.googleDriveWebhookToken) {
    throw new Error("GOOGLE_DRIVE_WEBHOOK_TOKEN es obligatorio para validar el webhook de Drive");
  }
  return config.googleDriveWebhookToken;
}

async function getCreds() {
  if (!isDriveConfigured(config.googleServiceAccountJson || "", config.googleDriveFolderId || "")) {
    throw new Error("Drive no configurado: faltan GOOGLE_SERVICE_ACCOUNT_JSON o GOOGLE_DRIVE_FOLDER_ID");
  }
  return parseServiceAccount(config.googleServiceAccountJson!);
}

async function findTargetFiles(files: DriveFile[]): Promise<DriveFile[]> {
  const targets = new Map<string, DriveFile>();
  for (const file of files) {
    const key = normalize(file.name);
    if (TARGET_FILES.some((target) => normalize(target) === key)) {
      targets.set(key, file);
    }
  }
  return [...targets.values()];
}

export async function syncDriveSources(options: { syncStudents?: boolean } = {}): Promise<{ students: number; offerEntries: number; files: number; errors: string[] }> {
  const creds = await getCreds();
  const folderId = config.googleDriveFolderId!;
  const errors: string[] = [];
  let students = 0;
  let offerEntries = 0;
  let files = 0;
  const shouldSyncStudents = options.syncStudents ?? (config.studentsSyncSource === "drive" || !(config.appsheetAppId && config.appsheetAccessKey));

  const folderFiles = await listFolderFiles(folderId, creds);
  let targets = await findTargetFiles(folderFiles);
  const configuredStudentName = normalize(config.googleDriveStudentsFileName);
  let hasConfiguredStudentFile = targets.some((file) => normalize(file.name) === configuredStudentName);
  if (!hasConfiguredStudentFile) {
    const remoteStudentFiles = await findDriveFilesByName(config.googleDriveStudentsFileName, creds);
    for (const file of remoteStudentFiles) {
      if (!targets.some((target) => target.id === file.id)) targets.push(file);
    }
    hasConfiguredStudentFile = remoteStudentFiles.length > 0;
  }
  // Si el archivo configurado existe, tiene prioridad sobre nombres antiguos
  // o alternativos que puedan seguir en la misma carpeta.
  if (hasConfiguredStudentFile) {
    targets = targets.filter((file) => !isStudentSourceFile(file.name) || normalize(file.name) === configuredStudentName);
  }

  for (const file of targets) {
    const normalized = normalize(file.name);
    const isStudentFile = isStudentSourceFile(file.name);
    try {
      // No descargar el archivo de estudiantes cuando AppSheet terminó
      // correctamente y está configurado como fuente primaria alternativa.
      if (isStudentFile && !shouldSyncStudents) {
        continue;
      }

      const buffer = await downloadSpreadsheet(file, creds);

      if (isStudentFile) {
        // BAESE_QR_PLACAS es un Google Sheet y la información demográfica
        // actualizada está en Base_Demo; el archivo histórico usa Base.
        const rows = readStudentSource(buffer, file.name);
        if (rows.length === 0) {
          errors.push("Base: no se encontraron filas con BARCODE; no se aplicó ningún cambio");
          continue;
        }
        const { valid, errors: validationErrors } = validateRows(rows);
        if (validationErrors.length > 0) {
          errors.push(`Base: ${validationErrors.slice(0, 5).map((e) => e.error).join(" | ")}`);
        }
        if (valid.length === 0) {
          errors.push("Base: ninguna fila pasó la validación; no se aplicó ningún cambio");
          continue;
        }
        const mapped = mapStudents(valid);
        const result = await importStudents(mapped, false, {
          // No se desactivan ausentes desde una respuesta que puede estar
          // truncada; la baja debe llegar como estado explícito del origen.
          deactivateAbsent: false,
        });
        students += result.processed;
        files += 1;
      }

      if (normalized === normalize("Horario por sección extracurricular.xlsx") || normalized === normalize("Horario por seccion extracurricular.xlsx")) {
        const entries = parseOfferWorkbook(buffer);
        const result = await syncOfferEntries(entries, false);
        offerEntries += result.entries;
        files += 1;
      }
    } catch (e: any) {
      errors.push(`${file.name}: ${e?.message || e}`);
    }
  }

  return { students, offerEntries, files, errors };
}

export async function ensureDriveWatch(): Promise<{ ok: boolean; renewed: boolean; reason?: string }> {
  const creds = await getCreds();
  const current = await getState();
  const now = Date.now();
  if (current && current.expiration && new Date(current.expiration).getTime() - now > 10 * 60 * 1000) {
    return { ok: true, renewed: false };
  }

  const startPageToken = await getStartPageToken(creds);
  const channelId = `drive-watch-${crypto.randomUUID()}`;
  const watch = await watchDriveChanges({
    pageToken: startPageToken,
    callbackUrl: callbackUrl(),
    channelId,
    token: webhookToken(),
    creds,
  });

  await setState({
    pageToken: startPageToken,
    channelId,
    resourceId: watch.resourceId,
    expiration: watch.expiration || null,
  });

  return { ok: true, renewed: true };
}

export async function handleDriveWebhook(headers: Headers): Promise<boolean> {
  const token = headers.get("x-goog-channel-token") || headers.get("X-Goog-Channel-Token") || "";
  return token === webhookToken();
}

export async function consumeDriveNotifications(headers: Headers): Promise<{ changed: boolean; reason?: string }> {
  const current = await getState();
  if (!current) return { changed: false, reason: "no-state" };

  const channelId = headers.get("x-goog-channel-id") || "";
  const resourceId = headers.get("x-goog-resource-id") || "";
  if (channelId && channelId !== current.channelId) return { changed: false, reason: "channel-mismatch" };
  if (resourceId && resourceId !== current.resourceId) return { changed: false, reason: "resource-mismatch" };

  const creds = await getCreds();
  const pageToken = current.pageToken;
  let nextToken = pageToken;
  let changed = false;

  for (;;) {
    const page = await listDriveChanges(nextToken, creds);
    if ((page.changes || []).length > 0) {
      changed = true;
    }
    if (page.newStartPageToken) {
      nextToken = page.newStartPageToken;
    }
    if (!page.nextPageToken) {
      break;
    }
    nextToken = page.nextPageToken;
  }

  if (changed) {
    await setState({ ...current, pageToken: nextToken });
  }

  return { changed };
}
