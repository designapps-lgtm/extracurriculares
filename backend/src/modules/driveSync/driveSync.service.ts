import crypto from "crypto";
import { config } from "../../config";
import { nowIso } from "../../utils/colombiaTime";
import {
  getStartPageToken,
  isDriveConfigured,
  listDriveChanges,
  parseServiceAccount,
  watchDriveChanges,
} from "../novedades/googleDrive.service";
import { APPSHEET_TABLES, addRows, editRows, getTableRows, textCell } from "../appsheet/appsheet.repository";

const STATE_KEY = "drive-watch";

type DriveWatchState = {
  pageToken: string;
  channelId: string;
  resourceId: string;
  expiration: string | null;
};

async function getState(): Promise<DriveWatchState | null> {
  const row = (await getTableRows(APPSHEET_TABLES.syncState)).find((item) => textCell(item, "SyncID") === STATE_KEY || textCell(item, "Proceso") === STATE_KEY);
  if (!row) return null;
  return {
    pageToken: textCell(row, "PageToken"),
    channelId: textCell(row, "ChannelID"),
    resourceId: textCell(row, "ResourceID"),
    expiration: textCell(row, "ExpirationAt") || null,
  };
}

async function setState(value: DriveWatchState): Promise<void> {
  const existing = await getState();
  const row = {
    SyncID: STATE_KEY,
    Proceso: STATE_KEY,
    PageToken: value.pageToken,
    ChannelID: value.channelId,
    ResourceID: value.resourceId,
    ExpirationAt: value.expiration ?? "",
    LastRunAt: nowIso(),
    Estado: "activo",
    Detalles: "Google Drive watch metadata",
    UpdatedAt: nowIso(),
  };
  if (existing) await editRows(APPSHEET_TABLES.syncState, [row]);
  else await addRows(APPSHEET_TABLES.syncState, [row]);
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
