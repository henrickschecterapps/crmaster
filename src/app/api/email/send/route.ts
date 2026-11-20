import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getLeadById, updateLead } from "@/lib/repository";

export const dynamic = "force-dynamic";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildEmailHtml(params: {
  companyName: string;
  body: string;
  proposalUrl: string;
}): string {
  const paragraphs = params.body
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;color:#d4d4d8;font-size:15px;line-height:1.65;">${escapeHtml(
          p
        ).replaceAll("\n", "<br/>")}</p>`
    )
    .join("");

  return `
    <div style="background:#09090b;padding:36px 20px;font-family:'Plus Jakarta Sans',Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;background:#111114;border:1px solid #27272a;border-radius:16px;padding:32px;">
        <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#e5a93b;margin-bottom:10px;font-weight:700;">
          Henrique Matos — Fotografia &amp; Audiovisual BH
        </div>
        <h2 style="margin:0 0 20px;color:#fafafa;font-size:20px;font-weight:600;">
          Proposta Comercial — ${escapeHtml(params.companyName)}
        </h2>
        ${paragraphs}
        <div style="margin-top:26px;">
          <a href="${escapeHtml(params.proposalUrl)}" style="display:inline-block;background:#e5a93b;color:#09090b;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px;">
            Abrir Proposta Interativa
          </a>
        </div>
        <hr style="border:none;border-top:1px solid #27272a;margin:28px 0 18px;" />
        <p style="margin:0;color:#71717a;font-size:12px;">
          Henrique Matos Studio · Belo Horizonte, MG · Fotografia Corporativa, Catálogo &amp; Audiovisual
        </p>
      </div>
    </div>
  `;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      leadId: string;
      to: string;
      subject: string;
      message: string;
      proposalUrl: string;
    };

    if (!body.leadId || !body.to || !body.subject || !body.message) {
      return NextResponse.json(
        { error: "Destinatário, assunto e mensagem são obrigatórios." },
        { status: 400 }
      );
    }

    const lead = await getLeadById(body.leadId);
    if (!lead) {
      return NextResponse.json(
        { error: "Lead não encontrado." },
        { status: 404 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail =
      process.env.RESEND_FROM_EMAIL ||
      "Henrique Matos Studio <onboarding@resend.dev>";

    let mode: "live" | "simulated" = "simulated";
    let providerId: string | undefined;

    if (apiKey) {
      const resend = new Resend(apiKey);
      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: [body.to],
        subject: body.subject,
        text: body.message,
        html: buildEmailHtml({
          companyName: lead.companyName,
          body: body.message,
          proposalUrl: body.proposalUrl,
        }),
      });

      if (error) {
        return NextResponse.json(
          { error: `Falha no envio via Resend: ${error.message}` },
          { status: 502 }
        );
      }

      mode = "live";
      providerId = data?.id;
    }

    const nextStage = lead.stage === "captado" ? "contatado" : lead.stage;
    const updatedLead = await updateLead(
      lead.id,
      { stage: nextStage },
      {
        type: "email",
        title:
          mode === "live"
            ? `E-mail enviado via Resend (${body.to})`
            : `E-mail disparado em modo simulação (${body.to})`,
        description: `Assunto: ${body.subject}. Link rastreável incluído: ${body.proposalUrl}`,
      },
      true
    );

    return NextResponse.json({
      sent: true,
      mode,
      providerId,
      lead: updatedLead,
    });
  } catch {
    return NextResponse.json(
      { error: "Erro interno ao enviar e-mail." },
      { status: 500 }
    );
  }
}
