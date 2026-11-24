import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_GUARD_COOKIE,
  ADMIN_SESSION_COOKIE,
  isAdminAuthEnabled,
  verifyAdminSessionToken,
} from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const guardCookieActive = req.cookies.get(ADMIN_GUARD_COOKIE)?.value === "1";
  const authActive = isAdminAuthEnabled() || guardCookieActive;

  if (!authActive) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  // Keep client-facing proposal/portal routes, incoming webhooks, and auth endpoints accessible
  if (
    pathname.startsWith("/proposta/") ||
    pathname.startsWith("/portal/") ||
    pathname.startsWith("/api/proposals/") ||
    pathname.startsWith("/api/portal/") ||
    pathname.startsWith("/api/upload") ||
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/api/auth/")
  ) {
    return NextResponse.next();
  }

  // Allow Vercel Cron / external tick GET requests authenticated with CRON_SECRET
  if (
    (pathname === "/api/cron/followup" ||
      pathname === "/api/whatsapp/queue/tick") &&
    req.method === "GET"
  ) {
    const cronSecret = process.env.CRON_SECRET?.trim();
    const authHeader = req.headers.get("authorization");
    const tokenParam = req.nextUrl.searchParams.get("token");
    if (
      cronSecret &&
      (authHeader === `Bearer ${cronSecret}` || tokenParam === cronSecret)
    ) {
      return NextResponse.next();
    }
  }

  // Protect all private API endpoints
  if (pathname.startsWith("/api/")) {
    const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const valid = await verifyAdminSessionToken(token, null, authActive);
    if (!valid) {
      return NextResponse.json(
        { error: "Sessão administrativa necessária. Faça login no CRM." },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
