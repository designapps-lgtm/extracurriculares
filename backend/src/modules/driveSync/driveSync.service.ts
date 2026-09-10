import crypto from "crypto";
import { config } from "../../config";
import { nowIso } from "../../utils/colombiaTime";
import { isoToMysql, mysqlToIsoUtc } from "../../db/dates";
import { execute, queryOne } from "../../db/mysql";
import {
  getStartPageToken,
  isDriveConfigured,
  listDriveChanges,
  parseServiceAccount,
  watchDriveChanges,
} from "../novedades/googleDrive.service";

const STATE_KEY = "drive-watch";

type DriveWatchState = {
  pageToken: string;
  channelId: string;
  resourceId: string;
  expiration: string | null;
};

interface SyncStateRow {
  sync_id: string;
  proceso: string | null;
  page_token: string | null;
  channel_id: string | null;
  resource_id: string | null;
  expiration_at: string | null;
  last_run_at: string | null;
  estado: string | null;
  detalles: string | null;
  updated_at: string | null;
}

async function getState(): Promise<DriveWatchState | null> {
  const row = await queryOne<SyncStateRow>(
    "SELECT * FROM sync_state WHERE sync_id = ? OR proceso = ? LIMIT 1",
    [STATE_KEY, STATE_KEY],
  );
  if (!row) return null;
  return {
    pageToken: row.page_token ?? "",
    channelId: row.channel_id ?? "",
    resourceId: row.resource_id ?? "",
    expiration: row.expiration_at ? mysqlToIsoUtc(row.expiration_at) : null,
  };
}

async function setState(value: DriveWatchState): Promise<void> {
  await execute(
    `INSERT INTO sync_state (sync_id, proceso, page_token, channel_id, resource_id, expiration_at, last_run_at, estado, detalles, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'activo', 'Google Drive watch metadata', ?)
     ON DUPLICATE KEY UPDATE
       proceso = VALUES(proceso),
       page_token = VALUES(page_token),
       channel_id = VALUES(channel_id),
       resource_id = VALUES(resource_id),
       expiration_at = VALUES(expiration_at),
       last_run_at = VALUES(last_run_at),
       estado = VALUES(estado),
       detalles = VALUES(detalles),
       updated_at = VALUES(updated_at)`,
    [
      STATE_KEY,
      STATE_KEY,
      value.pageToken,
      value.channelId,
      value.resourceId,
      value.expiration ? isoToMysql(value.expiration) : null,
      isoToMysql(nowIso()),
      isoToMysql(nowIso()),
    ],
  );
}

function callbackUrl(): string {
  if (!config.googleDriveWebhookUrl) throw new Error("GOOGLE_DRIVE_WEBHOOK_URL es obligatorio para habilitar el webhook de Drive");
  return config.googleDriveWebhookUrl;
}

function webhookToken(): string {
  if (!config.googleDriveWebhookToken) throw new Error("GOOGLE_DRIVE_WEBHOOK_TOKEN es obligatorio para validar el webhook de Drive");
  return config.googleDriveWebhookToken;
}

async function getCreds() {
  if (!isDriveConfigured(config.googleServiceAccountJson || "", config.googleDriveFolderId || "")) {
    throw new Error("Drive no configurado: faltan GOOGLE_SERVICE_ACCOUNT_JSON o GOOGLE_DRIVE_FOLDER_ID");
  }
  return parseServiceAccount(config.googleServiceAccountJson!);
}

/** La oferta ya vive en AppSheet; Drive no replica ni modifica tablas. */
export async function syncDriveSources(): Promise<{ offerEntries: number; files: number; errors: string[] }> {
  return { offerEntries: 0, files: 0, errors: [] };
}

export async function ensureDriveWatch(): Promise<{ ok: boolean; renewed: boolean; reason?: string }> {
  const creds = await getCreds();
  const current = await getState();
  if (current?.expiration && new Date(current.expiration).getTime() - Date.now() > 10 * 60 * 1000) return { ok: true, renewed: false };
  const pageToken = await getStartPageToken(creds);
  const channelId = `drive-watch-${crypto.randomUUID()}`;
  const watch = await watchDriveChanges({ pageToken, callbackUrl: callbackUrl(), channelId, token: webhookToken(), creds });
  await setState({ pageToken, channelId, resourceId: watch.resourceId, expiration: watch.expiration || null });
  return { ok: true, renewed: true };
}

export async function handleDriveWebhook(headers: Headers): Promise<boolean> {
  return (headers.get("x-goog-channel-token") || headers.get("X-Goog-Channel-Token") || "") === webhookToken();
}

export async function consumeDriveNotifications(headers: Headers): Promise<{ changed: boolean; reason?: string }> {
  const current = await getState();
  if (!current) return { changed: false, reason: "no-state" };
  if (headers.get("x-goog-channel-id") && headers.get("x-goog-channel-id") !== current.channelId) return { changed: false, reason: "channel-mismatch" };
  if (headers.get("x-goog-resource-id") && headers.get("x-goog-resource-id") !== current.resourceId) return { changed: false, reason: "resource-mismatch" };
  const creds = await getCreds();
  let token = current.pageToken;
  let changed = false;
  for (;;) {
    const page = await listDriveChanges(token, creds);
    if ((page.changes || []).length) changed = true;
    if (page.newStartPageToken) token = page.newStartPageToken;
    if (!page.nextPageToken) break;
    token = page.nextPageToken;
  }
  if (changed) await setState({ ...current, pageToken: token });
  return { changed };
}
