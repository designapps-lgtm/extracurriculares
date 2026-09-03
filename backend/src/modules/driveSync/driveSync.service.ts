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
  parseServiceAccount,
  watchDriveChanges,
  type DriveFile,
} from "../novedades/googleDrive.service";

const STATE_KEY = "drive-watch";
const TARGET_FILES = [
  "Extracurriculares_base.xlsx",
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

export async function syncDriveSources(): Promise<{ students: number; offerEntries: number; files: number; errors: string[] }> {
  const creds = await getCreds();
  const folderId = config.googleDriveFolderId!;
  const errors: string[] = [];
  let students = 0;
  let offerEntries = 0;
  let files = 0;

  const folderFiles = await listFolderFiles(folderId, creds);
  const targets = await findTargetFiles(folderFiles);

  for (const file of targets) {
    const normalized = normalize(file.name);
    try {
      const buffer = await downloadSpreadsheet(file, creds);

      if (normalized === normalize("Extracurriculares_base.xlsx")) {
        // Si AppSheet está configurado, los estudiantes se sincronizan desde la
        // tabla "Demograficos" y este archivo se ignora (evita pisar el sync).
        if (config.appsheetAppId && config.appsheetAccessKey) {
          continue;
        }
        const rows = readExcelBuffer(buffer);
        const { valid, errors: validationErrors } = validateRows(rows);
        if (validationErrors.length > 0) {
          errors.push(`Base: ${validationErrors[0].error}`);
        }
        const mapped = mapStudents(valid);
        const result = await importStudents(mapped, false);
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
