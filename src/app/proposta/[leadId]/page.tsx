import Link from "next/link";
import { Aperture, ArrowLeft } from "lucide-react";
import { getStoreData } from "@/lib/repository";
import { getIntegrationStatus } from "@/lib/supabase";
import { ProposalClient } from "@/components/proposal/ProposalClient";

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
        <div className="glass-panel max-w-md w-full rounded-3xl p-8 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Aperture className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">
            Proposta não encontrada
          </h1>
          <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
            O link desta proposta comercial não está ativo ou o lead informado (
            <code className="font-mono-num">{leadId}</code>) não existe no CRM.
          </p>
          <Link
            href="/"
            className="btn-accent inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar ao CRMaster
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ProposalClient lead={lead} studioWhatsapp={status.whatsappNumber} />
  );
}
