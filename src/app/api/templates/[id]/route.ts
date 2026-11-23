import { NextRequest, NextResponse } from "next/server";
import { deleteTemplate } from "@/lib/repository";
import { requireAdminApiAuth } from "@/lib/apiGuard";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authErr = await requireAdminApiAuth(req);
  if (authErr) return authErr;
  const { id } = await context.params;
  const ok = await deleteTemplate(id);
  if (!ok) {
    return NextResponse.json(
      { error: "Template não encontrado." },
      { status: 404 }
    );
  }
  return NextResponse.json({ deleted: true });
}
