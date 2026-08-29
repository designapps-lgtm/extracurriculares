import jwt from "jsonwebtoken";

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  token_uri: string;
}

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";

let cachedToken: { value: string; expiresAt: number } | null = null;

export function parseServiceAccount(raw: string): ServiceAccountCredentials {
  const jsonish = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf-8");
  const creds = JSON.parse(jsonish) as ServiceAccountCredentials;
  if (!creds.client_email || !creds.private_key) {
    throw new Error("Service account inválida: faltan client_email o private_key");
  }
  return creds;
}

export function isDriveConfigured(credJson: string, folderId: string): boolean {
  return Boolean(credJson?.trim() && folderId?.trim());
}

async function getAccessToken(creds: ServiceAccountCredentials): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: creds.client_email,
      scope: DRIVE_SCOPE,
      aud: creds.token_uri || "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    },
    creds.private_key,
    { algorithm: "RS256" }
  );

  const tokenRes = await fetch(creds.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`No se pudo obtener token de Google: ${tokenRes.status} ${text}`);
  }

  const data = (await tokenRes.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("Respuesta de Google sin access_token");

  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };

  return cachedToken.value;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

async function request<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Drive API error ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export async function listFolderFiles(folderId: string, creds: ServiceAccountCredentials): Promise<DriveFile[]> {
  const token = await getAccessToken(creds);
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const url = `${DRIVE_FILES_URL}?q=${q}&fields=files(id,name,mimeType)&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const data = await request<{ files: DriveFile[] }>(url, token);
  return data.files || [];
}

export async function downloadFile(fileId: string, creds: ServiceAccountCredentials): Promise<Buffer> {
  const token = await getAccessToken(creds);
  const res = await fetch(`${DRIVE_FILES_URL}/${fileId}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`No se pudo descargar el archivo ${fileId}: ${res.status} ${text}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

export async function getDriveFileMetadata(fileId: string, creds: ServiceAccountCredentials): Promise<DriveFile | null> {
  const token = await getAccessToken(creds);
  const data = await request<DriveFile>(`${DRIVE_FILES_URL}/${fileId}?fields=id,name,mimeType&supportsAllDrives=true`, token);
  return data || null;
}

export const getDriveToken = getAccessToken;

// Descarga un .xlsx (alt=media) o exporta un Google Sheet nativo a xlsx.
export async function downloadSpreadsheet(file: DriveFile, creds: ServiceAccountCredentials): Promise<Buffer> {
  const token = await getAccessToken(creds);
  const url =
    file.mimeType === "application/vnd.google-apps.spreadsheet"
      ? `${DRIVE_FILES_URL}/${file.id}/export?mimeType=application%2Fvnd.openxmlformats-officedocument.spreadsheetml.sheet&supportsAllDrives=true`
      : `${DRIVE_FILES_URL}/${file.id}?alt=media&supportsAllDrives=true`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`No se pudo descargar/exportar ${file.name}: ${res.status} ${text}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

export function resetDriveTokenForTest(): void {
  cachedToken = null;
}