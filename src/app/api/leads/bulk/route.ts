import { NextRequest, NextResponse } from "next/server";
import { getStoreData, updateLead } from "@/lib/repository";
import { requireAdminApiAuth } from "@/lib/apiGuard";
import { Lead, LostReasonId, StageId } from "@/types/crm";

export const dynamic = "force-dynamic";

interface BulkActionBody {
  leadIds: string[];
  action: "move_stage" | "assign_partner" | "archive" | "restore";
  stage?: StageId;
  partnerId?: string | null;
  lostReason?: LostReasonId;
}

export async function POST(req: NextRequest) {
  const authErr = await requireAdminApiAuth(req);
  if (authErr) return authErr;

  try {
    const body = (await req.json()) as BulkActionBody;
    const ids = Array.isArray(body.leadIds) ? body.leadIds.filter(Boolean) : [];
    if (ids.length === 0) {
      return NextResponse.json(
        { error: "Selecione ao menos um lead para ação em lote." },
        { status: 400 }
      );
    }

    const updatedLeads: Lead[] = [];
    const now = new Date().toISOString();

    for (const id of ids) {
      let patch: Partial<Lead> = {};
      let title = "Atualização em lote";
      let description = "";

      if (body.action === "move_stage" && body.stage) {
        patch = { stage: body.stage, archived: false };
        title = `Etapa alterada em lote para ${body.stage}`;
        description = "Ação em massa na lista do pipeline.";
      } else if (body.action === "assign_partner") {
        patch = { partnerId: body.partnerId || null };
        title = body.partnerId
          ? "Parceiro vinculado em lote"
          : "Parceiro removido em lote";
        description = "Ação em massa na lista do pipeline.";
      } else if (body.action === "archive") {
        patch = {
          archived: true,
          lostReason: body.lostReason || "sem_resposta",
          archivedAt: now,
          automacaoAtiva: false,
        };
        title = "Lead marcado como Perdido / Arquivado (lote)";
        description = `Motivo: ${body.lostReason || "sem_resposta"}.`;
      } else if (body.action === "restore") {
        patch = { archived: false, archivedAt: null };
        title = "Lead reativado para o pipeline (lote)";
        description = "Restaurado via ação em massa.";
      } else {
        continue;
      }

      const updated = await updateLead(
        id,
        patch,
        { type: "sistema", title, description },
        false
      );
      if (updated) updatedLeads.push(updated);
    }

    const store = await getStoreData();
    return NextResponse.json({
      updatedCount: updatedLeads.length,
      leads: store.leads,
    });
  } catch {
    return NextResponse.json(
      { error: "Erro ao executar ação em lote." },
      { status: 500 }
    );
  }
}
