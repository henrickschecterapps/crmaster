import { NextRequest, NextResponse } from "next/server";
import { getLeadById, getSettingsOnly, updateLead } from "@/lib/repository";
import {
  ClientBriefing,
  ClientMeeting,
  ClientPaymentNotice,
  MEETING_TYPES,
  MeetingType,
} from "@/types/crm";
import { generateId } from "@/lib/utils";
import { sendEmailNotification } from "@/lib/email";
import { sendAdminPushNotification } from "@/lib/webPush";
import { emitOutgoingWebhook } from "@/lib/automationHelpers";

export const dynamic = "force-dynamic";

type PortalActionPayload =
  | { action: "verify_pin"; pin: string }
  | {
      action: "request_meeting";
      pin?: string;
      type: MeetingType;
      title?: string;
      date: string;
      time: string;
      format: "online" | "presencial";
      notes?: string;
    }
  | {
      action: "reschedule_meeting";
      pin?: string;
      meetingId: string;
      date: string;
      time: string;
      reason?: string;
    }
  | {
      action: "report_payment";
      pin?: string;
      kind: "sinal_50" | "quitacao";
      amount: number;
      transactionRef?: string;
      receiptUrl?: string;
    }
  | {
      action: "save_briefing";
      pin?: string;
      briefing: ClientBriefing;
    }
  | {
      action: "review_deliverable";
      pin?: string;
      deliverableId: string;
      decision: "aprovado" | "ajuste_solicitado";
      feedback?: string;
    };

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await context.params;
    const [lead, settings] = await Promise.all([
      getLeadById(leadId),
      getSettingsOnly(),
    ]);

    if (!lead) {
      return NextResponse.json(
        { error: "Portal não encontrado." },
        { status: 404 }
      );
    }

    const body = (await req.json()) as PortalActionPayload;

    if (body.action === "verify_pin") {
      if (!lead.portalPin) {
        return NextResponse.json({ unlocked: true });
      }
      const match = (body.pin || "").trim() === lead.portalPin.trim();
      if (!match) {
        return NextResponse.json(
          { error: "PIN incorreto. Verifique o código de 4 dígitos enviado." },
          { status: 401 }
        );
      }
      return NextResponse.json({ unlocked: true });
    }

    // Verify PIN if protected
    if (lead.portalPin && (body.pin || "").trim() !== lead.portalPin.trim()) {
      return NextResponse.json(
        { error: "PIN de acesso obrigatório para esta ação." },
        { status: 401 }
      );
    }

    const now = new Date().toISOString();
    const adminEmail =
      settings.adminEmail || process.env.ADMIN_EMAIL || "";

    if (body.action === "request_meeting") {
      if (!body.date || !body.time) {
        return NextResponse.json(
          { error: "Informe a data e o horário desejados para a reunião." },
          { status: 400 }
        );
      }
      const typeSpec = MEETING_TYPES.find((m) => m.id === body.type);
      const meetingTitle =
        body.title?.trim() || typeSpec?.label || "Reunião de Projeto";

      const newMeeting: ClientMeeting = {
        id: generateId("meet"),
        type: body.type || "alinhamento",
        title: meetingTitle,
        date: body.date,
        time: body.time,
        format: body.format === "presencial" ? "presencial" : "online",
        notes: body.notes?.trim() || "",
        status: "solicitada",
        requestedBy: "cliente",
        createdAt: now,
      };

      const updatedMeetings = [newMeeting, ...(lead.meetings ?? [])];
      const updated = await updateLead(
        lead.id,
        { meetings: updatedMeetings },
        {
          type: "reuniao",
          title: `Reunião solicitada pelo cliente: ${meetingTitle}`,
          description: `Sugestão para ${body.date} às ${body.time} (${newMeeting.format}). ${newMeeting.notes || ""}`.trim(),
        },
        true
      );

      if (adminEmail) {
        await sendEmailNotification({
          to: adminEmail,
          subject: `[Portal ÚLTIMO QUADRO] Nova reunião solicitada: ${lead.companyName}`,
          text: `${lead.contactName} (${lead.companyName}) solicitou "${meetingTitle}" para ${body.date} às ${body.time} (${newMeeting.format}).\n\nObservações: ${newMeeting.notes || "Nenhuma"}.`,
          html: `<p><strong>${lead.contactName}</strong> (${lead.companyName}) solicitou uma reunião pelo Portal do Cliente:</p><ul><li><strong>Tipo:</strong> ${meetingTitle}</li><li><strong>Data/Hora:</strong> ${body.date} às ${body.time}</li><li><strong>Formato:</strong> ${newMeeting.format}</li><li><strong>Observações:</strong> ${newMeeting.notes || "Nenhuma"}</li></ul>`,
        }).catch(() => {});
      }

      await sendAdminPushNotification({
        title: `Nova Reunião: ${lead.companyName}`,
        body: `${meetingTitle} sugerida para ${body.date} às ${body.time}.`,
        url: `/clientes/${lead.id}`,
        tag: `meeting-${lead.id}`,
      }).catch(() => {});

      await emitOutgoingWebhook(settings, "meeting.requested", {
        leadId: lead.id,
        companyName: lead.companyName,
        contactName: lead.contactName,
        meeting: newMeeting,
      }).catch(() => {});

      return NextResponse.json({
        meeting: newMeeting,
        meetings: updated?.meetings ?? updatedMeetings,
      });
    }

    if (body.action === "reschedule_meeting") {
      if (!body.meetingId || !body.date || !body.time) {
        return NextResponse.json(
          { error: "Informe a nova data e horário para reagendamento." },
          { status: 400 }
        );
      }
      const existingMeetings = lead.meetings ?? [];
      const target = existingMeetings.find((m) => m.id === body.meetingId);
      if (!target) {
        return NextResponse.json(
          { error: "Reunião não encontrada." },
          { status: 404 }
        );
      }

      const nextMeetings = existingMeetings.map((m) =>
        m.id === body.meetingId
          ? {
              ...m,
              date: body.date,
              time: body.time,
              status: "solicitada" as const,
              notes: body.reason?.trim()
                ? `${m.notes ? `${m.notes} | ` : ""}Reagendamento: ${body.reason.trim()}`
                : m.notes,
            }
          : m
      );

      const updated = await updateLead(
        lead.id,
        { meetings: nextMeetings },
        {
          type: "reuniao",
          title: `Reagendamento solicitado: ${target.title}`,
          description: `Nova sugestão: ${body.date} às ${body.time}. ${body.reason?.trim() || ""}`.trim(),
        },
        true
      );

      if (adminEmail) {
        await sendEmailNotification({
          to: adminEmail,
          subject: `[Portal ÚLTIMO QUADRO] Pedido de reagendamento: ${lead.companyName}`,
          text: `${lead.contactName} (${lead.companyName}) pediu para reagendar "${target.title}" para ${body.date} às ${body.time}. Motivo: ${body.reason?.trim() || "Não informado"}.`,
          html: `<p><strong>${lead.contactName}</strong> (${lead.companyName}) solicitou reagendamento de <strong>${target.title}</strong> para <strong>${body.date} às ${body.time}</strong>.</p><p>Motivo: ${body.reason?.trim() || "Não informado"}</p>`,
        }).catch(() => {});
      }

      return NextResponse.json({
        meetings: updated?.meetings ?? nextMeetings,
      });
    }

    if (body.action === "report_payment") {
      const notice: ClientPaymentNotice = {
        id: generateId("pay"),
        kind: body.kind === "quitacao" ? "quitacao" : "sinal_50",
        amount: Number(body.amount) || 0,
        transactionRef: (body.transactionRef || "").trim(),
        receiptUrl: (body.receiptUrl || "").trim() || undefined,
        reportedAt: now,
      };
      const nextNotices = [notice, ...(lead.paymentNotices ?? [])];
      const kindLabel =
        notice.kind === "quitacao" ? "Quitação (50% restante)" : "Sinal (50%)";

      const updated = await updateLead(
        lead.id,
        { paymentNotices: nextNotices },
        {
          type: "pagamento",
          title: `Cliente informou Pix realizado (${kindLabel})`,
          description: `Valor: R$ ${notice.amount.toLocaleString("pt-BR")} · Ref: ${notice.transactionRef || "Não informada"}. Confira o extrato para confirmar o status.`,
        },
        true
      );

      if (adminEmail) {
        await sendEmailNotification({
          to: adminEmail,
          subject: `[Portal ÚLTIMO QUADRO] Pix informado: ${lead.companyName} (R$ ${notice.amount.toLocaleString("pt-BR")})`,
          text: `${lead.contactName} (${lead.companyName}) clicou em "Já fiz o Pix" (${kindLabel} - R$ ${notice.amount.toLocaleString("pt-BR")}). Referência/Comprovante: ${notice.transactionRef || "Não informado"}.`,
          html: `<p><strong>${lead.contactName}</strong> (${lead.companyName}) informou o pagamento via Pix no Portal:</p><ul><li><strong>Tipo:</strong> ${kindLabel}</li><li><strong>Valor:</strong> R$ ${notice.amount.toLocaleString("pt-BR")}</li><li><strong>Referência:</strong> ${notice.transactionRef || "Não informada"}</li></ul>`,
        }).catch(() => {});
      }

      await sendAdminPushNotification({
        title: `Pix Informado: ${lead.companyName}`,
        body: `${kindLabel} · R$ ${notice.amount.toLocaleString("pt-BR")}. Confira o extrato.`,
        url: `/clientes/${lead.id}`,
        tag: `pix-${lead.id}`,
      }).catch(() => {});

      await emitOutgoingWebhook(settings, "payment.reported", {
        leadId: lead.id,
        companyName: lead.companyName,
        contactName: lead.contactName,
        notice,
      }).catch(() => {});

      return NextResponse.json({
        paymentNotices: updated?.paymentNotices ?? nextNotices,
      });
    }

    if (body.action === "save_briefing") {
      const nextBriefing: ClientBriefing = {
        referencesLinks: (body.briefing?.referencesLinks || "").trim(),
        venueAddress: (body.briefing?.venueAddress || "").trim(),
        accessTime: (body.briefing?.accessTime || "").trim(),
        onSiteContactName: (body.briefing?.onSiteContactName || "").trim(),
        onSiteContactPhone: (body.briefing?.onSiteContactPhone || "").trim(),
        dressCodeOrNotes: (body.briefing?.dressCodeOrNotes || "").trim(),
        updatedAt: now,
      };

      const updated = await updateLead(
        lead.id,
        { briefing: nextBriefing },
        {
          type: "briefing",
          title: "Briefing & referências atualizados pelo cliente",
          description: `Local: ${nextBriefing.venueAddress || "Não informado"} · Acesso: ${nextBriefing.accessTime || "A definir"}.`,
        },
        true
      );

      return NextResponse.json({
        briefing: updated?.briefing ?? nextBriefing,
      });
    }

    if (body.action === "review_deliverable") {
      const deliverables = lead.deliverables ?? [];
      const target = deliverables.find((d) => d.id === body.deliverableId);
      if (!target) {
        return NextResponse.json(
          { error: "Material de entrega não encontrado." },
          { status: 404 }
        );
      }

      const nextDeliverables = deliverables.map((d) =>
        d.id === body.deliverableId
          ? {
              ...d,
              status: body.decision,
              clientFeedback: (body.feedback || "").trim(),
              updatedAt: now,
            }
          : d
      );

      const actionLabel =
        body.decision === "aprovado"
          ? `Entrega aprovada: ${target.title}`
          : `Ajuste solicitado: ${target.title}`;

      const updated = await updateLead(
        lead.id,
        { deliverables: nextDeliverables },
        {
          type: "entrega",
          title: actionLabel,
          description:
            (body.feedback || "").trim() ||
            (body.decision === "aprovado"
              ? "Cliente aprovou o material final no Portal."
              : "Cliente solicitou ajustes no material."),
        },
        true
      );

      if (adminEmail) {
        await sendEmailNotification({
          to: adminEmail,
          subject: `[Portal ÚLTIMO QUADRO] ${actionLabel} (${lead.companyName})`,
          text: `${lead.contactName} (${lead.companyName}) registrou: ${actionLabel}.\n\nComentário: ${(body.feedback || "").trim() || "Sem comentário adicional."}`,
          html: `<p><strong>${lead.contactName}</strong> (${lead.companyName}) respondeu sobre a entrega <strong>${target.title}</strong>:</p><p><strong>Status:</strong> ${body.decision}</p><p><strong>Comentário:</strong> ${(body.feedback || "").trim() || "Nenhum"}</p>`,
        }).catch(() => {});
      }

      await sendAdminPushNotification({
        title: `${actionLabel}`,
        body: `${lead.companyName}: ${(body.feedback || "").trim() || "Ver detalhes no CRM."}`,
        url: `/clientes/${lead.id}`,
        tag: `deliv-${lead.id}`,
      }).catch(() => {});

      await emitOutgoingWebhook(settings, "deliverable.reviewed", {
        leadId: lead.id,
        companyName: lead.companyName,
        deliverableId: body.deliverableId,
        deliverableTitle: target.title,
        decision: body.decision,
        feedback: (body.feedback || "").trim(),
      }).catch(() => {});

      return NextResponse.json({
        deliverables: updated?.deliverables ?? nextDeliverables,
      });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch {
    return NextResponse.json(
      { error: "Erro ao processar solicitação do portal." },
      { status: 500 }
    );
  }
}
