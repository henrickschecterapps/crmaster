import { NextRequest, NextResponse } from "next/server";
import {
  getCronLogs,
  getStoreData,
  saveCronLog,
  updateLead,
} from "@/lib/repository";
import { formatCurrency, formatDateBr, generateId } from "@/lib/utils";
import { isAnyEmailProviderConfigured, sendEmailNotification } from "@/lib/email";
import { requireAdminApiAuth } from "@/lib/apiGuard";
import { sendAdminPushNotification } from "@/lib/webPush";
import {
  buildBrandedEmailHtml,
  buildContextualFollowupMessage,
  diffDaysYmd,
  getPublicAppUrl,
  getSaoPauloParts,
  isWithinBusinessHours,
} from "@/lib/automationHelpers";
import {
  enqueueWhatsappBatch,
  processDueWhatsappQueue,
  resolveWhatsappConfig,
} from "@/lib/whatsappQueue";
import {
  CronExecutionAction,
  CronExecutionLog,
  DEFAULT_AUTOMATION_SETTINGS,
} from "@/types/crm";

export const dynamic = "force-dynamic";

async function runFollowupCadence(
  dryRun: boolean = false,
  ignoreBusinessHours: boolean = false
): Promise<CronExecutionLog & { skippedOutsideBusinessHours?: boolean; lifecycleTriggered?: number }> {
  const store = await getStoreData();
  const cfg = {
    ...DEFAULT_AUTOMATION_SETTINGS,
    ...(store.settings.automation ?? {}),
  };
  const now = new Date();
  const nowMs = now.getTime();
  const sp = getSaoPauloParts(now);
  const baseUrl = getPublicAppUrl();
  const emailConfigured = isAnyEmailProviderConfigured();
  const waConfig = resolveWhatsappConfig(store.settings);
  const adminEmail = (
    store.settings.adminEmail ||
    process.env.ADMIN_EMAIL ||
    ""
  ).trim();

  const outsideHours = !ignoreBusinessHours && !isWithinBusinessHours(cfg, now);

  // 1. Drain at most 1 due WhatsApp queue item safely (anti-burst) when in business hours
  let queueProcessed = 0;
  if (!dryRun && !outsideHours) {
    const dueRes = await processDueWhatsappQueue({
      config: waConfig,
      forceAll: false,
      maxPerRun: 1,
    });
    queueProcessed = dueRes.processed.length;
  }

  const activeLeads = store.leads.filter((lead) => !lead.archived);
  const eligibleLeads = activeLeads.filter(
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

  const allowEmail = cfg.followupChannel === "email" || cfg.followupChannel === "ambos";
  const allowWa = cfg.followupChannel === "whatsapp" || cfg.followupChannel === "ambos";

  // 2. Commercial Follow-up Cadence (Step 1 & Step 2) with vertical & stage contextual copy
  if (!outsideHours || dryRun) {
    for (const lead of eligibleLeads) {
      const lastMs = new Date(lead.ultimaInteracaoEm).getTime();
      const hoursSince = Math.max(0, (nowMs - lastMs) / (1000 * 60 * 60));

      let targetStep: "dia_2" | "dia_5" | null = null;
      if (hoursSince >= cfg.followupDay2Hours && lead.followupStep < 2) {
        targetStep = "dia_5";
      } else if (hoursSince >= cfg.followupDay1Hours && lead.followupStep < 1) {
        targetStep = "dia_2";
      }

      if (!targetStep) continue;

      const portalUrl = `${baseUrl}/portal/${lead.id}`;
      const { subject, body: bodyText } = buildContextualFollowupMessage({
        lead,
        step: targetStep,
        portalUrl,
        nextAvailableDate: store.settings.nextAvailableDate || "próxima semana",
      });

      let emailStatus = "desativado_canal";
      if (allowEmail) {
        if (!lead.email) {
          emailStatus = "sem_email";
        } else if (dryRun || !emailConfigured) {
          emailStatus = "simulado";
        } else {
          const emailRes = await sendEmailNotification({
            to: lead.email,
            subject,
            text: bodyText,
            html: buildBrandedEmailHtml({
              kicker: "ÚLTIMO QUADRO · Fotografia Autoral & Audiovisual 4K",
              headline: subject,
              bodyText,
              ctaLabel: "Abrir Portal do Projeto",
              ctaUrl: portalUrl,
            }),
          });
          emailStatus = emailRes.ok
            ? `enviado_${emailRes.provider}`
            : `erro: ${emailRes.error || "falha"}`;
        }
      }

      let whatsappStatus = "desativado_canal";
      if (allowWa) {
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
        } else {
          whatsappStatus = "fila_assistida_wa_me";
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
                ? "Follow-up Automático: Etapa 2 (Encerramento Elegante)"
                : "Follow-up Automático: Etapa 1 (Retomada Contextual)",
            description: `Cadência executada (${Math.floor(hoursSince)}h sem resposta). E-mail: ${emailStatus} | WhatsApp: ${whatsappStatus}${tagAdded ? ` | Tag: ${tagAdded}` : ""}.`,
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
  }

  // 3. Lifecycle Automations with strict Idempotency (automationMarks)
  let lifecycleTriggered = 0;
  const digestLines: string[] = [];

  if (!dryRun && !outsideHours) {
    for (const lead of activeLeads) {
      const marks = { ...(lead.automationMarks ?? {}) };
      let marksChanged = false;
      const portalUrl = `${baseUrl}/portal/${lead.id}`;
      const firstName = lead.contactName?.split(" ")[0] || lead.contactName;

      // 3a. Meeting Reminder (24h before confirmed meeting)
      if (cfg.enableMeetingReminder24h) {
        for (const m of lead.meetings ?? []) {
          if (m.status !== "confirmada" || !m.date) continue;
          const daysUntil = diffDaysYmd(sp.ymd, m.date);
          const markKey = `meeting_24h:${m.id}`;
          if ((daysUntil === 0 || daysUntil === 1) && !marks[markKey]) {
            const msg = `Olá ${firstName}, tudo bem?\n\nLembrete da nossa reunião "${m.title}" com a ÚLTIMO QUADRO marcada para ${formatDateBr(m.date)} às ${m.time} (${m.format === "online" ? "Online" : "Presencial"}).\n${m.locationOrUrl ? `Acesso/Local: ${m.locationOrUrl}\n` : ""}\nTodos os detalhes também ficam salvos no portal:\n${portalUrl}`;
            if (lead.email && emailConfigured) {
              await sendEmailNotification({
                to: lead.email,
                subject: `Lembrete de reunião (${formatDateBr(m.date)} · ${m.time}) | ÚLTIMO QUADRO`,
                text: msg,
                html: buildBrandedEmailHtml({
                  kicker: "ÚLTIMO QUADRO · Agenda do Projeto",
                  headline: `Lembrete: ${m.title}`,
                  bodyText: msg,
                  ctaLabel: "Abrir Portal do Projeto",
                  ctaUrl: portalUrl,
                }),
              });
            }
            marks[markKey] = now.toISOString();
            marksChanged = true;
            lifecycleTriggered += 1;
            digestLines.push(`Reunião confirmada (${formatDateBr(m.date)} ${m.time}): ${lead.companyName}`);
          }
        }
      }

      // 3b. Pre-shoot Briefing Reminder (48h before eventDate if briefing not yet filled)
      if (cfg.enableBriefingReminder48h && lead.eventDate && !lead.briefing) {
        const daysUntilEvent = diffDaysYmd(sp.ymd, lead.eventDate);
        const markKey = `briefing_48h:${lead.eventDate}`;
        if (daysUntilEvent >= 1 && daysUntilEvent <= 2 && !marks[markKey]) {
          const msg = `Olá ${firstName}, tudo bem?\n\nNossa produção da ${lead.companyName} está chegando (${formatDateBr(lead.eventDate)}). Para nossa equipe chegar totalmente alinhada com horário de acesso, contato no local e referências visuais, você consegue preencher rapidinho a aba "Briefing & Local" no portal?\n\nAcesso direto:\n${portalUrl}`;
          if (lead.email && emailConfigured) {
            await sendEmailNotification({
              to: lead.email,
              subject: `Alinhamento pré-produção (${formatDateBr(lead.eventDate)}) | ÚLTIMO QUADRO`,
              text: msg,
              html: buildBrandedEmailHtml({
                kicker: "ÚLTIMO QUADRO · Pré-Produção",
                headline: `Briefing da produção em ${formatDateBr(lead.eventDate)}`,
                bodyText: msg,
                ctaLabel: "Preencher Briefing no Portal",
                ctaUrl: portalUrl,
              }),
            });
          }
          marks[markKey] = now.toISOString();
          marksChanged = true;
          lifecycleTriggered += 1;
        }
      }

      // 3c. Proposal Expiring Reminder (24h before proposalValidUntil if still not approved)
      if (
        cfg.enableProposalExpiring24h &&
        lead.proposalValidUntil &&
        !lead.propostaAprovadaEm
      ) {
        const daysLeft = diffDaysYmd(sp.ymd, lead.proposalValidUntil);
        const markKey = `valid_until:${lead.proposalValidUntil}`;
        if ((daysLeft === 0 || daysLeft === 1) && !marks[markKey]) {
          const msg = `Olá ${firstName}, tudo bem?\n\nA pré-reserva de condições da proposta da ${lead.companyName} na ÚLTIMO QUADRO fica válida até ${formatDateBr(lead.proposalValidUntil)}.\n\nSe quiser travar a data ou ajustar algum ponto antes do prazo, basta acessar o portal:\n${portalUrl}`;
          if (lead.email && emailConfigured) {
            await sendEmailNotification({
              to: lead.email,
              subject: `Pré-reserva válida até ${formatDateBr(lead.proposalValidUntil)} | ${lead.companyName}`,
              text: msg,
              html: buildBrandedEmailHtml({
                kicker: "ÚLTIMO QUADRO · Validade da Proposta",
                headline: `Condições válidas até ${formatDateBr(lead.proposalValidUntil)}`,
                bodyText: msg,
                ctaLabel: "Revisar Proposta no Portal",
                ctaUrl: portalUrl,
              }),
            });
          }
          marks[markKey] = now.toISOString();
          marksChanged = true;
          lifecycleTriggered += 1;
        }
      }

      // 3d. Gentle 50% Deposit Reminder (24h+ after approval while still pendente)
      if (
        cfg.enableSignalReminder24h &&
        lead.propostaAprovadaEm &&
        lead.paymentStatus === "pendente"
      ) {
        const hoursSinceApproved =
          (nowMs - new Date(lead.propostaAprovadaEm).getTime()) / (1000 * 60 * 60);
        const markKey = `signal_24h:${lead.propostaAprovadaEm.slice(0, 10)}`;
        if (hoursSinceApproved >= 24 && !marks[markKey]) {
          const signalVal = formatCurrency((lead.estimatedValue || 0) * 0.5);
          const msg = `Olá ${firstName}, tudo bem?\n\nObrigado novamente por escolher a ÚLTIMO QUADRO para o projeto da ${lead.companyName}. Passando só para deixar fácil o acesso ao QR Code Pix do sinal de reserva (${signalVal}) e ao Contrato PDF no portal:\n${portalUrl}\n\nAssim que concluir, você pode anexar o comprovante direto por lá para confirmarmos a data definitiva na agenda.`;
          if (lead.email && emailConfigured) {
            await sendEmailNotification({
              to: lead.email,
              subject: `Reserva de agenda & Pix (50%) | ${lead.companyName} | ÚLTIMO QUADRO`,
              text: msg,
              html: buildBrandedEmailHtml({
                kicker: "ÚLTIMO QUADRO · Confirmação de Data",
                headline: `Pix de reserva (${signalVal}) disponível no portal`,
                bodyText: msg,
                ctaLabel: "Acessar Contrato & Pix",
                ctaUrl: portalUrl,
              }),
            });
          }
          marks[markKey] = now.toISOString();
          marksChanged = true;
          lifecycleTriggered += 1;
        }
      }

      // 3e. Post-delivery Review Request (3 days after productionStage === "entregue")
      if (cfg.enableReviewRequest3d && lead.productionStage === "entregue") {
        const daysSinceUpdate =
          (nowMs - new Date(lead.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
        const markKey = `review_3d`;
        if (daysSinceUpdate >= 3 && !marks[markKey]) {
          const msg = `Olá ${firstName}, tudo bem?\n\nEspero que o time da ${lead.companyName} esteja gostando do resultado do material entregue pela ÚLTIMO QUADRO.\n\nSe puder compartilhar em duas linhas como foi a experiência conosco (ou deixar uma avaliação rápida), ajuda muito o trabalho do estúdio aqui em BH.\n\nOs links em alta resolução continuam organizados no seu portal:\n${portalUrl}`;
          if (lead.email && emailConfigured) {
            await sendEmailNotification({
              to: lead.email,
              subject: `Como ficou o material da ${lead.companyName}? | ÚLTIMO QUADRO`,
              text: msg,
              html: buildBrandedEmailHtml({
                kicker: "ÚLTIMO QUADRO · Pós-Entrega",
                headline: "O que acharam do resultado final?",
                bodyText: msg,
                ctaLabel: "Acessar Central de Entregas",
                ctaUrl: portalUrl,
              }),
            });
          }
          marks[markKey] = now.toISOString();
          marksChanged = true;
          lifecycleTriggered += 1;
        }
      }

      // 3f. 60-Day Recurrence Radar (alerts Admin to pitch next seasonal campaign)
      if (cfg.enableRecurrenceRadar60d && lead.stage === "fechado") {
        const daysSinceClosed =
          (nowMs - new Date(lead.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
        const markKey = `recurrence_60d`;
        if (daysSinceClosed >= 60 && !marks[markKey]) {
          marks[markKey] = now.toISOString();
          marksChanged = true;
          lifecycleTriggered += 1;
          digestLines.push(
            `Recorrência (60d+): oferecer nova produção sazonal para ${lead.companyName}`
          );
        }
      }

      if (marksChanged) {
        await updateLead(
          lead.id,
          { automationMarks: marks },
          {
            type: "followup_auto",
            title: "Gatilho automático de ciclo de vida executado",
            description: "Automação de agenda/pós-venda registrada com controle anti-duplicação.",
          },
          false
        );
      }
    }

    // 4. Morning Studio Digest for Admin (once per day in São Paulo timezone)
    if (cfg.enableMorningDigest) {
      const dueTasks = activeLeads.filter(
        (l) =>
          l.nextAction &&
          !l.nextAction.completed &&
          l.nextAction.dueAt.slice(0, 10) <= sp.ymd
      );
      const upcomingEvents = activeLeads.filter(
        (l) =>
          l.eventDate &&
          diffDaysYmd(sp.ymd, l.eventDate) >= 0 &&
          diffDaysYmd(sp.ymd, l.eventDate) <= 7
      );
      const pendingPortalCount = activeLeads.reduce((acc, l) => {
        const pix =
          l.paymentStatus !== "quitado" && (l.paymentNotices?.length ?? 0) > 0
            ? 1
            : 0;
        const meets = (l.meetings ?? []).filter(
          (m) => m.status === "solicitada"
        ).length;
        const adj = (l.deliverables ?? []).filter(
          (d) => d.status === "ajuste_solicitado"
        ).length;
        return acc + pix + meets + adj;
      }, 0);

      const summaryParts: string[] = [
        `• Tarefas para hoje/atrasadas: ${dueTasks.length}`,
        `• Diárias nos próximos 7 dias: ${upcomingEvents.length}`,
        `• Pendências do Portal (Pix/Reuniões/Ajustes): ${pendingPortalCount}`,
        `• Follow-ups disparados hoje: ${actions.length}`,
        ...digestLines.map((line) => `• ${line}`),
      ];

      if (
        dueTasks.length > 0 ||
        upcomingEvents.length > 0 ||
        pendingPortalCount > 0 ||
        digestLines.length > 0
      ) {
        await sendAdminPushNotification({
          title: `Resumo Matinal · ÚLTIMO QUADRO (${formatDateBr(sp.ymd)})`,
          body: `${dueTasks.length} tarefa(s), ${upcomingEvents.length} diária(s) na semana e ${pendingPortalCount} pendência(s) no Portal.`,
          url: "/?tab=agenda",
          tag: `digest-${sp.ymd}`,
        }).catch(() => {});

        if (adminEmail && emailConfigured) {
          const textBody = `Resumo diário da ÚLTIMO QUADRO (${formatDateBr(sp.ymd)}):\n\n${summaryParts.join("\n")}\n\nAcesse o painel: ${baseUrl}/?tab=agenda`;
          await sendEmailNotification({
            to: adminEmail,
            subject: `[Resumo Diário] ÚLTIMO QUADRO · ${formatDateBr(sp.ymd)}`,
            text: textBody,
            html: buildBrandedEmailHtml({
              kicker: "ÚLTIMO QUADRO · Resumo Matinal",
              headline: `Operação do dia (${formatDateBr(sp.ymd)})`,
              bodyText: summaryParts.join("\n"),
              ctaLabel: "Abrir Agenda do Estúdio",
              ctaUrl: `${baseUrl}/?tab=agenda`,
            }),
          });
        }
      }
    }
  }

  const queuedJobs =
    !dryRun && !outsideHours && whatsappJobsInput.length > 0
      ? await enqueueWhatsappBatch({
          items: whatsappJobsInput,
          config: waConfig,
        })
      : [];

  const logEntry: CronExecutionLog = {
    id: generateId("cron"),
    executedAt: now.toISOString(),
    dryRun,
    scannedEligible: eligibleLeads.length,
    triggeredCount: actions.length + lifecycleTriggered,
    whatsappQueueScheduled: queuedJobs.length,
    queueProcessed,
    actions,
  };

  if (!dryRun) {
    await saveCronLog(logEntry);
  }

  return {
    ...logEntry,
    skippedOutsideBusinessHours: outsideHours,
    lifecycleTriggered,
  };
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("history") === "1") {
    const authErr = await requireAdminApiAuth(req);
    if (authErr) return authErr;
    const logs = await getCronLogs(10);
    return NextResponse.json({ history: logs, logs });
  }

  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = req.headers.get("authorization");
  const isCronAuthorized = Boolean(
    cronSecret && authHeader === `Bearer ${cronSecret}`
  );

  if (!isCronAuthorized) {
    const authErr = await requireAdminApiAuth(req);
    if (authErr) return authErr;
  }

  const result = await runFollowupCadence(false, false);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const authErr = await requireAdminApiAuth(req);
  if (authErr) return authErr;

  try {
    const body = (await req.json().catch(() => ({}))) as {
      dryRun?: boolean;
      ignoreBusinessHours?: boolean;
    };
    const result = await runFollowupCadence(
      Boolean(body.dryRun),
      Boolean(body.ignoreBusinessHours ?? true)
    );
    const logs = await getCronLogs(10);
    return NextResponse.json({ ...result, history: logs, logs });
  } catch {
    return NextResponse.json(
      { error: "Erro ao executar régua de follow-up." },
      { status: 500 }
    );
  }
}
