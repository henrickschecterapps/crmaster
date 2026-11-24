import { NextRequest, NextResponse } from "next/server";
import { getLeadById, getSettingsOnly } from "@/lib/repository";
import { requireAdminApiAuth } from "@/lib/apiGuard";
import {
  buildContextualFollowupMessage,
  getPublicAppUrl,
  getVerticalContextHook,
} from "@/lib/automationHelpers";
import { getFunnelLabel, getStageLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authErr = await requireAdminApiAuth(req);
  if (authErr) return authErr;

  try {
    const body = (await req.json()) as {
      leadId?: string;
      channel?: "whatsapp" | "email";
      goal?: string;
    };

    if (!body.leadId) {
      return NextResponse.json(
        { error: "leadId é obrigatório." },
        { status: 400 }
      );
    }

    const [lead, settings] = await Promise.all([
      getLeadById(body.leadId),
      getSettingsOnly(),
    ]);

    if (!lead) {
      return NextResponse.json(
        { error: "Cliente não encontrado." },
        { status: 404 }
      );
    }

    const portalUrl = `${getPublicAppUrl()}/portal/${lead.id}`;
    const channel = body.channel === "email" ? "email" : "whatsapp";
    const geminiKey = process.env.GEMINI_API_KEY?.trim();

    if (!geminiKey) {
      const fallback = buildContextualFollowupMessage({
        lead,
        step: lead.followupStep >= 1 ? "dia_5" : "dia_2",
        portalUrl,
        nextAvailableDate: settings.nextAvailableDate || "próxima semana",
      });
      return NextResponse.json({
        mode: "smart_template",
        source: "template",
        subject: fallback.subject,
        message: fallback.body,
        body: fallback.body,
        hint: "Defina GEMINI_API_KEY na Vercel para geração dinâmica via Gemini AI.",
      });
    }

    const recentNotes = (lead.interactions ?? [])
      .slice(0, 4)
      .map((i) => `- ${i.title}: ${i.description}`)
      .join("\n");

    const prompt = `Você escreve mensagens comerciais curtas, humanas e elegantes em nome da produtora audiovisual ÚLTIMO QUADRO (Belo Horizonte e Nova Lima, MG).
REGRAS OBRIGATÓRIAS:
- NUNCA assine com nomes pessoais de pessoas físicas ou sócios. Assine sempre como equipe da ÚLTIMO QUADRO.
- NUNCA use travessão longo, emojis exagerados, jargão robótico ("hooks 3s", "proposta interativa transparente") nem clichês de spam ("passando rapidamente").
- Escreva como um produtor executivo real escrevendo no ${channel === "whatsapp" ? "WhatsApp (máx 4 parágrafos curtos)" : "e-mail (conciso e direto)"}.
- Inclua obrigatoriamente este link do portal: ${portalUrl}

DADOS DO CLIENTE:
- Empresa: ${lead.companyName}
- Contato: ${lead.contactName} (${lead.contactRole || "Decisor"})
- Vertical: ${getFunnelLabel(lead.funnel)} (${getVerticalContextHook(lead.funnel)})
- Etapa atual: ${getStageLabel(lead.stage)}
- Acessos ao portal: ${lead.visualizacoesProposta}x
- Valor estimado: R$ ${lead.estimatedValue}
- Próxima janela livre: ${settings.nextAvailableDate}
- Objetivo pedido: ${body.goal || "Retomada consultiva para avançar fechamento sem pressão"}
- Notas internas: ${lead.notes || "Nenhuma"}
- Histórico recente:
${recentNotes || "Sem histórico anterior"}

Retorne APENAS um JSON válido com as chaves "subject" (assunto curto de e-mail) e "message" (texto pronto para envio).`;

    const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
    const apiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!apiRes.ok) {
      const fallback = buildContextualFollowupMessage({
        lead,
        step: lead.followupStep >= 1 ? "dia_5" : "dia_2",
        portalUrl,
        nextAvailableDate: settings.nextAvailableDate || "próxima semana",
      });
      return NextResponse.json({
        mode: "smart_template_fallback",
        source: "template",
        subject: fallback.subject,
        message: fallback.body,
        body: fallback.body,
      });
    }

    const aiJson = (await apiRes.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const rawText = aiJson.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const parsed = JSON.parse(rawText) as { subject?: string; message?: string };
    const cleanText = (parsed.message || "").replaceAll("\u2014", "-").trim();

    return NextResponse.json({
      mode: "gemini_live",
      source: "gemini",
      subject:
        parsed.subject?.trim() ||
        `Sobre o projeto da ${lead.companyName} | ÚLTIMO QUADRO`,
      message: cleanText,
      body: cleanText,
    });
  } catch {
    return NextResponse.json(
      { error: "Erro ao gerar mensagem personalizada." },
      { status: 500 }
    );
  }
}
