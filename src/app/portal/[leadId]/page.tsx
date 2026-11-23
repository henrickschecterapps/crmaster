import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getStoreData } from "@/lib/repository";
import { getIntegrationStatus } from "@/lib/supabase";
import { generatePixQrDataUrl, generateStaticPixPayload } from "@/lib/pix";
import { ClientPortalView } from "@/components/portal/ClientPortalView";
import { UltimoQuadroIcon } from "@/components/BrandMark";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function ClientPortalPage(props: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await props.params;
  const store = await getStoreData();
  const lead = store.leads.find((l) => l.id === leadId) ?? null;
  const status = getIntegrationStatus(store.settings);

  if (!lead) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center px-4">
        <div className="double-bezel max-w-md w-full">
          <div className="double-bezel-core p-8 text-center space-y-4">
            <div className="mx-auto flex h-12 w-20 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-2.5">
              <UltimoQuadroIcon className="w-full h-auto" />
            </div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">
              Portal não encontrado
            </h1>
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
              O link deste Portal do Cliente da ÚLTIMO QUADRO não está ativo ou o
              código informado (<code className="font-mono-num">{leadId}</code>) não
              foi localizado.
            </p>
            <Link
              href="/"
              className="btn-accent inline-flex min-h-[42px] items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Ir para ÚLTIMO QUADRO
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Generate real Pix BR Code + QR Code for the next pending installment (50% signal or 50% balance)
  const nextInstallmentAmount =
    lead.paymentStatus === "quitado"
      ? 0
      : Number(((lead.estimatedValue || 0) * 0.5).toFixed(2));
  const pixKind: "sinal_50" | "quitacao" =
    lead.paymentStatus === "sinal_pago" ? "quitacao" : "sinal_50";

  let pixCopyPaste = "";
  let pixQrDataUrl = "";
  if (nextInstallmentAmount > 0 && status.pixKey) {
    try {
      pixCopyPaste = generateStaticPixPayload({
        pixKey: status.pixKey,
        recipientName: store.settings.pixRecipientName || "Ultimo Quadro",
        city: store.settings.pixCity || "BELO HORIZONTE",
        amount: nextInstallmentAmount,
        txId: `UQ${lead.id.slice(-8)}`,
        description:
          pixKind === "quitacao"
            ? `QUITACAO ${lead.companyName.slice(0, 16)}`
            : `SINAL 50 ${lead.companyName.slice(0, 16)}`,
      });
      pixQrDataUrl = await generatePixQrDataUrl(pixCopyPaste);
    } catch {
      // Fallback to raw key
    }
  }

  // Strip sensitive internal admin fields before passing to the client component
  const sanitizedLead = {
    ...lead,
    notes: "",
    partnerId: null,
    commissionPaid: false,
    portalPin: lead.portalPin ? "PROTECTED" : null,
  };

  return (
    <ClientPortalView
      lead={sanitizedLead}
      pinProtected={Boolean(lead.portalPin)}
      studioName={store.settings.studioName}
      studioWhatsapp={status.whatsappNumber}
      pixKey={status.pixKey}
      pixRecipientName={store.settings.pixRecipientName}
      pixCopyPaste={pixCopyPaste}
      pixQrDataUrl={pixQrDataUrl}
      pixNextAmount={nextInstallmentAmount}
      pixNextKind={pixKind}
    />
  );
}
