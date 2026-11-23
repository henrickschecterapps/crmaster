import { NextRequest, NextResponse } from "next/server";
import { getStoreData, restoreStoreData } from "@/lib/repository";
import { requireAdminApiAuth } from "@/lib/apiGuard";
import { CrmStoreData } from "@/types/crm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authErr = await requireAdminApiAuth(req);
  if (authErr) return authErr;

  const store = await getStoreData();
  const payload = {
    version: "crmaster-backup-v1",
    exportedAt: new Date().toISOString(),
    data: store,
  };

  const dateSlug = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="ultimo-quadro-backup-${dateSlug}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(req: NextRequest) {
  const authErr = await requireAdminApiAuth(req);
  if (authErr) return authErr;

  try {
    const raw = (await req.json()) as {
      data?: CrmStoreData;
      leads?: CrmStoreData["leads"];
    };
    const candidate: CrmStoreData | null =
      raw?.data && Array.isArray(raw.data.leads)
        ? raw.data
        : Array.isArray(raw?.leads)
        ? (raw as unknown as CrmStoreData)
        : null;

    if (!candidate || !Array.isArray(candidate.leads)) {
      return NextResponse.json(
        { error: "Arquivo de backup inválido. Esperado JSON exportado pelo CRM." },
        { status: 400 }
      );
    }

    const restored = await restoreStoreData(candidate);
    return NextResponse.json({
      restored: true,
      counts: {
        leads: restored.leads.length,
        partners: restored.partners.length,
        templates: restored.templates.length,
      },
      data: restored,
    });
  } catch {
    return NextResponse.json(
      { error: "Falha ao restaurar o arquivo de backup." },
      { status: 500 }
    );
  }
}
