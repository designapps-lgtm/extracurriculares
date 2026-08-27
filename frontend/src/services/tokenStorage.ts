export type AuthRole = "admin" | "teacher";

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

const STORAGE_KEYS: Record<AuthRole, string> = {
  admin: "auth_admin_tokens",
  teacher: "auth_teacher_tokens",
};

export function saveTokens(role: AuthRole, tokens: { accessToken: string; refreshToken: string }): void {
  localStorage.setItem(STORAGE_KEYS[role], JSON.stringify(tokens));
}

export function getTokens(role: AuthRole): StoredTokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS[role]);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.accessToken || !parsed.refreshToken) return null;
    return parsed as StoredTokens;
  } catch {
    return null;
  }
}

export function getAccessToken(role: AuthRole): string | null {
  return getTokens(role)?.accessToken ?? null;
}

export function getRefreshToken(role: AuthRole): string | null {
  return getTokens(role)?.refreshToken ?? null;
}

export function clearTokens(role: AuthRole): void {
  localStorage.removeItem(STORAGE_KEYS[role]);
}

export function roleForPath(path: string): AuthRole | null {
  if (path.startsWith("/api/admin/")) return "admin";
  if (path.startsWith("/api/teacher/")) return "teacher";
  return null;
}
