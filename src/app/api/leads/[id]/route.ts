import { NextRequest, NextResponse } from "next/server";
import { deleteLead, getLeadById, updateLead } from "@/lib/repository";
import { InteractionType, Lead } from "@/types/crm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const lead = await getLeadById(id);
  if (!lead) {
    return NextResponse.json(
      { error: "Lead não encontrado." },
      { status: 404 }
    );
  }
  return NextResponse.json({ lead });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { patch, interaction, touchLastInteraction } = body as {
      patch?: Partial<Lead>;
      interaction?: {
        type: InteractionType;
        title: string;
        description: string;
      };
      touchLastInteraction?: boolean;
    };

    const updated = await updateLead(
      id,
      patch ?? {},
      interaction,
      touchLastInteraction ?? true
    );

    if (!updated) {
      return NextResponse.json(
        { error: "Lead não encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json({ lead: updated });
  } catch {
    return NextResponse.json(
      { error: "Erro ao atualizar lead." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const ok = await deleteLead(id);
  if (!ok) {
    return NextResponse.json(
      { error: "Lead não encontrado." },
      { status: 404 }
    );
  }
  return NextResponse.json({ deleted: true });
}
