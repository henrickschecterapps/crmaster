import { NextRequest, NextResponse } from "next/server";
import { updateSettings } from "@/lib/repository";
import { getIntegrationStatus } from "@/lib/supabase";
import { StudioSettings } from "@/types/crm";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<StudioSettings>;
    const settings = await updateSettings(body);
    const status = getIntegrationStatus(settings);
    return NextResponse.json({ settings, status });
  } catch {
    return NextResponse.json(
      { error: "Erro ao atualizar configurações." },
      { status: 500 }
    );
  }
}
