import { Request, Response } from "express";
import { consumeDriveNotifications, ensureDriveWatch, handleDriveWebhook, syncDriveSources } from "./driveSync.service";

function toHeaders(req: Request): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else if (typeof value === "string") {
      headers.set(key, value);
    }
  }
  return headers;
}

export async function webhook(req: Request, res: Response): Promise<void> {
  const headers = toHeaders(req);
  const ok = await handleDriveWebhook(headers);
  if (!ok) {
    res.status(401).json({ success: false, error: { code: "INVALID_WEBHOOK", message: "Webhook inválido" } });
    return;
  }

  try {
    const notification = await consumeDriveNotifications(headers);
    if (notification.reason === "no-state") {
      await ensureDriveWatch();
    }
  } catch (e) {
    console.error("[Drive] Error consumiendo notificación:", e);
    await ensureDriveWatch().catch(() => undefined);
  }

  const result = await syncDriveSources();
  res.json({ success: true, data: result });
}

export async function bootstrap(req: Request, res: Response): Promise<void> {
  const headers = toHeaders(req);
  const ok = await handleDriveWebhook(headers);
  if (!ok) {
    res.status(401).json({ success: false, error: { code: "INVALID_WEBHOOK", message: "Webhook inválido" } });
    return;
  }

  const result = await ensureDriveWatch();
  res.json({ success: true, data: result });
}

export async function syncNow(req: Request, res: Response): Promise<void> {
  const headers = toHeaders(req);
  const ok = await handleDriveWebhook(headers);
  if (!ok) {
    res.status(401).json({ success: false, error: { code: "INVALID_WEBHOOK", message: "Webhook inválido" } });
    return;
  }

  const result = await syncDriveSources();
  res.json({ success: true, data: result });
}
