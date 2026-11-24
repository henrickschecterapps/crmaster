"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Bell,
  Calendar,
  Clock,
  Database,
  Handshake,
  Kanban,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Moon,
  Palette,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Sun,
  UserPlus,
  X,
} from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import {
  CrmStoreData,
  FunnelId,
  IntegrationStatus,
  InteractionType,
  Lead,
  LostReasonId,
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
import { STUDIO_SKINS, useTheme } from "@/components/ThemeProvider";
import {
  DraggableBottomSheet,
  MotionViewContainer,
  triggerHaptic,
} from "@/components/MotionPrimitives";
import {
  loadOfflineStoreSnapshot,
  saveOfflineStoreSnapshot,
} from "@/lib/offlineCache";
import { DashboardView } from "@/components/crm/DashboardView";
import { KanbanView } from "@/components/crm/KanbanView";
import { AgendaView } from "@/components/crm/AgendaView";
import { CaptureView } from "@/components/crm/CaptureView";
import { DispatcherView } from "@/components/crm/DispatcherView";
import { PartnersView } from "@/components/crm/PartnersView";
import { SettingsView } from "@/components/crm/SettingsView";
import { QuickNewLeadModal } from "@/components/crm/QuickNewLeadModal";
import { CommandPaletteModal } from "@/components/crm/CommandPaletteModal";
import type { CreateLeadInput } from "@/lib/repository";

type ActiveModule =
  | "dashboard"
  | "kanban"
  | "agenda"
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
  const { theme, skin, setSkin, toggleTheme } = useTheme();
  const openClientPage = useCallback(
    (lead: Lead) => {
      triggerHaptic(10);
      router.push(`/clientes/${lead.id}`);
    },
    [router]
  );

  const [store, setStore] = useState<CrmStoreData>(initialData);
  const [status, setStatus] = useState<IntegrationStatus>(initialStatus);
  const [activeModule, setActiveModule] = useState<ActiveModule>("dashboard");
  const [activeFunnel, setActiveFunnel] = useState<FunnelId>("corporativo");
  const [captureSubTab] = useState<"places" | "manual" | "csv">("places");
  const [dispatchLeadId, setDispatchLeadId] = useState<string | null>(null);
  const [showPortalInbox, setShowPortalInbox] = useState(false);
  const [showMobileMore, setShowMobileMore] = useState(false);
  const [showMobileFabMenu, setShowMobileFabMenu] = useState(false);
  const [showQuickNewLead, setShowQuickNewLead] = useState(false);
  const [quickNewLeadFunnel, setQuickNewLeadFunnel] =
    useState<FunnelId>("corporativo");
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isRemoteLocalMode, setIsRemoteLocalMode] = useState(false);

  // Hydrate module/funnel/leadId from URL query parameters on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab") as ActiveModule | null;
    const funnel = params.get("funnel") as FunnelId | null;
    const leadId = params.get("leadId");
    const validTabs: ActiveModule[] = [
      "dashboard",
      "kanban",
      "agenda",
      "capture",
      "dispatcher",
      "partners",
      "settings",
    ];
    const validFunnels: FunnelId[] = [
      "corporativo",
      "estetica",
      "nightlife",
      "moda",
      "gastronomia",
    ];
    if (tab && validTabs.includes(tab)) setActiveModule(tab);
    if (funnel && validFunnels.includes(funnel)) setActiveFunnel(funnel);
    if (leadId) setDispatchLeadId(leadId);
  }, []);

  // Keep URL query synchronized with active module & funnel (without page reload)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("tab", activeModule);
    if (activeModule === "kanban") {
      url.searchParams.set("funnel", activeFunnel);
    } else {
      url.searchParams.delete("funnel");
    }
    if (activeModule !== "dispatcher") {
      url.searchParams.delete("leadId");
    }
    window.history.replaceState({}, "", url.toString());
  }, [activeModule, activeFunnel]);

  // Unified Portal Pending Inbox (Pix notices + Requested meetings + Deliverable adjustment requests)
  const portalInboxItems = useMemo(() => {
    const items: Array<{
      id: string;
      kind: "pix" | "reuniao" | "ajuste";
      label: string;
      detail: string;
      lead: Lead;
    }> = [];
    for (const lead of store.leads) {
      if (lead.archived) continue;
      if (
        lead.paymentStatus !== "quitado" &&
        (lead.paymentNotices?.length ?? 0) > 0
      ) {
        const latest = lead.paymentNotices![0];
        items.push({
          id: `pix-${lead.id}-${latest.id}`,
          kind: "pix",
          label: `Pix informado · ${lead.companyName}`,
          detail: `${latest.kind === "quitacao" ? "Quitação" : "Sinal 50%"} · R$ ${latest.amount.toLocaleString("pt-BR")}`,
          lead,
        });
      }
      for (const m of lead.meetings ?? []) {
        if (m.status === "solicitada") {
          items.push({
            id: `meet-${lead.id}-${m.id}`,
            kind: "reuniao",
            label: `Reunião solicitada · ${lead.companyName}`,
            detail: `${m.title} (${m.date} às ${m.time})`,
            lead,
          });
        }
      }
      for (const d of lead.deliverables ?? []) {
        if (d.status === "ajuste_solicitado") {
          items.push({
            id: `adj-${lead.id}-${d.id}`,
            kind: "ajuste",
            label: `Ajuste pedido · ${lead.companyName}`,
            detail: `${d.title}: ${d.clientFeedback || "Ver comentário"}`,
            lead,
          });
        }
      }
    }
    return items;
  }, [store.leads]);

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
    saveOfflineStoreSnapshot(store).catch(() => {});
  }, [store]);

  // Instant Local-First hydration from IndexedDB when offline or slow network
  useEffect(() => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      loadOfflineStoreSnapshot().then((snap) => {
        if (snap?.data) setStore(snap.data);
      });
    }
  }, []);

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

  const headerAlertCounts = useMemo(() => {
    let stagnant = 0;
    let viewed = 0;
    for (const lead of store.leads) {
      if (lead.archived) continue;
      if (getLeadStagnation(lead).level !== "none") stagnant += 1;
      if (lead.visualizadaEm && lead.stage !== "fechado") viewed += 1;
    }
    return { stagnant, viewed };
  }, [store.leads]);

  const handleBulkAction = async (params: {
    leadIds: string[];
    action: "move_stage" | "assign_partner" | "archive" | "restore";
    stage?: StageId;
    partnerId?: string | null;
    lostReason?: LostReasonId;
  }) => {
    const res = await fetch("/api/leads/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      notify("Erro ao executar ação em massa.", "error");
      return;
    }
    const json = (await res.json()) as { updatedCount: number; leads: Lead[] };
    if (Array.isArray(json.leads)) {
      setStore((prev) => ({ ...prev, leads: json.leads }));
    }
    notify(`${json.updatedCount} lead(s) atualizado(s) em lote.`, "success");
  };

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
      badge: store.leads.filter((l) => !l.archived).length,
    },
    {
      id: "agenda",
      code: "03",
      label: "Agenda",
      shortLabel: "Agenda",
      icon: Calendar,
    },
    {
      id: "capture",
      code: "04",
      label: "Captação BH",
      shortLabel: "Captar",
      icon: UserPlus,
    },
    {
      id: "dispatcher",
      code: "05",
      label: "Disparador",
      shortLabel: "Disparo",
      icon: Send,
    },
    {
      id: "partners",
      code: "06",
      label: "Parceiros",
      shortLabel: "Parceiros",
      icon: Handshake,
      badge: store.partners.length,
    },
    {
      id: "settings",
      code: "07",
      label: "Config",
      shortLabel: "Config",
      icon: Settings,
    },
  ];

  const activeNav =
    navItems.find((n) => n.id === activeModule) ?? navItems[0];

  return (
    <div className="min-h-[100dvh] flex flex-col overflow-x-clip">
      {/* Subtle fixed 35mm cinema grain overlay */}
      <div className="cinema-grain" aria-hidden="true" />

      {/* UNIFIED TOP DOCK HEADER (Responsive, zero horizontal overflow) */}
      <header className="glass-bar sticky top-0 z-30 border-b border-[var(--border-hairline)]">
        <div className="mx-auto flex max-w-[1720px] items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 lg:px-8">
          {/* Left: Studio Identity */}
          <div className="flex items-center gap-2.5 shrink-0 min-w-0">
            <BrandMark compact />
          </div>

          {/* Center: Unified Module Dock (Desktop) with Spring Pill */}
          <nav
            aria-label="Navegação Principal"
            className="dock-shell hidden lg:flex items-center gap-0.5 xl:gap-1 min-w-0 max-w-full overflow-x-auto"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic(8);
                    setActiveModule(item.id);
                  }}
                  aria-current={active ? "page" : undefined}
                  title={item.label}
                  className={cn(
                    "relative inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors xl:px-3",
                    active
                      ? "text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="desktop-dock-active-pill"
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 32,
                      }}
                      className="absolute inset-0 rounded-lg bg-[var(--bg-surface-solid)] border border-[var(--accent-border)] shadow-sm"
                    />
                  )}
                  <span className="relative z-10 inline-flex items-center gap-1.5">
                    <Icon
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        active
                          ? "text-[var(--accent-text)]"
                          : "text-[var(--text-muted)]"
                      )}
                      aria-hidden="true"
                    />
                    <span className="2xl:hidden">{item.shortLabel}</span>
                    <span className="hidden 2xl:inline">{item.label}</span>
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
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Right: Portal Inbox + Search (Ctrl+K) + Sync + CTA + Theme */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Portal Pending Inbox Popover Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPortalInbox((prev) => !prev)}
                className={cn(
                  "relative inline-flex h-9 sm:h-[38px] items-center gap-1.5 rounded-lg px-2 sm:px-2.5 text-xs font-semibold transition-colors",
                  portalInboxItems.length > 0
                    ? "badge-accent"
                    : "btn-ghost text-[var(--text-secondary)]"
                )}
                title="Central de Pendências do Portal (Pix, Reuniões e Ajustes)"
                aria-label="Central de Pendências do Portal"
              >
                <Bell className="h-3.5 w-3.5" aria-hidden="true" />
                {portalInboxItems.length > 0 && (
                  <span className="font-mono-num text-[11px] font-bold">
                    {portalInboxItems.length}
                  </span>
                )}
              </button>

              {showPortalInbox && (
                <div className="modal-surface absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-2.5">
                    <div>
                      <p className="text-xs font-bold text-[var(--text-primary)]">
                        Pendências do Portal do Cliente
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        Pix informados, reuniões solicitadas e pedidos de ajuste
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPortalInbox(false)}
                      className="text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      Fechar
                    </button>
                  </div>

                  {portalInboxItems.length === 0 ? (
                    <p className="py-6 text-center text-xs text-[var(--text-muted)]">
                      Nenhuma pendência de cliente no momento.
                    </p>
                  ) : (
                    <div className="divide-y divide-[var(--border-hairline)] max-h-72 overflow-y-auto">
                      {portalInboxItems.map((it) => (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => {
                            setShowPortalInbox(false);
                            openClientPage(it.lead);
                          }}
                          className="w-full py-2.5 px-2 -mx-2 rounded-lg text-left hover:bg-[var(--bg-surface-hover)] transition-colors space-y-0.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs font-bold text-[var(--text-primary)]">
                              {it.label}
                            </span>
                            <span
                              className={cn(
                                "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
                                it.kind === "pix" && "badge-success",
                                it.kind === "reuniao" && "badge-warning",
                                it.kind === "ajuste" && "badge-danger"
                              )}
                            >
                              {it.kind}
                            </span>
                          </div>
                          <p className="truncate text-[11px] text-[var(--text-secondary)]">
                            {it.detail}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {headerAlertCounts.stagnant > 0 && (
              <button
                type="button"
                onClick={() => setActiveModule("dashboard")}
                className="badge-warning hidden 2xl:inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold hover:opacity-85"
                title="Ver leads parados há mais de 48h"
              >
                <Clock className="h-3 w-3" aria-hidden="true" />
                <span className="font-mono-num">
                  {headerAlertCounts.stagnant}
                </span>
                <span>&gt;48h</span>
              </button>
            )}

            {/* Global Search / Command Palette Trigger (Ctrl+K) */}
            <button
              type="button"
              onClick={() => setShowCommandPalette(true)}
              className="btn-ghost inline-flex h-9 sm:min-h-[38px] items-center gap-1.5 rounded-lg px-2 sm:px-2.5 py-1.5 text-xs text-[var(--text-secondary)] bg-[var(--bg-surface-solid)]"
              title="Busca global de leads e comandos (Ctrl+K)"
              aria-label="Buscar leads e comandos"
            >
              <Search
                className="h-3.5 w-3.5 text-[var(--accent-text)]"
                aria-hidden="true"
              />
              <span className="hidden xl:inline">Buscar...</span>
              <kbd className="hidden xl:inline-block rounded border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-1.5 py-0.5 font-mono-num text-[10px] font-semibold text-[var(--text-muted)]">
                Ctrl K
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => refreshStore(false)}
              disabled={syncing}
              className="btn-ghost hidden sm:inline-flex h-[38px] w-[38px] items-center justify-center rounded-lg text-xs font-semibold"
              title="Sincronizar aberturas de proposta e leads"
              aria-label="Sincronizar dados do CRM"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", syncing && "animate-spin")}
                aria-hidden="true"
              />
            </button>

            {/* Button-in-Button Primary CTA (Tablet & Desktop; on mobile, dedicated floating + FAB) */}
            <button
              type="button"
              onClick={() => openQuickNewLead(activeFunnel)}
              className="btn-accent group hidden sm:inline-flex min-h-[38px] items-center gap-2 rounded-lg pl-3 pr-1.5 py-1.5 text-xs font-bold"
            >
              <span className="hidden md:inline">Novo Lead</span>
              <span className="btn-icon-badge">
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className="btn-ghost flex h-9 w-9 sm:h-[38px] sm:w-[38px] items-center justify-center rounded-lg"
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
                className="btn-ghost flex h-9 w-9 sm:h-[38px] sm:w-[38px] items-center justify-center rounded-lg"
                aria-label="Encerrar sessão administrativa"
                title="Sair do CRM"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Sub-strip: Timecode Breadcrumb, Cloud Status & Active Context */}
        <div className="border-t border-[var(--border-hairline)] bg-[var(--bg-subtle)]/75">
          <div className="mx-auto flex max-w-[1720px] items-center justify-between gap-2 px-3 py-1.5 text-[11px] sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 min-w-0 text-[var(--text-muted)]">
              <span className="font-mono-num font-bold text-[var(--accent-text)] shrink-0">
                TC 00:{activeNav.code}:24:00
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-[var(--text-primary)] truncate">
                {activeNav.label}
              </span>
              {activeModule === "kanban" && (
                <>
                  <span aria-hidden="true">/</span>
                  <span className="text-[var(--text-secondary)] truncate">
                    {getFunnelLabel(activeFunnel)}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0 font-mono-num text-[10px] text-[var(--text-muted)]">
              <span
                className="inline-flex items-center gap-1 font-semibold"
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
                <span>
                  {status.databaseMode === "firebase"
                    ? "FIRESTORE"
                    : status.databaseMode === "supabase"
                    ? "SUPABASE"
                    : "LOCAL"}
                </span>
              </span>
              <span className="hidden md:inline" aria-hidden="true">
                ·
              </span>
              <span className="hidden md:inline">
                BELO HORIZONTE &amp; NOVA LIMA
              </span>
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

      {/* Full-Width Workspace Container with Fluid Spring Transitions */}
      <main className="flex-1 px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:pb-10 max-w-[1720px] w-full mx-auto">
        <MotionViewContainer viewKey={activeModule}>
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
              onBulkAction={handleBulkAction}
              onSelectLead={openClientPage}
              onQuickDispatch={(lead) => {
                setDispatchLeadId(lead.id);
                setActiveModule("dispatcher");
              }}
              onOpenNewLead={(funnel) => openQuickNewLead(funnel)}
              onNotify={notify}
            />
          )}

          {activeModule === "agenda" && (
            <AgendaView leads={store.leads} onSelectLead={openClientPage} />
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
              onRefreshStore={() => refreshStore(false)}
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
        </MotionViewContainer>
      </main>

      {/* Native Mobile Floating Action Button (FAB) + Radial Quick Actions */}
      <div
        style={{
          bottom: "calc(4.75rem + env(safe-area-inset-bottom, 0px))",
        }}
        className="fixed right-4 z-40 flex flex-col items-end gap-2.5 lg:hidden"
      >
        <AnimatePresence>
          {showMobileFabMenu && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.92 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
              className="flex flex-col items-end gap-2"
            >
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  setShowMobileFabMenu(false);
                  setActiveModule("capture");
                }}
                className="modal-surface inline-flex min-h-[42px] items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-[var(--text-primary)] shadow-lg"
              >
                <UserPlus className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                Captar Overture BH
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  setShowMobileFabMenu(false);
                  setActiveModule("agenda");
                }}
                className="modal-surface inline-flex min-h-[42px] items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-[var(--text-primary)] shadow-lg"
              >
                <Calendar className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                Agenda do Estúdio
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(14);
                  setShowMobileFabMenu(false);
                  openQuickNewLead(activeFunnel);
                }}
                className="btn-accent inline-flex min-h-[42px] items-center gap-2 rounded-full px-4 py-2 text-xs font-bold shadow-lg"
              >
                <Plus className="h-3.5 w-3.5" />
                Novo Lead
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          type="button"
          whileTap={{ scale: 0.92 }}
          onClick={() => {
            triggerHaptic(12);
            setShowMobileFabMenu((prev) => !prev);
          }}
          className="btn-accent flex h-14 w-14 items-center justify-center rounded-full shadow-[0_10px_28px_rgba(181,69,18,0.55)] ring-2 ring-[var(--bg-canvas)] border border-white/20"
          aria-label={showMobileFabMenu ? "Fechar menu rápido" : "Novo Lead e ações rápidas"}
          aria-expanded={showMobileFabMenu}
        >
          {showMobileFabMenu ? (
            <X className="h-6 w-6" aria-hidden="true" />
          ) : (
            <Plus className="h-6 w-6" aria-hidden="true" />
          )}
        </motion.button>
      </div>

      {/* Native Mobile Bottom Navigation (4 Primary Tabs: Painel, Kanban, Agenda, Mais) */}
      <nav
        aria-label="Navegação Mobile"
        className="glass-bar safe-bottom fixed bottom-0 inset-x-0 z-30 border-t border-[var(--border-hairline)] lg:hidden"
      >
        <div className="grid grid-cols-4 gap-1 px-2 pt-1.5">
          {(
            [
              { id: "dashboard", label: "Painel", icon: LayoutDashboard },
              { id: "kanban", label: "Kanban", icon: Kanban },
              { id: "agenda", label: "Agenda", icon: Calendar },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeModule === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  triggerHaptic(8);
                  setShowMobileMore(false);
                  setActiveModule(tab.id);
                }}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[50px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[11px] font-semibold transition-colors",
                  active
                    ? "bg-[var(--accent-soft)] text-[var(--accent-text)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              setShowMobileMore((prev) => !prev);
            }}
            className={cn(
              "flex min-h-[50px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[11px] font-semibold transition-colors",
              showMobileMore ||
                ["capture", "dispatcher", "partners", "settings"].includes(
                  activeModule
                )
                ? "bg-[var(--accent-soft)] text-[var(--accent-text)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            <LayoutGrid className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
            <span>Mais</span>
          </button>
        </div>
      </nav>

      {/* Draggable iOS-Style Bottom Sheet for Secondary Modules + Quick Studio Skins */}
      <DraggableBottomSheet
        open={showMobileMore}
        title="Módulos & Studio Skins"
        onClose={() => setShowMobileMore(false)}
      >
        <div className="grid grid-cols-2 gap-2.5">
          {(
            [
              { id: "capture", label: "Captação BH", icon: UserPlus },
              { id: "dispatcher", label: "Disparador", icon: Send },
              { id: "partners", label: "Parceiros", icon: Handshake },
              { id: "settings", label: "Config & Push", icon: Settings },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  setActiveModule(item.id);
                  setShowMobileMore(false);
                }}
                className={cn(
                  "flex min-h-[52px] items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-xs font-bold transition-colors",
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]"
                    : "border-[var(--border-hairline)] bg-[var(--bg-subtle)] text-[var(--text-primary)]"
                )}
              >
                <Icon className="h-4 w-4 text-[var(--accent-text)] shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="border-t border-[var(--border-hairline)] pt-3 space-y-2">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            <Palette className="h-3.5 w-3.5 text-[var(--accent-text)]" />
            Studio Skin Rápida
          </p>
          <div className="grid grid-cols-4 gap-2">
            {STUDIO_SKINS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  triggerHaptic(8);
                  setSkin(s.id);
                }}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border p-2 text-[10px] font-semibold",
                  skin === s.id
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text-primary)]"
                    : "border-[var(--border-hairline)] text-[var(--text-secondary)]"
                )}
              >
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-white/20"
                  style={{ backgroundColor: s.swatchBg }}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: s.swatchAccent }}
                  />
                </span>
                <span className="truncate max-w-full">
                  {s.label.split(" ")[0]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </DraggableBottomSheet>

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
