import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import { getLeadById, updateLead } from "@/lib/repository";
import { requireAdminApiAuth } from "@/lib/apiGuard";
import { getPublicAppUrl } from "@/lib/automationHelpers";

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
      <div style="max-width:600px;margin:0 auto;background:#121212;border:1px solid rgba(245,245,245,0.1);border-radius:12px;padding:32px;">
        <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#EA7845;margin-bottom:8px;font-weight:800;">
          ÚLTIMO QUADRO · Fotografia Autoral &amp; Audiovisual 4K
        </div>
        <h2 style="margin:0 0 20px;color:#F5F5F5;font-size:20px;font-weight:700;">
          Proposta Exclusiva: ${escapeHtml(params.companyName)}
        </h2>
        ${paragraphs}
        <div style="margin-top:26px;">
          <a href="${escapeHtml(params.proposalUrl)}" style="display:inline-block;background:#B54512;color:#F5F5F5;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:0.04em;padding:13px 24px;border-radius:8px;">
            Abrir Proposta Interativa
          </a>
        </div>
        <hr style="border:none;border-top:1px solid rgba(245,245,245,0.08);margin:28px 0 18px;" />
        <p style="margin:0;color:#969696;font-size:11px;">
          ÚLTIMO QUADRO · A história termina. A imagem fica. · Belo Horizonte e Nova Lima, MG · (31) 98399-7195
        </p>
      </div>
    </div>
  `;
}

async function sendViaGmailSmtp(params: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const user = process.env.GMAIL_USER?.trim().replace(/^["']|["']$/g, "");
  const pass = process.env.GMAIL_APP_PASSWORD?.trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, "");
  if (!user || !pass) return { ok: false, error: "Gmail SMTP não configurado." };

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
    const info = await transporter.sendMail({
      from: `ÚLTIMO QUADRO <${user}>`,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro ao enviar via Gmail SMTP.",
    };
  }
}

export async function POST(req: NextRequest) {
  const authErr = await requireAdminApiAuth(req);
  if (authErr) return authErr;

  try {
    const body = (await req.json()) as {
      leadId: string;
      to: string;
      subject: string;
      message?: string;
      body?: string;
      proposalUrl?: string;
    };

    const resolvedMessage = (body.message || body.body || "").trim();
    const resolvedProposalUrl =
      body.proposalUrl || `${getPublicAppUrl()}/portal/${body.leadId}`;

    if (!body.leadId || !body.to || !body.subject || !resolvedMessage) {
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

    const html = buildEmailHtml({
      companyName: lead.companyName,
      body: resolvedMessage,
      proposalUrl: resolvedProposalUrl,
    });

    const gmailConfigured = Boolean(
      process.env.GMAIL_USER?.trim() && process.env.GMAIL_APP_PASSWORD?.trim()
    );
    const resendKey = process.env.RESEND_API_KEY?.trim();
    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "ÚLTIMO QUADRO <onboarding@resend.dev>";

    let mode: "resend" | "gmail" | "simulated" = "simulated";
    let providerId: string | undefined;

    // Prefer Gmail SMTP when configured and Resend is still using sandbox sender
    const usingResendSandbox = fromEmail.includes("onboarding@resend.dev");

    if (gmailConfigured && (!resendKey || usingResendSandbox)) {
      const gmailRes = await sendViaGmailSmtp({
        to: body.to,
        subject: body.subject,
        text: resolvedMessage,
        html,
      });
      if (!gmailRes.ok) {
        return NextResponse.json(
          { error: `Falha no envio via Gmail SMTP: ${gmailRes.error}` },
          { status: 502 }
        );
      }
      mode = "gmail";
      providerId = gmailRes.messageId;
    } else if (resendKey) {
      const resend = new Resend(resendKey);
      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: [body.to],
        subject: body.subject,
        text: resolvedMessage,
        html,
      });

      if (error) {
        // Automatic fallback to Gmail SMTP if Resend sandbox rejected an external recipient
        if (gmailConfigured) {
          const gmailRes = await sendViaGmailSmtp({
            to: body.to,
            subject: body.subject,
            text: resolvedMessage,
            html,
          });
          if (gmailRes.ok) {
            mode = "gmail";
            providerId = gmailRes.messageId;
          } else {
            return NextResponse.json(
              { error: `Falha no envio: ${error.message}` },
              { status: 502 }
            );
          }
        } else {
          return NextResponse.json(
            { error: `Falha no envio via Resend: ${error.message}` },
            { status: 502 }
          );
        }
      } else {
        mode = "resend";
        providerId = data?.id;
      }
    }

    const nextStage = lead.stage === "captado" ? "contatado" : lead.stage;
    const providerLabel =
      mode === "gmail"
        ? "Gmail SMTP"
        : mode === "resend"
        ? "Resend API"
        : "Modo Simulação";

    const updatedLead = await updateLead(
      lead.id,
      { stage: nextStage },
      {
        type: "email",
        title: `E-mail enviado via ${providerLabel} (${body.to})`,
        description: `Assunto: ${body.subject}. Link rastreável incluído: ${resolvedProposalUrl}`,
      },
      true
    );

    return NextResponse.json({
      sent: true,
      mode: mode === "simulated" ? "simulated" : "live",
      provider: mode,
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
