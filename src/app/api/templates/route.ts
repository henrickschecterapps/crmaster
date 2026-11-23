import { NextRequest, NextResponse } from "next/server";
import { getStoreData, upsertTemplate } from "@/lib/repository";
import { requireAdminApiAuth } from "@/lib/apiGuard";
import { ScriptTemplate } from "@/types/crm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authErr = await requireAdminApiAuth(req);
  if (authErr) return authErr;
  const store = await getStoreData();
  return NextResponse.json({ templates: store.templates });
}

export async function POST(req: NextRequest) {
  const authErr = await requireAdminApiAuth(req);
  if (authErr) return authErr;
  try {
    const body = (await req.json()) as Omit<
      ScriptTemplate,
      "id" | "createdAt" | "updatedAt"
    > & { id?: string };

    if (!body.name || !body.body) {
      return NextResponse.json(
        { error: "Nome e conteúdo do template são obrigatórios." },
        { status: 400 }
      );
    }

    const template = await upsertTemplate(body);
    return NextResponse.json({ template }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Erro ao salvar template." },
      { status: 500 }
    );
  }
}
