export const ADMIN_SESSION_COOKIE = "uq_admin_session";
const SESSION_PAYLOAD = "uq-admin-v1";

export function isAdminAuthEnabled(): boolean {
  return Boolean(process.env.CRM_ADMIN_PASSWORD?.trim());
}

async function computeHmacHex(secret: string, message: string): Promise<string> {
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

export async function createAdminSessionToken(): Promise<string> {
  const password = process.env.CRM_ADMIN_PASSWORD?.trim() || "";
  const secret = process.env.CRON_SECRET?.trim() || "uq-crm-fallback-salt";
  return computeHmacHex(`${secret}:${password}`, SESSION_PAYLOAD);
}

export async function verifyAdminSessionToken(
  token: string | undefined | null
): Promise<boolean> {
  if (!isAdminAuthEnabled()) return true;
  if (!token) return false;
  const expected = await createAdminSessionToken();
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) {
    diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
