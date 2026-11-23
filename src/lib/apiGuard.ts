import { NextRequest, NextResponse } from "next/server";
import { getStoreData } from "@/lib/repository";
import {
  ADMIN_SESSION_COOKIE,
  isAdminAuthEnabled,
  verifyAdminSessionToken,
} from "@/lib/auth";

/**
 * Verifies admin session against both ENV (CRM_ADMIN_PASSWORD) and Firestore-stored adminPasswordHash.
 * Returns a 401 NextResponse if unauthorized, or null if authorized.
 */
export async function requireAdminApiAuth(
  req: NextRequest
): Promise<NextResponse | null> {
  const store = await getStoreData();
  if (!isAdminAuthEnabled(store.settings)) {
    return null;
  }
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const valid = await verifyAdminSessionToken(token, store.settings);
  if (!valid) {
    return NextResponse.json(
      { error: "Sessão administrativa necessária. Faça login no CRM." },
      { status: 401 }
    );
  }
  return null;
}
