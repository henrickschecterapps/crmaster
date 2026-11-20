import { NextRequest, NextResponse } from "next/server";
import { getLeadById } from "@/lib/repository";
import { generateLeadContractPdf } from "@/lib/pdfGenerator";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await context.params;
    const lead = await getLeadById(leadId);

    if (!lead) {
      return NextResponse.json(
        { error: "Lead não encontrado para geração do PDF." },
        { status: 404 }
      );
    }

    const { bytes, fileName } = await generateLeadContractPdf(lead);

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Falha ao gerar o documento PDF." },
      { status: 500 }
    );
  }
}
