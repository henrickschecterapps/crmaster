import { NextRequest, NextResponse } from "next/server";
import {
  createLead,
  createLeadsBulk,
  CreateLeadInput,
  getSettingsOnly,
  getStoreData,
} from "@/lib/repository";
import { requireAdminApiAuth } from "@/lib/apiGuard";
import { emitOutgoingWebhook } from "@/lib/automationHelpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authErr = await requireAdminApiAuth(req);
  if (authErr) return authErr;
  const store = await getStoreData();
  return NextResponse.json({ leads: store.leads });
}

export async function POST(req: NextRequest) {
  const authErr = await requireAdminApiAuth(req);
  if (authErr) return authErr;
  try {
    const body = await req.json();

    if (Array.isArray(body.leads)) {
      const result = await createLeadsBulk(body.leads as CreateLeadInput[]);
      return NextResponse.json(result, { status: 201 });
    }

    const input = body as CreateLeadInput;
    if (!input.companyName || !input.phone) {
      return NextResponse.json(
        { error: "Nome da empresa e telefone são obrigatórios." },
        { status: 400 }
      );
    }

    const result = await createLead(input);
    if (!result.duplicate && result.lead) {
      const settings = await getSettingsOnly().catch(() => null);
      await emitOutgoingWebhook(settings, "lead.created", {
        leadId: result.lead.id,
        companyName: result.lead.companyName,
        contactName: result.lead.contactName,
        funnel: result.lead.funnel,
        stage: result.lead.stage,
        estimatedValue: result.lead.estimatedValue,
      }).catch(() => {});
    }
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível criar o lead." },
      { status: 500 }
    );
  }
}
