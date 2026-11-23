import { NextRequest, NextResponse } from "next/server";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirebaseApp, isFirebaseConfigured } from "@/lib/firebase";
import { getLeadById } from "@/lib/repository";
import { requireAdminApiAuth } from "@/lib/apiGuard";

export const dynamic = "force-dynamic";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      dataUrl?: string;
      folder?: "thumbnails" | "receipts";
      leadId?: string;
      pin?: string;
      fileName?: string;
    };

    const folder = body.folder === "receipts" ? "receipts" : "thumbnails";

    // Receipts can be uploaded by authenticated portal clients (verified by leadId + optional PIN); thumbnails require admin auth
    if (folder === "thumbnails") {
      const authErr = await requireAdminApiAuth(req);
      if (authErr) return authErr;
    } else {
      if (!body.leadId) {
        return NextResponse.json(
          { error: "leadId obrigatório para enviar comprovante." },
          { status: 400 }
        );
      }
      const lead = await getLeadById(body.leadId);
      if (!lead) {
        return NextResponse.json(
          { error: "Projeto não encontrado." },
          { status: 404 }
        );
      }
      if (lead.portalPin && (body.pin || "").trim() !== lead.portalPin.trim()) {
        return NextResponse.json(
          { error: "PIN obrigatório para enviar comprovante." },
          { status: 401 }
        );
      }
    }

    const dataUrl = (body.dataUrl || "").trim();
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      return NextResponse.json(
        { error: "Envie uma imagem válida (JPG, PNG ou WebP)." },
        { status: 400 }
      );
    }

    const mime = match[1].toLowerCase();
    if (!ALLOWED_MIME.has(mime)) {
      return NextResponse.json(
        { error: "Formato não suportado. Use JPG, PNG ou WebP." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(match[2], "base64");
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json(
        { error: "Imagem excede o limite de 2 MB após compressão." },
        { status: 413 }
      );
    }

    // Attempt Firebase Storage upload first when configured
    if (
      isFirebaseConfigured() &&
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    ) {
      try {
        const app = getFirebaseApp();
        if (app) {
          const storage = getStorage(app);
          const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
          const safeLead = (body.leadId || "studio").replace(/[^a-zA-Z0-9_-]/g, "");
          const storageRef = ref(
            storage,
            `crmaster/${folder}/${safeLead}/${Date.now()}.${ext}`
          );
          await uploadBytes(storageRef, buffer, { contentType: mime });
          const downloadUrl = await getDownloadURL(storageRef);
          return NextResponse.json({
            url: downloadUrl,
            storage: "firebase_storage",
          });
        }
      } catch {
        // Gracefully fall back to compact inline data URL if Storage bucket rules are not yet enabled
      }
    }

    // Safe compressed inline fallback (< 250 KB works natively inside Firestore documents)
    if (buffer.byteLength > 260_000) {
      return NextResponse.json(
        {
          error:
            "Firebase Storage indisponível e imagem acima de 250 KB. Tente uma foto menor.",
        },
        { status: 413 }
      );
    }

    return NextResponse.json({
      url: dataUrl,
      storage: "inline_optimized",
    });
  } catch {
    return NextResponse.json(
      { error: "Falha ao processar upload de imagem." },
      { status: 500 }
    );
  }
}
