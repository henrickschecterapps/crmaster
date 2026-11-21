import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getStoreData } from "@/lib/repository";
import { getIntegrationStatus } from "@/lib/supabase";
import { ProposalClient } from "@/components/proposal/ProposalClient";
import { UltimoQuadroIcon } from "@/components/BrandMark";

export const dynamic = "force-dynamic";

export default async function ProposalPage(props: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await props.params;
  const store = await getStoreData();
  const lead = store.leads.find((l) => l.id === leadId) ?? null;
  const status = getIntegrationStatus(store.settings);

  if (!lead) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-4">
        <div className="surface-card max-w-md w-full rounded-xl p-8 text-center space-y-4">
          <div className="mx-auto flex h-12 w-20 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-2.5">
            <UltimoQuadroIcon className="w-full h-auto" />
          </div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">
            Proposta não encontrada
          </h1>
          <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
            O link desta proposta comercial da ÚLTIMO QUADRO não está ativo ou o
            lead informado (<code className="font-mono-num">{leadId}</code>) não
            existe no CRM.
          </p>
          <Link
            href="/"
            className="btn-accent inline-flex min-h-[42px] items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Voltar ao CRM ÚLTIMO QUADRO
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ProposalClient lead={lead} studioWhatsapp={status.whatsappNumber} />
  );
}
