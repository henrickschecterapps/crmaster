"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Aperture,
  Database,
  Kanban,
  LayoutDashboard,
  Moon,
  Plus,
  RefreshCw,
  Send,
  Settings,
  Sun,
  UserPlus,
} from "lucide-react";
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
import { SettingsView } from "@/components/crm/SettingsView";
import { LeadDetailModal } from "@/components/crm/LeadDetailModal";
import type { CreateLeadInput } from "@/lib/repository";

type ActiveModule =
  | "dashboard"
  | "kanban"
  | "capture"
  | "dispatcher"
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
  const [activeFunnel, setActiveFunnel] = useState<FunnelId>(
    "festas_corporativas"
  );
  const [captureSubTab, setCaptureSubTab] = useState<
    "places" | "manual" | "csv"
  >("places");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [dispatchLeadId, setDispatchLeadId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

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

  // Mirror state to localStorage for offline/instant visibility
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
      if (!res.ok) return;
      const json = (await res.json()) as {
        data: CrmStoreData;
        status: IntegrationStatus;
      };
      setStore(json.data);
      setStatus(json.status);
    } finally {
      if (!silent) setSyncing(false);
    }
  }, []);

  // Auto-sync when client views/approves a proposal in another tab or window returns focus
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
            `Proposta aberta por ${event.data.companyName}! Card movido para Proposta Aberta.`,
            "info"
          );
        } else if (event.data?.type === "proposal_approved") {
          notify(
            `Proposta aprovada por ${event.data.companyName}! Verifique os dados de reserva.`,
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
  ) => {
    const res = await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patch, interaction, touchLastInteraction }),
    });
    if (!res.ok) {
      notify("Erro ao salvar atualização do lead.", "error");
      return;
    }
    const { lead } = (await res.json()) as { lead: Lead };
    setStore((prev) => ({
      ...prev,
      leads: prev.leads.map((l) => (l.id === lead.id ? lead : l)),
    }));
  };

  const handleMoveStage = async (leadId: string, newStage: StageId) => {
    const lead = store.leads.find((l) => l.id === leadId);
    if (!lead) return;

    const paymentPatch: Partial<Lead> = {};
    if (newStage === "sinal_pago" && lead.paymentStatus === "pendente") {
      paymentPatch.paymentStatus = "sinal_pago";
    } else if (newStage === "fechado") {
      paymentPatch.paymentStatus = "quitado";
    }

    // Optimistic update
    setStore((prev) => ({
      ...prev,
      leads: prev.leads.map((l) =>
        l.id === leadId ? { ...l, stage: newStage, ...paymentPatch } : l
      ),
    }));

    await handleUpdateLead(
      leadId,
      { stage: newStage, ...paymentPatch },
      {
        type: "etapa",
        title: `Etapa alterada para ${getStageLabel(newStage)}`,
        description: `Movido de ${getStageLabel(lead.stage)} para ${getStageLabel(newStage)}.`,
      },
      true
    );
    notify(
      `${lead.companyName} movido para ${getStageLabel(newStage)}.`,
      "success"
    );
  };

  const handleDeleteLead = async (leadId: string) => {
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
  };

  const handleCreateLead = async (input: CreateLeadInput) => {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
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
    if (!res.ok) return;
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
    const { partner: created } = (await res.json()) as { partner: Partner };
    setStore((prev) => ({
      ...prev,
      partners: [...prev.partners, created],
    }));
    notify(`Parceiro "${created.name}" cadastrado.`, "success");
    return created;
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
    if (!res.ok) return;
    setStore((prev) => ({
      ...prev,
      templates: prev.templates.filter((t) => t.id !== templateId),
    }));
    notify("Template removido da biblioteca.", "info");
  };

  const navItems: Array<{
    id: ActiveModule;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    {
      id: "kanban",
      label: "CRM Kanban",
      icon: Kanban,
      badge: store.leads.length,
    },
    { id: "capture", label: "Captação BH", icon: UserPlus },
    { id: "dispatcher", label: "Disparador & Scripts", icon: Send },
    { id: "settings", label: "Automações & Config", icon: Settings },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col lg:flex-row">
      {/* Left Navigation Sidebar (Desktop) */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:justify-between border-r border-[var(--border-hairline)] bg-[var(--bg-subtle)]/55 px-4 py-6">
        <div className="space-y-8">
          {/* Studio Identity */}
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--accent-fg)] shadow-sm">
              <Aperture className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold tracking-tight text-[var(--text-primary)]">
                Henrique Matos
              </p>
              <p className="truncate text-[11px] font-medium text-[var(--text-muted)]">
                CRMaster · Studio BH
              </p>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="space-y-1.5" aria-label="Navegação Principal">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveModule(item.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-xs font-semibold transition-all cursor-pointer",
                    active
                      ? "bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent-border)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] border border-transparent"
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </span>
                  {item.badge !== undefined && (
                    <span className="rounded-full bg-[var(--bg-surface-solid)] px-2 py-0.5 font-mono-num text-[10px] text-[var(--text-secondary)]">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Persistence & Theme Status */}
        <div className="space-y-3 border-t border-[var(--border-hairline)] pt-4">
          <div className="rounded-2xl bg-[var(--bg-surface-solid)]/80 border border-[var(--border-hairline)] p-3 text-[11px]">
            <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
              <Database className="h-3.5 w-3.5 text-[var(--accent)]" />
              {status.databaseMode === "firebase"
                ? "Firebase Conectado"
                : status.databaseMode === "supabase"
                ? "Supabase Conectado"
                : "Modo Local + Fallback"}
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-muted)]">
              {status.databaseMode === "firebase"
                ? `Cloud Firestore ativo (${status.firebaseProjectId || "Firebase"}).`
                : status.databaseMode === "supabase"
                ? "Persistência sincronizada em nuvem."
                : "Dados salvos localmente (.data + localStorage). Insira as chaves no .env.local quando desejar."}
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Utility Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--border-hairline)] bg-[var(--bg-canvas)]/80 px-4 py-3.5 backdrop-blur-xl sm:px-6 lg:px-8">
          {/* Mobile brand */}
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--accent-fg)]">
              <Aperture className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold tracking-tight text-[var(--text-primary)]">
              CRMaster BH
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>
              Estúdio de Fotografia &amp; Audiovisual · Belo Horizonte, MG
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refreshStore(false)}
              disabled={syncing}
              className="btn-ghost inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer"
              title="Sincronizar aberturas de proposta e leads"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", syncing && "animate-spin")}
              />
              <span className="hidden sm:inline">Sincronizar</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCaptureSubTab("manual");
                setActiveModule("capture");
              }}
              className="btn-accent inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Novo Lead</span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className="btn-ghost flex h-9 w-9 items-center justify-center rounded-xl cursor-pointer"
              aria-label="Alternar tema claro/escuro"
              title={theme === "dark" ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-[var(--accent)]" />
              ) : (
                <Moon className="h-4 w-4 text-[var(--text-primary)]" />
              )}
            </button>
          </div>
        </header>

        {/* Mobile Nav Pills */}
        <div className="flex gap-1.5 overflow-x-auto border-b border-[var(--border-hairline)] px-4 py-2.5 lg:hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveModule(item.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer",
                  active
                    ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                    : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Active Module Workspace */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-[1600px] w-full mx-auto">
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
              onOpenNewLead={(funnel) => {
                setActiveFunnel(funnel);
                setCaptureSubTab("manual");
                setActiveModule("capture");
              }}
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
              onUpdateLead={handleUpdateLead}
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

      {/* Lead Detail Slide-over Modal */}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          partners={store.partners}
          onClose={() => setSelectedLeadId(null)}
          onUpdateLead={handleUpdateLead}
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

      {/* Subtle Toast Banner */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm">
          <div
            className={cn(
              "glass-panel rounded-2xl px-4 py-3 text-xs font-semibold shadow-2xl border",
              toast.tone === "success" &&
                "border-emerald-500/40 text-emerald-400",
              toast.tone === "error" && "border-rose-500/40 text-rose-400",
              toast.tone === "info" &&
                "border-[var(--accent-border)] text-[var(--accent)]"
            )}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
