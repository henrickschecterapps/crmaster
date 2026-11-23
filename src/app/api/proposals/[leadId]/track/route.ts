import { NextRequest, NextResponse } from "next/server";
import { getStoreData, trackProposalView, updateLead } from "@/lib/repository";
import { buildWhatsappUrl, formatCurrency } from "@/lib/utils";
import { sendEmailNotification } from "@/lib/email";
import {
  resolveWhatsappConfig,
  sendWhatsappViaApi,
} from "@/lib/whatsappQueue";

export const dynamic = "force-dynamic";

const RADAR_DEBOUNCE_MS = 10 * 60 * 1000;

function buildRadarEmailHtml(params: {
  companyName: string;
  contactName: string;
  totalViews: number;
  estimatedValue: number;
  clientWhatsappUrl: string;
  crmUrl: string;
}): string {
  return `
    <div style="background:#0C0C0C;padding:36px 20px;font-family:'Montserrat',Arial,sans-serif;">
      <div style="max-width:580px;margin:0 auto;background:#121212;border:1px solid rgba(245,245,245,0.1);border-radius:12px;padding:32px;">
        <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#EA7845;font-weight:800;margin-bottom:8px;">
          ÚLTIMO QUADRO · Radar de Abertura em Tempo Real
        </div>
        <h1 style="margin:0 0 14px;color:#F5F5F5;font-size:21px;font-weight:700;line-height:1.3;">
          Radar: ${params.companyName} abriu sua proposta agora
        </h1>
        <p style="margin:0 0 20px;color:#C2C2C2;font-size:14px;line-height:1.6;">
          O cliente <strong style="color:#F5F5F5;">${params.contactName}</strong> acabou de visualizar a proposta exclusiva da Último Quadro
          (visualização nº <strong style="color:#EA7845;">${params.totalViews}</strong>, valor estimado ${formatCurrency(params.estimatedValue)}).
          Hora de chamar no WhatsApp enquanto a proposta está aberta na tela.
        </p>
        <div style="margin:24px 0;">
          <a href="${params.clientWhatsappUrl}" style="display:inline-block;background:#B54512;color:#F5F5F5;text-decoration:none;font-weight:700;font-size:13px;padding:13px 22px;border-radius:8px;">
            Chamar ${params.contactName} no WhatsApp agora
          </a>
        </div>
        <div style="margin-top:16px;">
          <a href="${params.crmUrl}" style="color:#EA7845;font-size:12px;text-decoration:underline;">
            Abrir painel CRM ÚLTIMO QUADRO
          </a>
        </div>
        <hr style="border:none;border-top:1px solid rgba(245,245,245,0.08);margin:24px 0 14px;" />
        <p style="margin:0;color:#969696;font-size:11px;">
          Alerta automático com debounce de 10 minutos · ÚLTIMO QUADRO · A história termina. A imagem fica.
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
    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    ).replace(/\/+$/, "");

    const clientWaMsg = `Olá ${updated.contactName}, tudo bem? Aqui é o Henrique da ÚLTIMO QUADRO. Vi que você está conferindo a proposta da ${updated.companyName}. Posso tirar alguma dúvida ou personalizar algum detalhe para vocês?`;
    const clientWhatsappUrl = buildWhatsappUrl(updated.phone, clientWaMsg);

    if (adminEmail) {
      const emailRes = await sendEmailNotification({
        to: adminEmail,
        subject: `[RADAR] ${updated.companyName} abriu seu Portal agora`,
        text: `${updated.contactName} (${updated.companyName}) acabou de abrir o Portal/Proposta (visualização nº ${updated.visualizacoesProposta}, valor ${formatCurrency(updated.estimatedValue)}). Abrir cliente: ${appUrl}/clientes/${updated.id}`,
        html: buildRadarEmailHtml({
          companyName: updated.companyName,
          contactName: updated.contactName,
          totalViews: updated.visualizacoesProposta,
          estimatedValue: updated.estimatedValue,
          clientWhatsappUrl,
          crmUrl: `${appUrl}/clientes/${updated.id}`,
        }),
      });
      radarEmailSent = emailRes.ok;
    }

    const waConfig = resolveWhatsappConfig(store.settings);
    const adminWhatsapp =
      process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5531983997195";

    if (waConfig && adminWhatsapp) {
      const waText = `[RADAR DE PROPOSTA] ${updated.companyName} acabou de abrir sua proposta agora (Visualização nº ${updated.visualizacoesProposta}). Hora de chamar no WhatsApp.`;
      const waRes = await sendWhatsappViaApi({
        phone: adminWhatsapp,
        message: waText,
        config: waConfig,
      });
      radarWhatsappSent = waRes.ok;
    }

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
