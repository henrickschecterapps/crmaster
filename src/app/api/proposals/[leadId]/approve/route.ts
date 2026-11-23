import { NextRequest, NextResponse } from "next/server";
import {
  approveProposal,
  getStoreData,
  ProposalApprovalPayload,
  updateLead,
} from "@/lib/repository";
import { generatePixQrDataUrl, generateStaticPixPayload } from "@/lib/pix";
import { sendAdminPushNotification } from "@/lib/webPush";
import { AcceptanceCertificate } from "@/types/crm";

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

    await sendAdminPushNotification({
      title: `Proposta Aprovada: ${updated.companyName}`,
      body: `Escopo ${body.packageName} · R$ ${body.totalValue.toLocaleString("pt-BR")} · Data ${body.eventDate}.`,
      url: `/clientes/${updated.id}`,
      tag: `approved-${updated.id}`,
    }).catch(() => {});

    const store = await getStoreData();
    const depositAmount = Number((body.totalValue * 0.5).toFixed(2));
    const pixKey =
      store.settings.pixKey ||
      process.env.NEXT_PUBLIC_PIX_KEY ||
      "ultimoquadrofilmes@gmail.com";

    const pixCopyPaste = generateStaticPixPayload({
      pixKey,
      recipientName: store.settings.pixRecipientName || "Ultimo Quadro",
      city: store.settings.pixCity || "BELO HORIZONTE",
      amount: depositAmount,
      txId: `UQ${updated.id.slice(-8)}`,
      description: `SINAL 50 ${updated.companyName.slice(0, 18)}`,
    });

    const pixQrDataUrl = await generatePixQrDataUrl(pixCopyPaste);

    return NextResponse.json({
      approved: true,
      lead: updated,
      pdfUrl: `/api/proposals/${updated.id}/pdf`,
      pdfFileName: updated.contractDocument?.fileName,
      pix: {
        key: pixKey,
        recipientName: store.settings.pixRecipientName || "Ultimo Quadro",
        city: store.settings.pixCity || "BELO HORIZONTE",
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
