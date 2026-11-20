import { NextRequest, NextResponse } from "next/server";
import {
  createLead,
  createLeadsBulk,
  CreateLeadInput,
  getStoreData,
} from "@/lib/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = await getStoreData();
  return NextResponse.json({ leads: store.leads });
}

export async function POST(req: NextRequest) {
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
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível criar o lead." },
      { status: 500 }
    );
  }
}
