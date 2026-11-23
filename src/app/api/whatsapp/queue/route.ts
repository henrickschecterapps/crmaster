import { NextRequest, NextResponse } from "next/server";
import { getStoreData } from "@/lib/repository";
import { requireAdminApiAuth } from "@/lib/apiGuard";
import {
  enqueueWhatsappBatch,
  EnqueueWhatsappInput,
  getWhatsappQueueJobs,
  processDueWhatsappQueue,
  resolveWhatsappConfig,
} from "@/lib/whatsappQueue";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authErr = await requireAdminApiAuth(req);
  if (authErr) return authErr;
  const store = await getStoreData();
  const config = resolveWhatsappConfig(store.settings);
  const jobs = await getWhatsappQueueJobs();
  return NextResponse.json({
    configured: Boolean(config),
    provider: config?.provider ?? store.settings.whatsappProvider,
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

    const store = await getStoreData();
    const config = resolveWhatsappConfig(store.settings);

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
    const body = (await req.json().catch(() => ({}))) as { forceAll?: boolean };
    const store = await getStoreData();
    const config = resolveWhatsappConfig(store.settings);
    const result = await processDueWhatsappQueue({
      config,
      forceAll: Boolean(body.forceAll),
    });
    const jobs = await getWhatsappQueueJobs();
    return NextResponse.json({
      processedCount: result.processed.length,
      jobs,
    });
  } catch {
    return NextResponse.json(
      { error: "Erro ao processar fila de WhatsApp." },
      { status: 500 }
    );
  }
}
