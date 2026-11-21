import { NextRequest, NextResponse } from "next/server";
import {
  approveProposal,
  getStoreData,
  ProposalApprovalPayload,
} from "@/lib/repository";
import { generatePixQrDataUrl, generateStaticPixPayload } from "@/lib/pix";

export const dynamic = "force-dynamic";

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

    const updated = await approveProposal(leadId, body);
    if (!updated) {
      return NextResponse.json(
        { error: "Lead não encontrado." },
        { status: 404 }
      );
    }

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
