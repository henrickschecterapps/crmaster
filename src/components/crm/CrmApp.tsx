"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Database,
  Handshake,
  Kanban,
  LayoutDashboard,
  LogOut,
  Moon,
  Plus,
  RefreshCw,
  Send,
  Settings,
  Sun,
  UserPlus,
} from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import {
  CrmStoreData,
  FunnelId,
  IntegrationStatus,
  InteractionType,
  Lead,
  Partner,
  ScriptTemplate,
  StageId,
  StudioSettings,
} from "@/types/crm";
import { cn, getStageLabel } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";
import { DashboardView } from "@/components/crm/DashboardView";
import { KanbanView } from "@/components/crm/KanbanView";
import { CaptureView } from "@/components/crm/CaptureView";
import { DispatcherView } from "@/components/crm/DispatcherView";
import { PartnersView } from "@/components/crm/PartnersView";
import { SettingsView } from "@/components/crm/SettingsView";
import { LeadDetailModal } from "@/components/crm/LeadDetailModal";
import { QuickNewLeadModal } from "@/components/crm/QuickNewLeadModal";
import type { CreateLeadInput } from "@/lib/repository";

type ActiveModule =
  | "dashboard"
  | "kanban"
  | "capture"
  | "dispatcher"
  | "partners"
  | "settings";

interface CrmAppProps {
  initialData: CrmStoreData;
  initialStatus: IntegrationStatus;
}

const LOCAL_MIRROR_KEY = "crmaster_store_mirror_v1";

