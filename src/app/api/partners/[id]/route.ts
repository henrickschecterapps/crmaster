import { NextRequest, NextResponse } from "next/server";
import { deletePartner, updatePartner } from "@/lib/repository";
import { requireAdminApiAuth } from "@/lib/apiGuard";
import { Partner } from "@/types/crm";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authErr = await requireAdminApiAuth(req);
  if (authErr) return authErr;
  try {
    const { id } = await context.params;
    const body = (await req.json()) as Partial<Omit<Partner, "id" | "createdAt">>;
    const updated = await updatePartner(id, body);
    if (!updated) {
      return NextResponse.json(
        { error: "Parceiro não encontrado." },
        { status: 404 }
      );
    }
    return NextResponse.json({ partner: updated });
  } catch {
    return NextResponse.json(
      { error: "Erro ao atualizar parceiro." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authErr = await requireAdminApiAuth(req);
  if (authErr) return authErr;
  const { id } = await context.params;
  const ok = await deletePartner(id);
  if (!ok) {
    return NextResponse.json(
      { error: "Parceiro não encontrado." },
      { status: 404 }
    );
  }
  return NextResponse.json({ deleted: true });
}
