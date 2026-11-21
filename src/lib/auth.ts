import { StudioSettings } from "@/types/crm";

export const ADMIN_SESSION_COOKIE = "uq_admin_session";
export const ADMIN_GUARD_COOKIE = "uq_admin_guard";
const SESSION_PAYLOAD = "uq-admin-v2";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutos

interface LoginAttemptRecord {
  count: number;
  firstFailedAt: number;
  lockedUntil: number;
}

const loginAttemptsByIp = new Map<string, LoginAttemptRecord>();

export function isAdminAuthEnabled(
  settings?: Partial<StudioSettings> | null
): boolean {
  if (process.env.CRM_ADMIN_PASSWORD?.trim()) return true;
  if (settings?.adminPasswordHash?.trim()) return true;
  return false;
}

export function getRateLimitStatus(ip: string): {
  locked: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const record = loginAttemptsByIp.get(ip);
  if (!record) {
    return {
      locked: false,
      remainingAttempts: MAX_FAILED_ATTEMPTS,
      retryAfterSeconds: 0,
    };
  }

  if (record.lockedUntil > now) {
    return {
      locked: true,
      remainingAttempts: 0,
      retryAfterSeconds: Math.ceil((record.lockedUntil - now) / 1000),
    };
  }

  if (now - record.firstFailedAt > LOCKOUT_WINDOW_MS) {
    loginAttemptsByIp.delete(ip);
    return {
      locked: false,
      remainingAttempts: MAX_FAILED_ATTEMPTS,
      retryAfterSeconds: 0,
    };
  }

  return {
    locked: false,
    remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - record.count),
    retryAfterSeconds: 0,
  };
}

export function recordFailedLoginAttempt(ip: string): {
  locked: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const current = loginAttemptsByIp.get(ip);
  if (!current || now - current.firstFailedAt > LOCKOUT_WINDOW_MS) {
    const next: LoginAttemptRecord = {
      count: 1,
      firstFailedAt: now,
      lockedUntil: 0,
    };
    loginAttemptsByIp.set(ip, next);
    return {
      locked: false,
      remainingAttempts: MAX_FAILED_ATTEMPTS - 1,
      retryAfterSeconds: 0,
    };
  }

  current.count += 1;
  if (current.count >= MAX_FAILED_ATTEMPTS) {
    current.lockedUntil = now + LOCKOUT_WINDOW_MS;
  }
  loginAttemptsByIp.set(ip, current);

  return getRateLimitStatus(ip);
}

export function clearLoginAttempts(ip: string): void {
  loginAttemptsByIp.delete(ip);
}

async function computeHmacHex(
  secret: string,
  message: string
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPasswordWithSalt(
  password: string,
  salt: string
): Promise<string> {
  return computeHmacHex(`uq-pwd-salt:${salt}`, password.trim());
}

export function generatePasswordSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getSigningSecret(): string {
  const envSecret = process.env.CRON_SECRET?.trim() || "";
  const envPassword = process.env.CRM_ADMIN_PASSWORD?.trim() || "";
  const fbKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() || "";
  return `uq-session-secret:${envSecret}:${envPassword}:${fbKey}:v2`;
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function createAdminSessionToken(
  durationHours: number = 24 * 14
): Promise<string> {
  const expiresAt = Date.now() + durationHours * 60 * 60 * 1000;
  const payload = `${SESSION_PAYLOAD}.${expiresAt}`;
  const sig = await computeHmacHex(getSigningSecret(), payload);
  return `${expiresAt}.${sig}`;
}

export async function verifyAdminSessionToken(
  token: string | undefined | null,
  settings?: Partial<StudioSettings> | null,
  forceVerify: boolean = false
): Promise<boolean> {
  if (!forceVerify && !isAdminAuthEnabled(settings)) return true;
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [expiresAtStr, providedSig] = parts;
  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    return false;
  }

  const payload = `${SESSION_PAYLOAD}.${expiresAtStr}`;
  const expectedSig = await computeHmacHex(getSigningSecret(), payload);
  return constantTimeEqual(providedSig, expectedSig);
}
