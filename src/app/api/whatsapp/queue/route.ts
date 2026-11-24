import { NextRequest, NextResponse } from "next/server";
import { getSettingsOnly } from "@/lib/repository";
import { requireAdminApiAuth } from "@/lib/apiGuard";
import {
  enqueueWhatsappBatch,
  EnqueueWhatsappInput,
  getWhatsappQueueJobs,
  processDueWhatsappQueue,
  resolveWhatsappConfig,
  retryOrCancelWhatsappJob,
} from "@/lib/whatsappQueue";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authErr = await requireAdminApiAuth(req);
  if (authErr) return authErr;
  const settings = await getSettingsOnly();
  const config = resolveWhatsappConfig(settings);
  const jobs = await getWhatsappQueueJobs();
  return NextResponse.json({
    configured: Boolean(config),
    provider: config?.provider ?? settings.whatsappProvider,
    jobs,
  });
}

export async function POST(req: NextRequest) {
  const authErr = await requireAdminApiAuth(req);
  if (authErr) return authErr;
  try {
    const body = (await req.json()) as { items?: EnqueueWhatsappInput[] };
    const items = body.items ?? [];

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Informe ao menos 1 mensagem para enfileirar." },
        { status: 400 }
      );
    }

    const settings = await getSettingsOnly();
    const config = resolveWhatsappConfig(settings);

    const jobs = await enqueueWhatsappBatch({
      items,
      config,
    });

    return NextResponse.json(
      {
        enqueued: jobs.length,
        mode: config ? "live" : "simulated",
        jobs,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Não foi possível enfileirar mensagens." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const authErr = await requireAdminApiAuth(req);
  if (authErr) return authErr;
  try {
    const body = (await req.json().catch(() => ({}))) as {
      forceAll?: boolean;
      force?: boolean;
      jobId?: string;
      action?: "retry" | "cancel";
    };
    const settings = await getSettingsOnly();
    const config = resolveWhatsappConfig(settings);

    if (body.jobId && (body.action === "retry" || body.action === "cancel")) {
      await retryOrCancelWhatsappJob({
        jobId: body.jobId,
        action: body.action,
        config,
      });
      const jobs = await getWhatsappQueueJobs();
      return NextResponse.json({
        processedCount: 1,
        processed: 1,
        jobs,
      });
    }

    const result = await processDueWhatsappQueue({
      config,
      forceAll: Boolean(body.forceAll || body.force),
      maxPerRun: body.forceAll || body.force ? 5 : 1,
    });
    const jobs = await getWhatsappQueueJobs();
    return NextResponse.json({
      processedCount: result.processed.length,
      processed: result.processed.length,
      rescheduled: result.rescheduled,
      jobs,
    });
  } catch {
    return NextResponse.json(
      { error: "Erro ao processar fila de WhatsApp." },
      { status: 500 }
    );
  }
}
