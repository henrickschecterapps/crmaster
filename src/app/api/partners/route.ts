import { NextRequest, NextResponse } from "next/server";
import { createPartner, getStoreData } from "@/lib/repository";
import { Partner } from "@/types/crm";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = await getStoreData();
  return NextResponse.json({ partners: store.partners });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Omit<Partner, "id" | "createdAt">;
    if (!body.name) {
      return NextResponse.json(
        { error: "Nome do parceiro é obrigatório." },
        { status: 400 }
      );
    }
    const partner = await createPartner(body);
    return NextResponse.json({ partner }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Erro ao cadastrar parceiro." },
      { status: 500 }
    );
  }
}
