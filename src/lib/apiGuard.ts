import { NextRequest, NextResponse } from "next/server";
import { getSettingsOnly } from "@/lib/repository";
import {
  ADMIN_SESSION_COOKIE,
  isAdminAuthEnabled,
  verifyAdminSessionToken,
} from "@/lib/auth";

/**
 * Verifies admin session against both ENV (CRM_ADMIN_PASSWORD) and Firestore-stored adminPasswordHash.
 * Uses single-document getSettingsOnly() to avoid scanning all leads on every API request.
 */
export async function requireAdminApiAuth(
  req: NextRequest
): Promise<NextResponse | null> {
  const settings = await getSettingsOnly();
  if (!isAdminAuthEnabled(settings)) {
    return null;
  }
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const valid = await verifyAdminSessionToken(token, settings);
  if (!valid) {
    return NextResponse.json(
      { error: "Sessão administrativa necessária. Faça login no CRM." },
      { status: 401 }
    );
  }
  return null;
}
