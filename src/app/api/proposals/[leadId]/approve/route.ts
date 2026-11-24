import { NextRequest, NextResponse } from "next/server";
import {
  approveProposal,
  getSettingsOnly,
  ProposalApprovalPayload,
  updateLead,
} from "@/lib/repository";
import { generatePixQrDataUrl, generateStaticPixPayload } from "@/lib/pix";
import { sendEmailNotification } from "@/lib/email";
import { sendAdminPushNotification } from "@/lib/webPush";
import {
  buildBrandedEmailHtml,
  emitOutgoingWebhook,
  getPublicAppUrl,
} from "@/lib/automationHelpers";
import { formatCurrencyExact, formatDateBr } from "@/lib/utils";
import { AcceptanceCertificate, DEFAULT_AUTOMATION_SETTINGS } from "@/types/crm";

export const dynamic = "force-dynamic";

async function computeAcceptanceHash(input: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24)
    .toUpperCase();
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await context.params;
    const body = (await req.json()) as ProposalApprovalPayload;

    if ((!body.cnpj && !body.cpf) || !body.razaoSocial || !body.eventDate) {
      return NextResponse.json(
        {
          error:
            "Documento (CNPJ ou CPF), Nome/Razão Social e Data são obrigatórios.",
        },
        { status: 400 }
      );
    }

    const updatedBase = await approveProposal(leadId, body);
    if (!updatedBase) {
      return NextResponse.json(
        { error: "Lead não encontrado." },
        { status: 404 }
      );
    }

    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";
    const acceptedAt = new Date().toISOString();
    const signerDocument = body.cnpj || body.cpf || "";
    const hash = await computeAcceptanceHash(
      `${leadId}|${body.razaoSocial}|${signerDocument}|${body.totalValue}|${acceptedAt}|${ipAddress}`
    );
    const acceptanceCertificate: AcceptanceCertificate = {
      signerName: body.razaoSocial,
      signerDocument,
      acceptedAt,
      ipAddress,
      hash,
    };

    const updated =
      (await updateLead(leadId, { acceptanceCertificate })) ?? {
        ...updatedBase,
        acceptanceCertificate,
      };

    const settings = await getSettingsOnly();
    const autoCfg = {
      ...DEFAULT_AUTOMATION_SETTINGS,
      ...(settings.automation ?? {}),
    };
    const appUrl = getPublicAppUrl();
    const portalUrl = `${appUrl}/portal/${updated.id}`;
    const depositAmount = Number((body.totalValue * 0.5).toFixed(2));
    const pixKey =
      settings.pixKey ||
      process.env.NEXT_PUBLIC_PIX_KEY ||
      "ultimoquadrofilmes@gmail.com";

    const pixCopyPaste = generateStaticPixPayload({
      pixKey,
      recipientName: settings.pixRecipientName || "Ultimo Quadro",
      city: settings.pixCity || "BELO HORIZONTE",
      amount: depositAmount,
      txId: `UQ${updated.id.slice(-8)}`,
      description: `SINAL 50 ${updated.companyName.slice(0, 18)}`,
    });

    const pixQrDataUrl = await generatePixQrDataUrl(pixCopyPaste);

    await sendAdminPushNotification({
      title: `Proposta Aprovada: ${updated.companyName}`,
      body: `Escopo ${body.packageName} · R$ ${body.totalValue.toLocaleString("pt-BR")} · Data ${formatDateBr(body.eventDate)}.`,
      url: `/clientes/${updated.id}`,
      tag: `approved-${updated.id}`,
    }).catch(() => {});

    // Notify Admin by email + send automatic confirmation email to Client
    const adminEmail = (settings.adminEmail || process.env.ADMIN_EMAIL || "").trim();
    if (adminEmail) {
      const adminText = `A proposta de ${updated.companyName} foi aprovada!\n\nPacote: ${body.packageName}\nValor total: ${formatCurrencyExact(body.totalValue)}\nSinal (50%): ${formatCurrencyExact(depositAmount)}\nData reservada: ${formatDateBr(body.eventDate)}\nSignatário: ${body.razaoSocial} (${signerDocument})\nHash SHA-256: ${hash}`;
      await sendEmailNotification({
        to: adminEmail,
        subject: `[FECHAMENTO] Proposta aprovada: ${updated.companyName} (${formatCurrencyExact(body.totalValue)})`,
        text: adminText,
        html: buildBrandedEmailHtml({
          kicker: "ÚLTIMO QUADRO · Nova Aprovação",
          headline: `${updated.companyName} aprovou a proposta`,
          bodyText: adminText,
          ctaLabel: "Abrir Página do Cliente",
          ctaUrl: `${appUrl}/clientes/${updated.id}`,
        }),
      }).catch(() => {});
    }

    if (autoCfg.enableApprovalClientEmail && updated.email) {
      const firstName = updated.contactName?.split(" ")[0] || updated.contactName;
      const clientText = `Olá ${firstName},\n\nRecebemos a aprovação do projeto da ${updated.companyName} com a ÚLTIMO QUADRO.\n\nResumo do escopo aprovado:\n- Pacote: ${body.packageName}\n- Data prevista: ${formatDateBr(body.eventDate)}\n- Investimento total: ${formatCurrencyExact(body.totalValue)}\n- Sinal de reserva (50% via Pix): ${formatCurrencyExact(depositAmount)}\n- Código do Aceite Eletrônico: ${hash}\n\nO seu Contrato PDF, o QR Code Pix e a aba para agendar a reunião de alinhamento já estão disponíveis no Portal do Projeto:\n${portalUrl}\n\nSerá um prazer produzir este projeto com vocês.`;
      await sendEmailNotification({
        to: updated.email,
        subject: `Confirmação de escopo & Contrato PDF | ${updated.companyName} | ÚLTIMO QUADRO`,
        text: clientText,
        html: buildBrandedEmailHtml({
          kicker: "ÚLTIMO QUADRO · Confirmação de Projeto",
          headline: `Escopo aprovado para ${updated.companyName}`,
          bodyText: clientText,
          ctaLabel: "Acessar Portal, Contrato PDF e Pix",
          ctaUrl: portalUrl,
        }),
      }).catch(() => {});
    }

    await emitOutgoingWebhook(settings, "proposal.approved", {
      leadId: updated.id,
      companyName: updated.companyName,
      packageName: body.packageName,
      totalValue: body.totalValue,
      eventDate: body.eventDate,
      acceptanceHash: hash,
    });

    return NextResponse.json({
      approved: true,
      lead: updated,
      pdfUrl: `/api/proposals/${updated.id}/pdf`,
      pdfFileName: updated.contractDocument?.fileName,
      pix: {
        key: pixKey,
        recipientName: settings.pixRecipientName || "Ultimo Quadro",
        city: settings.pixCity || "BELO HORIZONTE",
        depositAmount,
        copyPaste: pixCopyPaste,
        qrDataUrl: pixQrDataUrl,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível registrar a aprovação da proposta." },
      { status: 500 }
    );
  }
}
