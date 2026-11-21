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
    <div style="background:#0C0C0C;padding:36px 20px;font-family:'Montserrat',Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;background:#121212;border:1px solid rgba(245,245,245,0.1);border-radius:16px;padding:32px;">
        <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#CC551E;margin-bottom:8px;font-weight:800;">
          ÚLTIMO QUADRO · Fotografia Autoral &amp; Audiovisual 4K
        </div>
        <h2 style="margin:0 0 20px;color:#F5F5F5;font-size:20px;font-weight:700;">
          Proposta Exclusiva — ${escapeHtml(params.companyName)}
        </h2>
        ${paragraphs}
        <div style="margin-top:26px;">
          <a href="${escapeHtml(params.proposalUrl)}" style="display:inline-block;background:#CC551E;color:#F5F5F5;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:0.04em;padding:13px 24px;border-radius:10px;">
            Abrir Proposta Interativa
          </a>
        </div>
        <hr style="border:none;border-top:1px solid rgba(245,245,245,0.08);margin:28px 0 18px;" />
        <p style="margin:0;color:#787878;font-size:11px;">
          ÚLTIMO QUADRO · A história termina. A imagem fica. · Belo Horizonte &amp; Nova Lima, MG · (31) 98399-7195
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
      "ÚLTIMO QUADRO <onboarding@resend.dev>";

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
