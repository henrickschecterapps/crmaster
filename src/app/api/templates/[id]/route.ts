import { NextRequest, NextResponse } from "next/server";
import { deleteTemplate } from "@/lib/repository";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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
