import { NextRequest, NextResponse } from "next/server";
import { getStoreData, updateLead } from "@/lib/repository";
import {
  enqueueWhatsappBatch,
  EnqueueWhatsappInput,
  getWhatsappQueueJobs,
  resolveWhatsappConfig,
} from "@/lib/whatsappQueue";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = await getStoreData();
  const config = resolveWhatsappConfig(store.settings);
  return NextResponse.json({
    configured: Boolean(config),
    provider: config?.provider ?? store.settings.whatsappProvider,
    jobs: getWhatsappQueueJobs(),
  });
}

export async function POST(req: NextRequest) {
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

    const jobs = enqueueWhatsappBatch({
      items,
      config,
      onJobCompleted: async (job) => {
        const lead = store.leads.find((l) => l.id === job.leadId);
        const nextStage = lead?.stage === "captado" ? "contatado" : undefined;

        await updateLead(
          job.leadId,
          nextStage ? { stage: nextStage } : {},
          {
            type: "whatsapp",
            title:
              job.status === "enviado"
                ? "WhatsApp automático enviado (Fila Anti-Ban)"
                : job.status === "simulado"
                ? "WhatsApp automático simulado (API não configurada)"
                : "Falha no disparo automático de WhatsApp",
            description: job.error
              ? job.error
              : `Agendado com intervalo de ${Math.round(job.delaySeconds / 60)} min para proteção anti-banimento.`,
          },
          true
        );
      },
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
