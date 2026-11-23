import { NextRequest, NextResponse } from "next/server";
import { updateSettings } from "@/lib/repository";
import { getIntegrationStatus } from "@/lib/supabase";
import { requireAdminApiAuth } from "@/lib/apiGuard";
import { StudioSettings } from "@/types/crm";
import {
  ADMIN_GUARD_COOKIE,
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  generatePasswordSalt,
  hashPasswordWithSalt,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  const authErr = await requireAdminApiAuth(req);
  if (authErr) return authErr;
  try {
    const body = (await req.json()) as Partial<StudioSettings> & {
      newAdminPassword?: string;
      clearAdminPassword?: boolean;
    };

    const patch: Partial<StudioSettings> = { ...body };
    delete (patch as Record<string, unknown>).newAdminPassword;
    delete (patch as Record<string, unknown>).clearAdminPassword;

    let shouldIssueSessionCookie = false;

    if (body.clearAdminPassword) {
      patch.adminPasswordHash = "";
      patch.adminPasswordSalt = "";
    } else if (body.newAdminPassword && body.newAdminPassword.trim().length >= 4) {
      const salt = generatePasswordSalt();
      const hash = await hashPasswordWithSalt(body.newAdminPassword.trim(), salt);
      patch.adminPasswordSalt = salt;
      patch.adminPasswordHash = hash;
      shouldIssueSessionCookie = true;
    }

    const settings = await updateSettings(patch);
    const status = getIntegrationStatus(settings);
    const res = NextResponse.json({ settings, status });

    if (body.clearAdminPassword) {
      res.cookies.set(ADMIN_GUARD_COOKIE, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0,
      });
    } else if (shouldIssueSessionCookie) {
      const token = await createAdminSessionToken(24 * 14);
      res.cookies.set(ADMIN_SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 14,
      });
      res.cookies.set(ADMIN_GUARD_COOKIE, "1", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }

    return res;
  } catch {
    return NextResponse.json(
      { error: "Erro ao atualizar configurações." },
      { status: 500 }
    );
  }
}
