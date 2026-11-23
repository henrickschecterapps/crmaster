import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft } from "lucide-react";
import { getStoreData } from "@/lib/repository";
import { getIntegrationStatus } from "@/lib/supabase";
import {
  ADMIN_SESSION_COOKIE,
  isAdminAuthEnabled,
  verifyAdminSessionToken,
} from "@/lib/auth";
import { LoginGate } from "@/components/crm/LoginGate";
import { ClientWorkspaceAdmin } from "@/components/crm/ClientWorkspaceAdmin";
import { UltimoQuadroIcon } from "@/components/BrandMark";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function ClientAdminPage(props: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await props.params;
  const store = await getStoreData();

  if (isAdminAuthEnabled(store.settings)) {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
    const valid = await verifyAdminSessionToken(token, store.settings);
    if (!valid) {
      return (
        <LoginGate
          studioName={store.settings.studioName}
          requireEmail={Boolean(store.settings.adminEmail)}
        />
      );
    }
  }

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
              Cliente não encontrado
            </h1>
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
              O registro solicitado (<code className="font-mono-num">{leadId}</code>) não existe ou foi removido do CRM.
            </p>
            <Link
              href="/"
              className="btn-accent inline-flex min-h-[42px] items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Voltar ao Pipeline Comercial
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <ClientWorkspaceAdmin
      initialLead={lead}
      initialPartners={store.partners}
      studioSettings={store.settings}
      integrationStatus={status}
    />
  );
}
