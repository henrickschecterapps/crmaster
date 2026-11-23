"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Clock,
  Database,
  Eye,
  Handshake,
  Kanban,
  LayoutDashboard,
  LogOut,
  Moon,
  Plus,
  RefreshCw,
  Search,
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
import {
  cn,
  getFunnelLabel,
  getLeadStagnation,
  getStageLabel,
} from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";
import { DashboardView } from "@/components/crm/DashboardView";
import { KanbanView } from "@/components/crm/KanbanView";
import { CaptureView } from "@/components/crm/CaptureView";
import { DispatcherView } from "@/components/crm/DispatcherView";
import { PartnersView } from "@/components/crm/PartnersView";
import { SettingsView } from "@/components/crm/SettingsView";
import { LeadDetailModal } from "@/components/crm/LeadDetailModal";
import { QuickNewLeadModal } from "@/components/crm/QuickNewLeadModal";
import { CommandPaletteModal } from "@/components/crm/CommandPaletteModal";
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
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const openClientPage = useCallback(
    (lead: Lead) => {
      router.push(`/clientes/${lead.id}`);
    },
    [router]
  );

  const [store, setStore] = useState<CrmStoreData>(initialData);
  const [status, setStatus] = useState<IntegrationStatus>(initialStatus);
  const [activeModule, setActiveModule] = useState<ActiveModule>("dashboard");
  const [activeFunnel, setActiveFunnel] = useState<FunnelId>("corporativo");
  const [captureSubTab] = useState<"places" | "manual" | "csv">("places");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [dispatchLeadId, setDispatchLeadId] = useState<string | null>(null);
  const [showQuickNewLead, setShowQuickNewLead] = useState(false);
  const [quickNewLeadFunnel, setQuickNewLeadFunnel] =
    useState<FunnelId>("corporativo");
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isRemoteLocalMode, setIsRemoteLocalMode] = useState(false);

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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
    const host = window.location.hostname;
    const isRemote = host !== "localhost" && host !== "127.0.0.1";
    setIsRemoteLocalMode(isRemote && status.databaseMode === "local");
  }, [status.databaseMode]);

  useEffect(() => {
    refreshStore(true);

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

  const headerAlertCounts = useMemo(() => {
    let stagnant = 0;
    let viewed = 0;
    for (const lead of store.leads) {
      if (getLeadStagnation(lead).level !== "none") stagnant += 1;
      if (lead.visualizadaEm && lead.stage !== "fechado") viewed += 1;
    }
    return { stagnant, viewed };
  }, [store.leads]);

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
    code: string;
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    {
      id: "dashboard",
      code: "01",
      label: "Dashboard",
      shortLabel: "Painel",
      icon: LayoutDashboard,
    },
    {
      id: "kanban",
      code: "02",
      label: "Kanban",
      shortLabel: "Kanban",
      icon: Kanban,
      badge: store.leads.length,
    },
    {
      id: "capture",
      code: "03",
      label: "Captação BH",
      shortLabel: "Captar",
      icon: UserPlus,
    },
    {
      id: "dispatcher",
      code: "04",
      label: "Disparador",
      shortLabel: "Disparo",
      icon: Send,
    },
    {
      id: "partners",
      code: "05",
      label: "Parceiros",
      shortLabel: "Parceiros",
      icon: Handshake,
      badge: store.partners.length,
    },
    {
      id: "settings",
      code: "06",
      label: "Config",
      shortLabel: "Config",
      icon: Settings,
    },
  ];

  const activeNav =
    navItems.find((n) => n.id === activeModule) ?? navItems[0];

  return (
    <div className="min-h-[100dvh] flex flex-col">
      {/* Subtle fixed 35mm cinema grain overlay */}
      <div className="cinema-grain" aria-hidden="true" />

      {/* UNIFIED TOP DOCK HEADER (100% full horizontal width, no left sidebar) */}
      <header className="glass-bar sticky top-0 z-30 border-b border-[var(--border-hairline)]">
        <div className="mx-auto flex max-w-[1720px] items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
          {/* Left: Studio Identity + Cloud Persistence Status Pill */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="lg:hidden">
              <BrandMark compact />
            </div>
            <div className="hidden lg:block">
              <BrandMark compact />
            </div>

            <div
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface-solid)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]"
              title={
                status.databaseMode === "firebase"
                  ? `Cloud Firestore ativo (${status.firebaseProjectId || "ultimo-quadro"})`
                  : status.databaseMode === "supabase"
                  ? "Supabase conectado"
                  : "Modo Local (.data + localStorage)"
              }
            >
              <Database
                className={cn(
                  "h-3 w-3",
                  status.databaseMode === "firebase"
                    ? "text-[var(--status-success)]"
                    : "text-[var(--accent-text)]"
                )}
                aria-hidden="true"
              />
              <span className="font-mono-num text-[10px] font-semibold">
                {status.databaseMode === "firebase"
                  ? "FIRESTORE"
                  : status.databaseMode === "supabase"
                  ? "SUPABASE"
                  : "LOCAL"}
              </span>
            </div>
          </div>

          {/* Center: Unified macOS/Vercel-style Module Dock (Desktop) */}
          <nav
            aria-label="Navegação Principal"
            className="dock-shell hidden lg:flex items-center gap-1"
          >
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
                    "inline-flex min-h-[36px] items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                    active
                      ? "bg-[var(--bg-surface-solid)] text-[var(--text-primary)] border border-[var(--accent-border)] shadow-sm"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] border border-transparent"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      active
                        ? "text-[var(--accent-text)]"
                        : "text-[var(--text-muted)]"
                    )}
                    aria-hidden="true"
                  />
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.2 font-mono-num text-[10px] font-bold",
                        active
                          ? "bg-[var(--accent-soft)] text-[var(--accent-text)]"
                          : "bg-[var(--bg-subtle)] text-[var(--text-muted)]"
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right: Alerts + Command Search (Ctrl+K) + Sync + Button-in-Button CTA + Theme */}
          <div className="flex items-center gap-2 shrink-0">
            {headerAlertCounts.stagnant > 0 && (
              <button
                type="button"
                onClick={() => setActiveModule("dashboard")}
                className="badge-warning hidden xl:inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold hover:opacity-85"
                title="Ver leads parados há mais de 48h"
              >
                <Clock className="h-3 w-3" aria-hidden="true" />
                <span className="font-mono-num">
                  {headerAlertCounts.stagnant}
                </span>
                <span>&gt;48h</span>
              </button>
            )}

            {headerAlertCounts.viewed > 0 && (
              <button
                type="button"
                onClick={() => setShowCommandPalette(true)}
                className="badge-accent hidden 2xl:inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold hover:opacity-85"
                title="Propostas visualizadas por clientes"
              >
                <Eye className="h-3 w-3" aria-hidden="true" />
                <span className="font-mono-num">{headerAlertCounts.viewed}</span>
                <span>vistas</span>
              </button>
            )}

            {/* Global Search / Command Palette Trigger (Ctrl+K) */}
            <button
              type="button"
              onClick={() => setShowCommandPalette(true)}
              className="btn-ghost inline-flex min-h-[38px] items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-secondary)] bg-[var(--bg-surface-solid)]"
              title="Busca global de leads e comandos (Ctrl+K)"
            >
              <Search
                className="h-3.5 w-3.5 text-[var(--accent-text)]"
                aria-hidden="true"
              />
              <span className="hidden md:inline">Buscar...</span>
              <kbd className="hidden sm:inline-block rounded border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-1.5 py-0.5 font-mono-num text-[10px] font-semibold text-[var(--text-muted)]">
                Ctrl K
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => refreshStore(false)}
              disabled={syncing}
              className="btn-ghost inline-flex h-[38px] w-[38px] items-center justify-center rounded-lg text-xs font-semibold"
              title="Sincronizar aberturas de proposta e leads"
              aria-label="Sincronizar dados do CRM"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", syncing && "animate-spin")}
                aria-hidden="true"
              />
            </button>

            {/* Button-in-Button Primary CTA */}
            <button
              type="button"
              onClick={() => openQuickNewLead(activeFunnel)}
              className="btn-accent group inline-flex min-h-[38px] items-center gap-2 rounded-lg pl-3.5 pr-2 py-1.5 text-xs font-bold"
            >
              <span className="hidden sm:inline">Novo Lead</span>
              <span className="btn-icon-badge">
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className="btn-ghost flex h-[38px] w-[38px] items-center justify-center rounded-lg"
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
                className="btn-ghost flex h-[38px] w-[38px] items-center justify-center rounded-lg"
                aria-label="Encerrar sessão administrativa"
                title="Sair do CRM"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Sub-strip: Timecode Breadcrumb & Active Context */}
        <div className="border-t border-[var(--border-hairline)] bg-[var(--bg-subtle)]/75">
          <div className="mx-auto flex max-w-[1720px] items-center justify-between px-4 py-1.5 text-[11px] sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 text-[var(--text-muted)]">
              <span className="font-mono-num font-bold text-[var(--accent-text)]">
                TC 00:{activeNav.code}:24:00
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-[var(--text-primary)]">
                {activeNav.label}
              </span>
              {activeModule === "kanban" && (
                <>
                  <span aria-hidden="true">/</span>
                  <span className="text-[var(--text-secondary)]">
                    {getFunnelLabel(activeFunnel)}
                  </span>
                </>
              )}
            </div>
            <div className="hidden sm:flex items-center gap-3 font-mono-num text-[10px] text-[var(--text-muted)]">
              <span>A HISTÓRIA TERMINA. A IMAGEM FICA.</span>
              <span aria-hidden="true">·</span>
              <span>BELO HORIZONTE &amp; NOVA LIMA</span>
            </div>
          </div>
        </div>
      </header>

      {isRemoteLocalMode && (
        <div
          role="alert"
          className="mx-auto mt-4 w-full max-w-[1720px] px-4 sm:px-6 lg:px-8"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl badge-warning px-4 py-3 text-xs">
            <span className="inline-flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              Banco em nuvem desconectado neste deploy: configure as variáveis{" "}
              <code className="font-mono-num">NEXT_PUBLIC_FIREBASE_*</code> na
              Vercel (e faça Redeploy) para que alterações não se percam ao
              atualizar a página.
            </span>
          </div>
        </div>
      )}

      {syncError && (
        <div
          role="alert"
          className="mx-auto mt-4 w-full max-w-[1720px] px-4 sm:px-6 lg:px-8"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl badge-danger px-4 py-3 text-xs">
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
        </div>
      )}

      {/* Full-Width Workspace Container */}
      <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-10 max-w-[1720px] w-full mx-auto">
        {activeModule === "dashboard" && (
          <DashboardView
            leads={store.leads}
            partners={store.partners}
            settings={store.settings}
            onUpdateMonthlyGoal={handleUpdateMonthlyGoal}
            onSelectLead={openClientPage}
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
            onSelectLead={openClientPage}
            onQuickDispatch={(lead) => {
              setDispatchLeadId(lead.id);
              setActiveModule("dispatcher");
            }}
            onOpenNewLead={(funnel) => openQuickNewLead(funnel)}
            onNotify={notify}
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
            onSelectLead={openClientPage}
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

      {showCommandPalette && (
        <CommandPaletteModal
          leads={store.leads}
          theme={theme}
          onClose={() => setShowCommandPalette(false)}
          onSelectLead={openClientPage}
          onOpenNewLead={() => openQuickNewLead(activeFunnel)}
          onNavigateModule={(mod, funnel) => {
            if (funnel) setActiveFunnel(funnel);
            setActiveModule(mod);
          }}
          onToggleTheme={toggleTheme}
        />
      )}

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
