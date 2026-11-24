import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/apiGuard";
import { createInitialSeedData } from "@/lib/seed";
import { getStoreData, upsertTemplate } from "@/lib/repository";

export const dynamic = "force-dynamic";

/**
 * Updates all standard default templates (`tpl-*`) in Firestore/local store to the latest
 * ÚLTIMO QUADRO human copy without deleting any custom templates created by the user.
 */
export async function POST(req: NextRequest) {
  const authErr = await requireAdminApiAuth(req);
  if (authErr) return authErr;

  try {
    const seedTemplates = createInitialSeedData().templates;
    for (const tpl of seedTemplates) {
      await upsertTemplate({
        id: tpl.id,
        name: tpl.name,
        funnel: tpl.funnel,
        channel: tpl.channel,
        subject: tpl.subject,
        body: tpl.body,
      });
    }
    const store = await getStoreData();
    return NextResponse.json({
      updated: seedTemplates.length,
      templates: store.templates,
    });
  } catch {
    return NextResponse.json(
      { error: "Falha ao atualizar templates padrão." },
      { status: 500 }
    );
  }
}
