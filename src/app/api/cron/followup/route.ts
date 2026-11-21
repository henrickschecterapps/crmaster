import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import {
  getCronLogs,
  getStoreData,
  saveCronLog,
  updateLead,
} from "@/lib/repository";
import { generateId, interpolateTemplate } from "@/lib/utils";
import {
  enqueueWhatsappBatch,
  processDueWhatsappQueue,
  resolveWhatsappConfig,
} from "@/lib/whatsappQueue";
import { CronExecutionAction, CronExecutionLog } from "@/types/crm";

export const dynamic = "force-dynamic";

async function runFollowupCadence(dryRun: boolean = false): Promise<CronExecutionLog> {
  const store = await getStoreData();
  const nowMs = Date.now();
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ).replace(/\/+$/, "");

  const tplDay2 =
    store.templates.find((t) => t.id === "tpl-followup-dia2") ??
    store.templates[0];
  const tplDay5 =
    store.templates.find((t) => t.id === "tpl-followup-dia5") ??
    store.templates[0];

  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.RESEND_FROM_EMAIL || "ÚLTIMO QUADRO <onboarding@resend.dev>";
  const waConfig = resolveWhatsappConfig(store.settings);

  // Process any pending persisted WhatsApp queue items that are already due
  let queueProcessed = 0;
  if (!dryRun) {
    const dueRes = await processDueWhatsappQueue({
      config: waConfig,
      forceAll: false,
    });
    queueProcessed = dueRes.processed.length;
  }

  const eligibleLeads = store.leads.filter(
    (lead) =>
      (lead.stage === "contatado" || lead.stage === "proposta_aberta") &&
      lead.automacaoAtiva &&
      !lead.respondeu
  );

  const actions: CronExecutionAction[] = [];
  const whatsappJobsInput: Array<{
    leadId: string;
    companyName: string;
    phone: string;
    message: string;
  }> = [];

  for (const lead of eligibleLeads) {
    const lastMs = new Date(lead.ultimaInteracaoEm).getTime();
    const hoursSince = Math.max(0, (nowMs - lastMs) / (1000 * 60 * 60));

    let targetStep: "dia_2" | "dia_5" | null = null;
    if (hoursSince >= 120 && lead.followupStep < 2) {
      targetStep = "dia_5";
    } else if (hoursSince >= 48 && lead.followupStep < 1) {
      targetStep = "dia_2";
    }

    if (!targetStep) continue;

    const template = targetStep === "dia_5" ? tplDay5 : tplDay2;
    const proposalUrl = `${baseUrl}/proposta/${lead.id}`;
    const vars = {
      nome_contato: lead.contactName,
      nome_empresa: lead.companyName,
      link_proposta: proposalUrl,
      proxima_data_livre: store.settings.nextAvailableDate || "05/12/2026",
    };

    const subject = interpolateTemplate(
      template?.subject || `Follow-up: ${lead.companyName}`,
      vars
    );
    const bodyText = interpolateTemplate(
      template?.body ||
        `Olá ${lead.contactName}, passando para acompanhar nossa proposta: ${proposalUrl}`,
      vars
    );

    let emailStatus = "sem_email";

    if (lead.email) {
      if (dryRun || !resendKey) {
        emailStatus = "simulado";
      } else {
        try {
          const resend = new Resend(resendKey);
          const { error } = await resend.emails.send({
            from: fromEmail,
            to: [lead.email],
            subject,
            text: bodyText,
          });
          emailStatus = error ? "erro" : "enviado";
        } catch {
          emailStatus = "erro";
        }
      }
    }

    let whatsappStatus = "modo_seguro_sem_api";
    if (waConfig && lead.phone) {
      whatsappStatus = "enfileirado";
      if (!dryRun) {
        whatsappJobsInput.push({
          leadId: lead.id,
          companyName: lead.companyName,
          phone: lead.phone,
          message: bodyText,
        });
      }
    }

    const nextTags = [...(lead.tags ?? [])];
    let tagAdded: string | undefined;
    if (targetStep === "dia_5" && !nextTags.includes("Último Toque")) {
      nextTags.push("Último Toque");
      tagAdded = "Último Toque";
    }

    if (!dryRun) {
      await updateLead(
        lead.id,
        {
          followupStep: targetStep === "dia_5" ? 2 : 1,
          tags: nextTags,
        },
        {
          type: "followup_auto",
          title:
            targetStep === "dia_5"
              ? "Follow-up Automático: Dia 5 (Último Toque)"
              : "Follow-up Automático: Dia 2",
          description: `Cadência executada (${Math.floor(hoursSince)}h sem resposta). E-mail: ${emailStatus} | WhatsApp: ${whatsappStatus}${tagAdded ? ` | Tag adicionada: ${tagAdded}` : ""}.`,
        },
        false
      );
    }

    actions.push({
      leadId: lead.id,
      companyName: lead.companyName,
      contactName: lead.contactName,
      step: targetStep,
      hoursSinceInteraction: Math.floor(hoursSince),
      emailStatus,
      whatsappStatus,
      tagAdded,
    });
  }

  const queuedJobs =
    !dryRun && whatsappJobsInput.length > 0
      ? await enqueueWhatsappBatch({
          items: whatsappJobsInput,
          config: waConfig,
        })
      : [];

  const logEntry: CronExecutionLog = {
    id: generateId("cron"),
    executedAt: new Date().toISOString(),
    dryRun,
    scannedEligible: eligibleLeads.length,
    triggeredCount: actions.length,
    whatsappQueueScheduled: queuedJobs.length,
    queueProcessed,
    actions,
  };

  if (!dryRun) {
    await saveCronLog(logEntry);
  }

  return logEntry;
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("history") === "1") {
    const history = await getCronLogs(10);
    return NextResponse.json({ history });
  }

  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (cronSecret && authHeader && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const result = await runFollowupCadence(false);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { dryRun?: boolean };
    const result = await runFollowupCadence(Boolean(body.dryRun));
    const history = await getCronLogs(10);
    return NextResponse.json({ ...result, history });
  } catch {
    return NextResponse.json(
      { error: "Erro ao executar régua de follow-up." },
      { status: 500 }
    );
  }
}
