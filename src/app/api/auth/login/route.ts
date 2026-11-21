import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  isAdminAuthEnabled,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isAdminAuthEnabled()) {
    return NextResponse.json({ authenticated: true, authEnabled: false });
  }

  const body = (await req.json().catch(() => ({}))) as { password?: string };
  const expected = process.env.CRM_ADMIN_PASSWORD?.trim() || "";

  if (!body.password || body.password.trim() !== expected) {
    return NextResponse.json(
      { error: "Senha incorreta. Tente novamente." },
      { status: 401 }
    );
  }

  const token = await createAdminSessionToken();
  const res = NextResponse.json({ authenticated: true, authEnabled: true });

  res.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14, // 14 dias
  });

  return res;
}