export function CrmApp({ initialData, initialStatus }: CrmAppProps) {
  const { theme, toggleTheme } = useTheme();

  const [store, setStore] = useState<CrmStoreData>(initialData);
  const [status, setStatus] = useState<IntegrationStatus>(initialStatus);
  const [activeModule, setActiveModule] = useState<ActiveModule>("dashboard");
  const [activeFunnel, setActiveFunnel] = useState<FunnelId>("corporativo");
  const [captureSubTab, setCaptureSubTab] = useState<
    "places" | "manual" | "csv"
  >("places");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [dispatchLeadId, setDispatchLeadId] = useState<string | null>(null);
  const [showQuickNewLead, setShowQuickNewLead] = useState(false);
  const [quickNewLeadFunnel, setQuickNewLeadFunnel] =
    useState<FunnelId>("corporativo");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const [toast, setToast] = useState<{
    message: string;
    tone: "success" | "info" | "error";
  } | null>(null);

  const notify = useCallback(
    (message: string, tone: "success" | "info" | "error" = "success") => {
      setToast({ message, tone });
    },
    []
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    try {
      window.localStorage.setItem(LOCAL_MIRROR_KEY, JSON.stringify(store));
    } catch {
      // Ignore quota errors
    }
  }, [store]);

  const refreshStore = useCallback(async (silent = false) => {
    if (!silent) setSyncing(true);
    try {
      const res = await fetch("/api/store", { cache: "no-store" });
      if (!res.ok) {
        if (!silent) {
          setSyncError(
            "Não foi possível sincronizar com o servidor. Verifique sua conexão."
          );
        }
        return;
      }
      const json = (await res.json()) as {
        data: CrmStoreData;
        status: IntegrationStatus;
      };
      setStore(json.data);
      setStatus(json.status);
      setSyncError(null);
    } catch {
      if (!silent) {
        setSyncError(
          "Falha de rede ao sincronizar os dados. Tente novamente."
        );
      }
    } finally {
      if (!silent) setSyncing(false);
    }
  }, []);

  useEffect(() => {
    const onFocus = () => {
      refreshStore(true);
    };
    window.addEventListener("focus", onFocus);

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel("crmaster-sync");
      channel.onmessage = (event) => {
        refreshStore(true);
        if (event.data?.type === "proposal_viewed") {
          notify(
            `Proposta aberta por ${event.data.companyName}. Card movido para Proposta Aberta.`,
            "info"
          );
        } else if (event.data?.type === "proposal_approved") {
          notify(
            `Proposta aprovada por ${event.data.companyName}. Verifique os dados de reserva.`,
            "success"
          );
        }
      };
    }

    return () => {
      window.removeEventListener("focus", onFocus);
      channel?.close();
    };
  }, [refreshStore, notify]);

  const selectedLead =
    store.leads.find((l) => l.id === selectedLeadId) ?? null;

  const handleUpdateLead = async (
    leadId: string,
    patch: Partial<Lead>,
    interaction?: { type: InteractionType; title: string; description: string },
    touchLastInteraction = true
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patch, interaction, touchLastInteraction }),
      });
      if (!res.ok) {
        notify("Erro ao salvar atualização do lead.", "error");
        return false;
      }
      const { lead } = (await res.json()) as { lead: Lead };
      setStore((prev) => ({
        ...prev,
        leads: prev.leads.map((l) => (l.id === lead.id ? lead : l)),
      }));
      return true;
    } catch {
      notify("Erro de rede ao salvar atualização do lead.", "error");
      return false;
    }
  };

  const handleMoveStage = async (leadId: string, newStage: StageId) => {
    const previousLead = store.leads.find((l) => l.id === leadId);
    if (!previousLead || previousLead.stage === newStage) return;

    const paymentPatch: Partial<Lead> = {};
    if (newStage === "sinal_pago" && previousLead.paymentStatus === "pendente") {
      paymentPatch.paymentStatus = "sinal_pago";
    } else if (newStage === "fechado") {
      paymentPatch.paymentStatus = "quitado";
    }

    setStore((prev) => ({
      ...prev,
      leads: prev.leads.map((l) =>
        l.id === leadId ? { ...l, stage: newStage, ...paymentPatch } : l
      ),
    }));

    const ok = await handleUpdateLead(
      leadId,
      { stage: newStage, ...paymentPatch },
      {
        type: "etapa",
        title: `Etapa alterada para ${getStageLabel(newStage)}`,
        description: `Movido de ${getStageLabel(previousLead.stage)} para ${getStageLabel(newStage)}.`,
      },
      true
    );

    if (!ok) {
      setStore((prev) => ({
        ...prev,
        leads: prev.leads.map((l) => (l.id === leadId ? previousLead : l)),
      }));
      notify(
        `Falha ao mover ${previousLead.companyName}. Posição anterior restaurada.`,
        "error"
      );
      return;
    }

    notify(
      `${previousLead.companyName} movido para ${getStageLabel(newStage)}.`,
      "success"
    );
  };

  const handleDeleteLead = async (leadId: string) => {
    try {
      const res = await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
      if (!res.ok) {
        notify("Erro ao excluir lead.", "error");
        return;
      }
      setStore((prev) => ({
        ...prev,
        leads: prev.leads.filter((l) => l.id !== leadId),
      }));
      notify("Lead removido do CRM.", "info");
    } catch {
      notify("Erro de rede ao excluir lead.", "error");
    }
  };

  const handleCreateLead = async (input: CreateLeadInput) => {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      throw new Error("Falha ao criar lead.");
    }
    const json = (await res.json()) as { lead: Lead; duplicate: boolean };
    if (!json.duplicate && json.lead) {
      setStore((prev) => ({
        ...prev,
        leads: [json.lead, ...prev.leads],
      }));
    }
    return json;
  };

  const handleCreateLeadsBulk = async (inputs: CreateLeadInput[]) => {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leads: inputs }),
    });
    if (!res.ok) {
      throw new Error("Falha ao importar leads.");
    }
    const json = (await res.json()) as {
      imported: Lead[];
      skippedDuplicates: number;
    };
    if (json.imported?.length > 0) {
      setStore((prev) => ({
        ...prev,
        leads: [...json.imported, ...prev.leads],
      }));
    }
    return json;
  };

  const handleUpdateSettings = async (patch: Partial<StudioSettings>) => {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      notify("Não foi possível salvar as configurações.", "error");
      return;
    }
    const json = await res.json();
    if (json.settings) {
      setStore((prev) => ({ ...prev, settings: json.settings }));
    }
    if (json.status) {
      setStatus(json.status);
    }
  };

  const handleUpdateMonthlyGoal = async (monthlyGoal: number) => {
    await handleUpdateSettings({ monthlyGoal });
    notify("Meta mensal atualizada com sucesso.", "success");
  };

  const handleUpdateNextDate = async (nextAvailableDate: string) => {
    await handleUpdateSettings({ nextAvailableDate });
  };

  const handleCreatePartner = async (
    partner: Omit<Partner, "id" | "createdAt">
  ) => {
    const res = await fetch("/api/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partner),
    });
    if (!res.ok) {
      notify("Erro ao cadastrar parceiro.", "error");
      throw new Error("Erro ao cadastrar parceiro");
    }
    const { partner: created } = (await res.json()) as { partner: Partner };
    setStore((prev) => ({
      ...prev,
      partners: [...prev.partners, created],
    }));
    notify(`Parceiro "${created.name}" cadastrado.`, "success");
    return created;
  };

  const handleUpdatePartner = async (
    partnerId: string,
    patch: Partial<Omit<Partner, "id" | "createdAt">>
  ) => {
    const res = await fetch(`/api/partners/${partnerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      notify("Erro ao atualizar parceiro.", "error");
      return;
    }
    const { partner: updated } = (await res.json()) as { partner: Partner };
    setStore((prev) => ({
      ...prev,
      partners: prev.partners.map((p) => (p.id === updated.id ? updated : p)),
    }));
  };

  const handleDeletePartner = async (partnerId: string) => {
    const res = await fetch(`/api/partners/${partnerId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      notify("Erro ao remover parceiro.", "error");
      return;
    }
    setStore((prev) => ({
      ...prev,
      partners: prev.partners.filter((p) => p.id !== partnerId),
      leads: prev.leads.map((l) =>
        l.partnerId === partnerId ? { ...l, partnerId: null } : l
      ),
    }));
  };

  const handleSaveTemplate = async (
    template: Omit<ScriptTemplate, "id" | "createdAt" | "updatedAt"> & {
      id?: string;
    }
  ) => {
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(template),
    });
    if (!res.ok) {
      notify("Erro ao salvar template.", "error");
      throw new Error("Erro ao salvar template");
    }
    const { template: saved } = (await res.json()) as {
      template: ScriptTemplate;
    };
    setStore((prev) => {
      const exists = prev.templates.some((t) => t.id === saved.id);
      return {
        ...prev,
        templates: exists
          ? prev.templates.map((t) => (t.id === saved.id ? saved : t))
          : [...prev.templates, saved],
      };
    });
    return saved;
  };

  const handleDeleteTemplate = async (templateId: string) => {
    const res = await fetch(`/api/templates/${templateId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      notify("Erro ao remover template.", "error");
      return;
    }
    setStore((prev) => ({
      ...prev,
      templates: prev.templates.filter((t) => t.id !== templateId),
    }));
    notify("Template removido da biblioteca.", "info");
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.reload();
    } finally {
      setLoggingOut(false);
    }
  };

  const openQuickNewLead = (funnel: FunnelId) => {
    setQuickNewLeadFunnel(funnel);
    setShowQuickNewLead(true);
  };

  const navItems: Array<{
    id: ActiveModule;
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    {
      id: "dashboard",
      label: "Dashboard",
      shortLabel: "Painel",
      icon: LayoutDashboard,
    },
    {
      id: "kanban",
      label: "CRM Kanban",
      shortLabel: "Kanban",
      icon: Kanban,
      badge: store.leads.length,
    },
    {
      id: "capture",
      label: "Captação BH",
      shortLabel: "Captar",
      icon: UserPlus,
    },
    {
      id: "dispatcher",
      label: "Disparador & Scripts",
      shortLabel: "Disparo",
      icon: Send,
    },
    {
      id: "partners",
      label: "Parceiros (15%)",
      shortLabel: "Parceiros",
      icon: Handshake,
      badge: store.partners.length,
    },
    {
      id: "settings",
      label: "Automações & Config",
      shortLabel: "Config",
      icon: Settings,
    },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col lg:flex-row">
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:justify-between border-r border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-4 py-6">
        <div className="space-y-8">
          <div className="px-1">
            <BrandMark />
          </div>

          <nav className="space-y-1.5" aria-label="Navegação Principal">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveModule(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex w-full min-h-[42px] items-center justify-between rounded-lg px-3.5 py-2.5 text-xs font-semibold transition-colors border",
                    active
                      ? "bg-[var(--accent-soft)] text-[var(--accent-text)] border-[var(--accent-border)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] border-transparent"
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {item.label}
                  </span>
                  {item.badge !== undefined && (
                    <span className="rounded-md bg-[var(--bg-surface-solid)] px-2 py-0.5 font-mono-num text-[10px] text-[var(--text-secondary)]">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3 border-t border-[var(--border-hairline)] pt-4">
          <div className="rounded-xl bg-[var(--bg-surface-solid)] border border-[var(--border-hairline)] p-3 text-[11px]">
            <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
              <Database
                className="h-3.5 w-3.5 text-[var(--accent-text)]"
                aria-hidden="true"
              />
              {status.databaseMode === "firebase"
                ? "Firebase Conectado"
                : status.databaseMode === "supabase"
                ? "Supabase Conectado"
                : "Modo Local + Fallback"}
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
              {status.databaseMode === "firebase"
                ? `Cloud Firestore ativo (${status.firebaseProjectId || "Firebase"}).`
                : status.databaseMode === "supabase"
                ? "Persistência sincronizada em nuvem."
                : "Dados salvos localmente (.data + localStorage)."}
            </p>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="glass-bar sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--border-hairline)] px-4 py-3 sm:px-6 lg:px-8">
          <div className="lg:hidden">
            <BrandMark compact />
          </div>

          <div className="hidden lg:flex items-center gap-2.5 text-xs text-[var(--text-muted)]">
            <span className="font-medium text-[var(--text-secondary)]">
              A história termina. A imagem fica.
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num text-[11px]">
              Belo Horizonte &amp; Nova Lima · 24FPS
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refreshStore(false)}
              disabled={syncing}
              className="btn-ghost inline-flex min-h-[40px] min-w-[40px] items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold"
              title="Sincronizar aberturas de proposta e leads"
              aria-label="Sincronizar dados do CRM"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", syncing && "animate-spin")}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">Sincronizar</span>
            </button>

            <button
              type="button"
              onClick={() => openQuickNewLead(activeFunnel)}
              className="btn-accent inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Novo Lead</span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className="btn-ghost flex h-10 w-10 items-center justify-center rounded-lg"
              aria-label={
                theme === "dark"
                  ? "Mudar para modo claro"
                  : "Mudar para modo escuro"
              }
              title={
                theme === "dark"
                  ? "Mudar para Modo Claro"
                  : "Mudar para Modo Escuro"
              }
            >
              {theme === "dark" ? (
                <Sun
                  className="h-4 w-4 text-[var(--accent-text)]"
                  aria-hidden="true"
                />
              ) : (
                <Moon
                  className="h-4 w-4 text-[var(--text-primary)]"
                  aria-hidden="true"
                />
              )}
            </button>

            {status.adminAuthEnabled && (
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="btn-ghost flex h-10 w-10 items-center justify-center rounded-lg"
                aria-label="Encerrar sessão administrativa"
                title="Sair do CRM"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </header>

        {syncError && (
          <div
            role="alert"
            className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl badge-danger px-4 py-3 text-xs sm:mx-6 lg:mx-8"
          >
            <span className="inline-flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {syncError}
            </span>
            <button
              type="button"
              onClick={() => refreshStore(false)}
              className="rounded-lg border border-current px-3 py-1.5 text-xs font-bold hover:opacity-80"
            >
              Tentar novamente
            </button>
          </div>
        )}

        <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-8 max-w-[1600px] w-full mx-auto">
          {activeModule === "dashboard" && (
            <DashboardView
              leads={store.leads}
              partners={store.partners}
              settings={store.settings}
              onUpdateMonthlyGoal={handleUpdateMonthlyGoal}
              onSelectLead={(lead) => setSelectedLeadId(lead.id)}
              onJumpToFunnel={(funnel) => {
                setActiveFunnel(funnel);
                setActiveModule("kanban");
              }}
            />
          )}

          {activeModule === "kanban" && (
            <KanbanView
              leads={store.leads}
              partners={store.partners}
              activeFunnel={activeFunnel}
              onChangeFunnel={setActiveFunnel}
              onMoveStage={handleMoveStage}
              onSelectLead={(lead) => setSelectedLeadId(lead.id)}
              onQuickDispatch={(lead) => {
                setDispatchLeadId(lead.id);
                setActiveModule("dispatcher");
              }}
              onOpenNewLead={(funnel) => openQuickNewLead(funnel)}
            />
          )}

          {activeModule === "capture" && (
            <CaptureView
              leads={store.leads}
              partners={store.partners}
              integrationStatus={status}
              initialSubTab={captureSubTab}
              defaultFunnel={activeFunnel}
              onCreateLead={handleCreateLead}
              onCreateLeadsBulk={handleCreateLeadsBulk}
              onNotify={notify}
            />
          )}

          {activeModule === "dispatcher" && (
            <DispatcherView
              leads={store.leads}
              templates={store.templates}
              settings={store.settings}
              integrationStatus={status}
              initialLeadId={dispatchLeadId}
              onUpdateLead={async (leadId, patch, interaction, touch) => {
                await handleUpdateLead(leadId, patch, interaction, touch);
              }}
              onSyncLead={(updatedLead) =>
                setStore((prev) => ({
                  ...prev,
                  leads: prev.leads.map((l) =>
                    l.id === updatedLead.id ? updatedLead : l
                  ),
                }))
              }
              onSaveTemplate={handleSaveTemplate}
              onDeleteTemplate={handleDeleteTemplate}
              onUpdateNextDate={handleUpdateNextDate}
              onNotify={notify}
            />
          )}

          {activeModule === "partners" && (
            <PartnersView
              partners={store.partners}
              leads={store.leads}
              onCreatePartner={handleCreatePartner}
              onUpdatePartner={handleUpdatePartner}
              onDeletePartner={handleDeletePartner}
              onUpdateLead={async (leadId, patch, interaction, touch) => {
                await handleUpdateLead(leadId, patch, interaction, touch);
              }}
              onSelectLead={(lead) => setSelectedLeadId(lead.id)}
              onNotify={notify}
            />
          )}

          {activeModule === "settings" && (
            <SettingsView
              settings={store.settings}
              leads={store.leads}
              integrationStatus={status}
              onUpdateSettings={handleUpdateSettings}
              onRefreshStore={() => refreshStore(false)}
              onNotify={notify}
            />
          )}
        </main>
      </div>

      {/* Fixed Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Navegação Mobile"
        className="glass-bar safe-bottom fixed bottom-0 inset-x-0 z-30 border-t border-[var(--border-hairline)] lg:hidden"
      >
        <div className="grid grid-cols-6 gap-0.5 px-1.5 pt-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveModule(item.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[10px] font-semibold transition-colors",
                  active
                    ? "bg-[var(--accent-soft)] text-[var(--accent-text)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate max-w-full">{item.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {showQuickNewLead && (
        <QuickNewLeadModal
          defaultFunnel={quickNewLeadFunnel}
          partners={store.partners}
          onClose={() => setShowQuickNewLead(false)}
          onCreateLead={handleCreateLead}
          onNotify={notify}
        />
      )}

      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          partners={store.partners}
          onClose={() => setSelectedLeadId(null)}
          onUpdateLead={async (leadId, patch, interaction, touch) => {
            await handleUpdateLead(leadId, patch, interaction, touch);
          }}
          onSyncLead={(updatedLead) =>
            setStore((prev) => ({
              ...prev,
              leads: prev.leads.map((l) =>
                l.id === updatedLead.id ? updatedLead : l
              ),
            }))
          }
          onDeleteLead={handleDeleteLead}
          onCreatePartner={handleCreatePartner}
          onOpenDispatcher={(lead) => {
            setSelectedLeadId(null);
            setDispatchLeadId(lead.id);
            setActiveModule("dispatcher");
          }}
          onNotify={notify}
        />
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 right-4 z-50 max-w-sm lg:bottom-5 lg:right-5"
        >
          <div
            className={cn(
              "modal-surface rounded-xl px-4 py-3 text-xs font-semibold",
              toast.tone === "success" && "badge-success",
              toast.tone === "error" && "badge-danger",
              toast.tone === "info" && "badge-accent"
            )}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
