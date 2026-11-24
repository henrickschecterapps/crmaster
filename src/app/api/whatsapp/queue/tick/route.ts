import { NextRequest, NextResponse } from "next/server";
import { getSettingsOnly } from "@/lib/repository";
import { requireAdminApiAuth } from "@/lib/apiGuard";
import { isWithinBusinessHours } from "@/lib/automationHelpers";
import {
  processDueWhatsappQueue,
  resolveWhatsappConfig,
} from "@/lib/whatsappQueue";
import { DEFAULT_AUTOMATION_SETTINGS } from "@/types/crm";

export const dynamic = "force-dynamic";

/**
 * Lightweight endpoint meant to be pinged every 5 minutes (e.g., via cron-job.org or GitHub Actions)
 * with `Authorization: Bearer <CRON_SECRET>` to drain at most 1 due WhatsApp job per tick inside business hours.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = req.headers.get("authorization");
  const tokenParam = req.nextUrl.searchParams.get("token");
  const isCronAuthorized = Boolean(
    cronSecret &&
      (authHeader === `Bearer ${cronSecret}` || tokenParam === cronSecret)
  );

  if (!isCronAuthorized) {
    const authErr = await requireAdminApiAuth(req);
    if (authErr) return authErr;
  }

  const settings = await getSettingsOnly();
  const cfg = {
    ...DEFAULT_AUTOMATION_SETTINGS,
    ...(settings.automation ?? {}),
  };

  if (!isWithinBusinessHours(cfg)) {
    return NextResponse.json({
      skipped: true,
      reason: "Fora do horário comercial (America/Sao_Paulo).",
      processedCount: 0,
    });
  }

  const config = resolveWhatsappConfig(settings);
  const res = await processDueWhatsappQueue({
    config,
    forceAll: false,
    maxPerRun: 1,
  });

  return NextResponse.json({
    skipped: false,
    processedCount: res.processed.length,
    rescheduled: res.rescheduled,
  });
}
