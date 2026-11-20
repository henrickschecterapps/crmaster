import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getStoreData, trackProposalView, updateLead } from "@/lib/repository";
import { buildWhatsappUrl, formatCurrency } from "@/lib/utils";
import {
  resolveWhatsappConfig,
  sendWhatsappViaApi,
} from "@/lib/whatsappQueue";

export const dynamic = "force-dynamic";

const RADAR_DEBOUNCE_MS = 10 * 60 * 1000; // 10 minutos por lead

function buildRadarEmailHtml(params: {
  companyName: string;
  contactName: string;
  totalViews: number;
  estimatedValue: number;
  clientWhatsappUrl: string;
  crmUrl: string;
}): string {
  return `
    <div style="background:#09090b;padding:36px 20px;font-family:'Plus Jakarta Sans',Arial,sans-serif;">
      <div style="max-width:580px;margin:0 auto;background:#141419;border:1px solid #27272a;border-radius:20px;padding:32px;">
        <div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#e5a93b;font-weight:700;margin-bottom:8px;">
          CRMaster · Radar de Abertura em Tempo Real
        </div>
        <h1 style="margin:0 0 14px;color:#fafafa;font-size:22px;font-weight:700;line-height:1.3;">
          🔥 ${params.companyName} abriu sua proposta agora!
        </h1>
        <p style="margin:0 0 20px;color:#a1a1aa;font-size:14px;line-height:1.6;">
          O cliente <strong style="color:#fafafa;">${params.contactName}</strong> acabou de visualizar a proposta exclusiva
          (visualização nº <strong style="color:#e5a93b;">${params.totalViews}</strong> · valor estimado ${formatCurrency(params.estimatedValue)}).
          Este é o melhor momento para fazer um contato rápido enquanto a proposta está aberta na tela.
        </p>
        <div style="margin:24px 0;">
          <a href="${params.clientWhatsappUrl}" style="display:inline-block;background:#10b981;color:#09090b;text-decoration:none;font-weight:700;font-size:14px;padding:13px 22px;border-radius:12px;">
            Chamar ${params.contactName} no WhatsApp agora
          </a>
        </div>
        <div style="margin-top:16px;">
          <a href="${params.crmUrl}" style="color:#e5a93b;font-size:12px;text-decoration:underline;">
            Abrir painel do CRMaster
          </a>
        </div>
        <hr style="border:none;border-top:1px solid #27272a;margin:24px 0 14px;" />
        <p style="margin:0;color:#71717a;font-size:11px;">
          Alerta automático com debounce de 10 minutos · Henrique Matos Studio (Belo Horizonte)
        </p>
      </div>
    </div>
  `;
}

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ leadId: string }> }
) {
  const { leadId } = await context.params;
  const store = await getStoreData();
  const previousLead = store.leads.find((l) => l.id === leadId);

  if (!previousLead) {
    return NextResponse.json(
      { error: "Proposta não encontrada." },
      { status: 404 }
    );
  }

  // Check 10-minute debounce BEFORE updating
  const lastAlertMs = previousLead.lastRadarAlertAt
    ? new Date(previousLead.lastRadarAlertAt).getTime()
    : 0;
  const isDebounced =
    lastAlertMs > 0 && Date.now() - lastAlertMs < RADAR_DEBOUNCE_MS;

  const updated = await trackProposalView(leadId);
  if (!updated) {
    return NextResponse.json(
      { error: "Proposta não encontrada." },
      { status: 404 }
    );
  }

  let radarEmailSent = false;
  let radarWhatsappSent = false;

  if (!isDebounced) {
    const adminEmail = (
      store.settings.adminEmail ||
      process.env.ADMIN_EMAIL ||
      ""
    ).trim();
    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail =
      process.env.RESEND_FROM_EMAIL ||
      "Henrique Matos Studio <onboarding@resend.dev>";
    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    ).replace(/\/+$/, "");

    const clientWaMsg = `Olá ${updated.contactName}, tudo bem? Vi que você está dando uma olhada na proposta da ${updated.companyName}. Posso tirar alguma dúvida ou personalizar algum detalhe para vocês?`;
    const clientWhatsappUrl = buildWhatsappUrl(updated.phone, clientWaMsg);

    // 1. Instant Email Alert via Resend API
    if (resendKey && adminEmail) {
      try {
        const resend = new Resend(resendKey);
        const { error } = await resend.emails.send({
          from: fromEmail,
          to: [adminEmail],
          subject: `🔥 Radar: ${updated.companyName} abriu sua proposta agora!`,
          html: buildRadarEmailHtml({
            companyName: updated.companyName,
            contactName: updated.contactName,
            totalViews: updated.visualizacoesProposta,
            estimatedValue: updated.estimatedValue,
            clientWhatsappUrl,
            crmUrl: appUrl,
          }),
        });
        if (!error) radarEmailSent = true;
      } catch {
        // Non-blocking alert failure
      }
    }

    // 2. Instant WhatsApp Alert via Evolution API / Z-API (if configured)
    const waConfig = resolveWhatsappConfig(store.settings);
    const adminWhatsapp =
      process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5531998427100";

    if (waConfig && adminWhatsapp) {
      const waText = `🔥 Radar de Proposta: ${updated.companyName} acabou de abrir sua proposta agora! (Visualização nº ${updated.visualizacoesProposta}). Hora de chamar no WhatsApp.`;
      const waRes = await sendWhatsappViaApi({
        phone: adminWhatsapp,
        message: waText,
        config: waConfig,
      });
      radarWhatsappSent = waRes.ok;
    }

    // Persist debounce timestamp + radar alert log
    await updateLead(
      updated.id,
      { lastRadarAlertAt: new Date().toISOString() },
      {
        type: "radar",
        title: "Alerta de Radar em Tempo Real disparado",
        description: `E-mail Admin (${adminEmail || "não configurado"}): ${
          radarEmailSent ? "enviado" : "simulado/pendente"
        } | WhatsApp Admin: ${
          radarWhatsappSent ? "enviado via API" : "API não configurada"
        } (debounce 10 min ativo).`,
      },
      false
    );
  }

  return NextResponse.json({
    tracked: true,
    visualizadaEm: updated.visualizadaEm,
    visualizacoesProposta: updated.visualizacoesProposta,
    stage: updated.stage,
    radar: {
      debounced: isDebounced,
      emailSent: radarEmailSent,
      whatsappSent: radarWhatsappSent,
    },
  });
}
