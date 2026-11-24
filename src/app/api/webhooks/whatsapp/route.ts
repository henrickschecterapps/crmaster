import { NextRequest, NextResponse } from "next/server";
import { getStoreData, updateLead } from "@/lib/repository";
import { normalizePhone } from "@/lib/utils";
import { sendAdminPushNotification } from "@/lib/webPush";
import { emitOutgoingWebhook } from "@/lib/automationHelpers";

export const dynamic = "force-dynamic";

function extractIncomingPhoneAndText(body: Record<string, unknown>): {
  phone: string;
  text: string;
  fromMe: boolean;
} {
  // Evolution API v1/v2 format
  const data = (body.data ?? body) as Record<string, unknown>;
  const key = (data.key ?? {}) as Record<string, unknown>;
  const remoteJid = String(
    key.remoteJid || data.remoteJid || body.phone || body.from || ""
  );
  const fromMe = Boolean(key.fromMe ?? body.fromMe ?? false);
  const phone = normalizePhone(remoteJid.split("@")[0]);

  const msgObj = (data.message ?? {}) as Record<string, unknown>;
  const extText = (msgObj.extendedTextMessage ?? {}) as Record<string, unknown>;
  const zapiText = (body.text ?? {}) as Record<string, unknown>;

  const text = String(
    msgObj.conversation ||
      extText.text ||
      zapiText.message ||
      body.message ||
      ""
  ).trim();

  return { phone, text, fromMe };
}

export async function POST(req: NextRequest) {
  try {
    const store = await getStoreData();
    const expectedToken = (
      store.settings.automation?.whatsappWebhookToken ||
      process.env.WHATSAPP_WEBHOOK_TOKEN ||
      process.env.CRON_SECRET ||
      ""
    ).trim();

    if (expectedToken) {
      const provided =
        req.nextUrl.searchParams.get("token") ||
        req.headers.get("x-webhook-token") ||
        req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
        "";
      if (provided.trim() !== expectedToken) {
        return NextResponse.json(
          { error: "Token de webhook inválido." },
          { status: 401 }
        );
      }
    }

    const body = (await req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const { phone, text, fromMe } = extractIncomingPhoneAndText(body);

    if (fromMe || phone.length < 8) {
      return NextResponse.json({ ignored: true });
    }

    const tail8 = phone.slice(-8);
    const matchedLead = store.leads.find(
      (l) => !l.archived && normalizePhone(l.phone).endsWith(tail8)
    );

    if (!matchedLead) {
      return NextResponse.json({ matched: false, phone });
    }

    const updated = await updateLead(
      matchedLead.id,
      {
        respondeu: true,
        automacaoAtiva: false,
      },
      {
        type: "whatsapp",
        title: "Cliente respondeu no WhatsApp (Follow-up pausado)",
        description: text
          ? `Mensagem recebida: "${text.slice(0, 220)}"`
          : "Resposta recebida via WhatsApp. Régua automática pausada.",
      },
      true
    );

    await sendAdminPushNotification({
      title: `WhatsApp: ${matchedLead.companyName} respondeu`,
      body: text ? text.slice(0, 120) : "Nova mensagem recebida. Follow-up pausado automaticamente.",
      url: `/clientes/${matchedLead.id}`,
      tag: `wa-reply-${matchedLead.id}`,
    }).catch(() => {});

    await emitOutgoingWebhook(store.settings, "whatsapp.replied", {
      leadId: matchedLead.id,
      companyName: matchedLead.companyName,
      phone,
      text: text.slice(0, 300),
    });

    return NextResponse.json({
      matched: true,
      leadId: updated?.id ?? matchedLead.id,
      followupPaused: true,
    });
  } catch {
    return NextResponse.json(
      { error: "Erro ao processar webhook de WhatsApp." },
      { status: 500 }
    );
  }
}
