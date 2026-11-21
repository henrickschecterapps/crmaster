import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_GUARD_COOKIE,
  ADMIN_SESSION_COOKIE,
  clearLoginAttempts,
  constantTimeEqual,
  createAdminSessionToken,
  getRateLimitStatus,
  hashPasswordWithSalt,
  isAdminAuthEnabled,
  recordFailedLoginAttempt,
} from "@/lib/auth";
import { getStoreData } from "@/lib/repository";

export const dynamic = "force-dynamic";

function extractClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "127.0.0.1";
}

export async function POST(req: NextRequest) {
  const ip = extractClientIp(req);
  const rateLimit = getRateLimitStatus(ip);

  if (rateLimit.locked) {
    const minutes = Math.ceil(rateLimit.retryAfterSeconds / 60);
    return NextResponse.json(
      {
        error: `Muitas tentativas incorretas. Acesso temporariamente bloqueado por ${minutes} min (${rateLimit.retryAfterSeconds}s).`,
        locked: true,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      { status: 429 }
    );
  }

  const store = await getStoreData();
  const settings = store.settings;

  if (!isAdminAuthEnabled(settings)) {
    return NextResponse.json({ authenticated: true, authEnabled: false });
  }

  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    rememberMe?: boolean;
  };

  const providedPassword = (body.password || "").trim();
  const providedEmail = (body.email || "").trim().toLowerCase();

  if (!providedPassword) {
    return NextResponse.json(
      { error: "Informe a senha administrativa para continuar." },
      { status: 400 }
    );
  }

  // Optional email check when user fills the email field and adminEmail is set
  const expectedEmail = (settings.adminEmail || "").trim().toLowerCase();
  if (providedEmail && expectedEmail && providedEmail !== expectedEmail) {
    const failed = recordFailedLoginAttempt(ip);
    return NextResponse.json(
      {
        error: failed.locked
          ? "Limite de 5 tentativas excedido. Bloqueado por 15 minutos."
          : `Credenciais inválidas. Tentativas restantes: ${failed.remainingAttempts}.`,
        remainingAttempts: failed.remainingAttempts,
        locked: failed.locked,
      },
      { status: 401 }
    );
  }

  let passwordMatch = false;

  // 1. Check custom hashed password stored in Firestore/StudioSettings
  if (settings.adminPasswordHash && settings.adminPasswordSalt) {
    const computedHash = await hashPasswordWithSalt(
      providedPassword,
      settings.adminPasswordSalt
    );
    if (constantTimeEqual(computedHash, settings.adminPasswordHash)) {
      passwordMatch = true;
    }
  }

  // 2. Check environment variable master password (CRM_ADMIN_PASSWORD)
  const envPassword = process.env.CRM_ADMIN_PASSWORD?.trim() || "";
  if (!passwordMatch && envPassword) {
    if (constantTimeEqual(providedPassword, envPassword)) {
      passwordMatch = true;
    }
  }

  if (!passwordMatch) {
    const failed = recordFailedLoginAttempt(ip);
    return NextResponse.json(
      {
        error: failed.locked
          ? "Limite de 5 tentativas excedido. Acesso bloqueado por 15 minutos."
          : `Senha incorreta. Tentativas restantes antes do bloqueio: ${failed.remainingAttempts}.`,
        remainingAttempts: failed.remainingAttempts,
        locked: failed.locked,
      },
      { status: 401 }
    );
  }

  clearLoginAttempts(ip);

  const rememberMe = body.rememberMe !== false;
  const durationHours = rememberMe ? 24 * 14 : 12; // 14 dias ou 12 horas
  const token = await createAdminSessionToken(durationHours);

  const res = NextResponse.json({
    authenticated: true,
    authEnabled: true,
    expiresInHours: durationHours,
  });

  res.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: durationHours * 60 * 60,
  });

  res.cookies.set(ADMIN_GUARD_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return res;
}
