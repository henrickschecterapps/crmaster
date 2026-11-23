"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  Check,
  Clock,
  DollarSign,
  Download,
  Eye,
  Film,
  Handshake,
  Pencil,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import {
  FUNNELS,
  FunnelId,
  Lead,
  Partner,
  PARTNER_ROLES,
  STAGES,
  StudioSettings,
} from "@/types/crm";
import {
  cn,
  exportLeadsToCsv,
  formatCurrency,
  formatCurrencyExact,
  formatRelativeTime,
  getConfirmedRevenue,
  getFunnelLabel,
  getLeadStagnation,
  getPartnerCommission,
  getStageLabel,
} from "@/lib/utils";

type PeriodFilter = "all" | "month" | "prev_month";

interface DashboardViewProps {
  leads: Lead[];
  partners: Partner[];
  settings: StudioSettings;
  onUpdateMonthlyGoal: (goal: number) => Promise<void>;
  onSelectLead: (lead: Lead) => void;
  onJumpToFunnel: (funnel: FunnelId) => void;
}

function getLeadReferenceDate(lead: Lead): Date {
  if (lead.eventDate && /^\d{4}-\d{2}-\d{2}$/.test(lead.eventDate)) {
    const [y, m, d] = lead.eventDate.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(lead.createdAt);
}

function matchesPeriod(lead: Lead, period: PeriodFilter): boolean {
  if (period === "all") return true;
  const now = new Date();
  const ref = getLeadReferenceDate(lead);
  if (Number.isNaN(ref.getTime())) return true;

  if (period === "month") {
    return (
      ref.getFullYear() === now.getFullYear() &&
      ref.getMonth() === now.getMonth()
    );
  }

  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return (
    ref.getFullYear() === prevMonthDate.getFullYear() &&
    ref.getMonth() === prevMonthDate.getMonth()
  );
}

export function DashboardView({
  leads,
  partners,
  settings,
  onUpdateMonthlyGoal,
  onSelectLead,
  onJumpToFunnel,
}: DashboardViewProps) {
  const [selectedFunnel, setSelectedFunnel] = useState<FunnelId | "all">("all");
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(String(settings.monthlyGoal));
  const [savingGoal, setSavingGoal] = useState(false);

  const periodLeads = useMemo(
    () => leads.filter((l) => matchesPeriod(l, period)),
    [leads, period]
  );

  const filteredLeads = useMemo(() => {
    if (selectedFunnel === "all") return periodLeads;
    return periodLeads.filter((l) => l.funnel === selectedFunnel);
  }, [periodLeads, selectedFunnel]);

  const metrics = useMemo(() => {
    let confirmedTotal = 0;
    let confirmedSinais = 0;
    let confirmedQuitados = 0;
    let accountsReceivable = 0; // Saldo 50% garantido de contratos com sinal pago
    let pipelineTotal = 0;
    let pipelineCount = 0;
    let wonCount = 0;
    let lostCount = 0;
    let stagnant48Count = 0;
    let stagnant5dCount = 0;
    let commissionsPayable = 0;
    let commissionsPaid = 0;

    const originStatsMap = new Map<
      string,
      { origin: string; total: number; won: number; revenue: number }
    >();

    const dueActions: Array<{
      lead: Lead;
      title: string;
      dueAt: string;
      overdue: boolean;
    }> = [];

    const nowMs = Date.now();

    const stagnantLeads: Array<{
      lead: Lead;
      stagnation: ReturnType<typeof getLeadStagnation>;
    }> = [];

    const partnerBreakdown = new Map<
      string,
      { partner: Partner; total: number; pending: number; leadsCount: number }
    >();

    for (const lead of filteredLeads) {
      const originKey = (lead.origin || "Outros").split("(")[0].trim() || "Outros";
      const orig = originStatsMap.get(originKey) ?? {
        origin: originKey,
        total: 0,
        won: 0,
        revenue: 0,
      };
      orig.total += 1;

      if (lead.archived) {
        lostCount += 1;
        originStatsMap.set(originKey, orig);
        continue;
      }

      const confirmed = getConfirmedRevenue(lead);
      confirmedTotal += confirmed;

      const isWon =
        lead.paymentStatus === "quitado" ||
        lead.paymentStatus === "sinal_pago" ||
        lead.stage === "sinal_pago" ||
        lead.stage === "fechado";

      if (isWon) {
        wonCount += 1;
        orig.won += 1;
        orig.revenue += lead.estimatedValue;
      }
      originStatsMap.set(originKey, orig);

      if (lead.paymentStatus === "quitado" || lead.stage === "fechado") {
        confirmedQuitados += lead.estimatedValue;
      } else if (
        lead.paymentStatus === "sinal_pago" ||
        lead.stage === "sinal_pago"
      ) {
        confirmedSinais += lead.estimatedValue * 0.5;
        accountsReceivable += lead.estimatedValue * 0.5;
      }

      if (lead.stage !== "fechado") {
        pipelineTotal += lead.estimatedValue;
        pipelineCount += 1;
      }

      if (lead.nextAction && !lead.nextAction.completed && lead.nextAction.dueAt) {
        const dueMs = new Date(lead.nextAction.dueAt).getTime();
        dueActions.push({
          lead,
          title: lead.nextAction.title,
          dueAt: lead.nextAction.dueAt,
          overdue: Number.isFinite(dueMs) && dueMs < nowMs,
        });
      }

      const stagnation = getLeadStagnation(lead);
      if (stagnation.level !== "none") {
        stagnantLeads.push({ lead, stagnation });
        if (stagnation.level === "critical") stagnant5dCount += 1;
        else stagnant48Count += 1;
      }

      if (lead.partnerId) {
        const partner = partners.find((p) => p.id === lead.partnerId);
        if (partner) {
          const commission = getPartnerCommission(lead, partners);
          const isQualifying =
            lead.stage === "sinal_pago" ||
            lead.stage === "fechado" ||
            lead.paymentStatus !== "pendente";

          if (isQualifying) {
            if (lead.commissionPaid) commissionsPaid += commission;
            else commissionsPayable += commission;
          }

          const existing = partnerBreakdown.get(partner.id) ?? {
            partner,
            total: 0,
            pending: 0,
            leadsCount: 0,
          };
          existing.leadsCount += 1;
          if (isQualifying) {
            existing.total += commission;
            if (!lead.commissionPaid) existing.pending += commission;
          }
          partnerBreakdown.set(partner.id, existing);
        }
      }
    }

    stagnantLeads.sort(
      (a, b) => b.stagnation.hoursSince - a.stagnation.hoursSince
    );
    dueActions.sort((a, b) => a.dueAt.localeCompare(b.dueAt));

    const viewedProposals = filteredLeads
      .filter((l) => !l.archived && l.visualizadaEm)
      .sort(
        (a, b) =>
          new Date(b.visualizadaEm || 0).getTime() -
          new Date(a.visualizadaEm || 0).getTime()
      );

    const closedTotal = wonCount + lostCount;
    const conversionRate =
      closedTotal > 0 ? Math.round((wonCount / closedTotal) * 100) : 0;
    const netRevenue = Math.max(
      0,
      confirmedTotal - (commissionsPaid + commissionsPayable)
    );
    const avgTicket = wonCount > 0 ? Math.round((confirmedQuitados + confirmedSinais * 2) / wonCount) : 0;

    return {
      confirmedTotal,
      confirmedSinais,
      confirmedQuitados,
      accountsReceivable,
      netRevenue,
      wonCount,
      lostCount,
      conversionRate,
      avgTicket,
      pipelineTotal,
      pipelineCount,
      stagnantTotal: stagnantLeads.length,
      stagnant48Count,
      stagnant5dCount,
      stagnantLeads,
      dueActions,
      originStats: Array.from(originStatsMap.values()).sort(
        (a, b) => b.revenue - a.revenue || b.total - a.total
      ),
      commissionsPayable,
      commissionsPaid,
      partnerBreakdown: Array.from(partnerBreakdown.values()),
      viewedProposals,
    };
  }, [filteredLeads, partners]);

  const stageSummary = useMemo(() => {
    const activeLeads = filteredLeads.filter((l) => !l.archived);
    const totalCount = Math.max(1, activeLeads.length);
    return STAGES.map((s) => {
      const sLeads = activeLeads.filter((l) => l.stage === s.id);
      const sum = sLeads.reduce((acc, l) => acc + l.estimatedValue, 0);
      return {
        ...s,
        count: sLeads.length,
        pct: Math.round((sLeads.length / totalCount) * 100),
        sum,
      };
    });
  }, [filteredLeads]);

  const goalProgress =
    settings.monthlyGoal > 0
      ? Math.min(100, (metrics.confirmedTotal / settings.monthlyGoal) * 100)
      : 0;
  const remainingGoal = Math.max(
    0,
    settings.monthlyGoal - metrics.confirmedTotal
  );

  const funnelStats = useMemo(() => {
    return FUNNELS.map((f) => {
      const fLeads = periodLeads.filter((l) => l.funnel === f.id);
      const confirmed = fLeads.reduce(
        (sum, l) => sum + getConfirmedRevenue(l),
        0
      );
      const pipeline = fLeads
        .filter((l) => l.stage !== "fechado")
        .reduce((sum, l) => sum + l.estimatedValue, 0);
      return {
        ...f,
        count: fLeads.length,
        confirmed,
        pipeline,
      };
    });
  }, [periodLeads]);

  const maxFunnelTotal = Math.max(
    1,
    ...funnelStats.map((f) => f.confirmed + f.pipeline)
  );

  const handleSaveGoal = async () => {
    const parsed = Number(goalInput.replace(/[^\d.,]/g, "").replace(",", "."));
    if (!parsed || parsed <= 0) return;
    setSavingGoal(true);
    try {
      await onUpdateMonthlyGoal(parsed);
      setEditingGoal(false);
    } finally {
      setSavingGoal(false);
    }
  };

  const handleExportCsv = () => {
    const csv = exportLeadsToCsv(filteredLeads, partners);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `ultimo-quadro-relatorio-${period}-${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const periodOptions: Array<{ id: PeriodFilter; label: string }> = [
    { id: "month", label: "Este Mês" },
    { id: "prev_month", label: "Mês Anterior" },
    { id: "all", label: "Todos" },
  ];

  return (
    <div className="space-y-6">
      {/* Header + Period & Vertical Dock Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono-num text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-text)]">
              ÚLTIMO QUADRO · STUDIO OS · 24FPS
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
              Painel Financeiro &amp; Metas Comerciais
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className="dock-shell inline-flex items-center gap-1"
              role="group"
              aria-label="Filtrar por período"
            >
              <Calendar
                className="ml-2 mr-1 h-3.5 w-3.5 text-[var(--text-muted)]"
                aria-hidden="true"
              />
              {periodOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPeriod(opt.id)}
                  aria-pressed={period === opt.id}
                  className={cn(
                    "min-h-[34px] rounded-lg px-3 py-1 text-xs font-semibold transition-all",
                    period === opt.id
                      ? "bg-[var(--bg-surface-solid)] text-[var(--text-primary)] border border-[var(--accent-border)] shadow-sm"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              className="btn-ghost inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold bg-[var(--bg-surface-solid)]"
            >
              <Download className="h-3.5 w-3.5 text-[var(--accent-text)]" aria-hidden="true" />
              Exportar CSV ({filteredLeads.length})
            </button>
          </div>
        </div>

        <div
          className="dock-shell flex flex-wrap items-center gap-1"
          role="tablist"
          aria-label="Filtrar por frente de receita"
        >
          <button
            type="button"
            role="tab"
            aria-selected={selectedFunnel === "all"}
            onClick={() => setSelectedFunnel("all")}
            className={cn(
              "min-h-[36px] rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all",
              selectedFunnel === "all"
                ? "bg-[var(--bg-surface-solid)] text-[var(--text-primary)] border border-[var(--accent-border)] shadow-sm"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent"
            )}
          >
            Todas as Frentes
          </button>
          {FUNNELS.map((funnel) => (
            <button
              key={funnel.id}
              type="button"
              role="tab"
              aria-selected={selectedFunnel === funnel.id}
              onClick={() => setSelectedFunnel(funnel.id)}
              className={cn(
                "min-h-[36px] rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all",
                selectedFunnel === funnel.id
                  ? "bg-[var(--bg-surface-solid)] text-[var(--text-primary)] border border-[var(--accent-border)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent"
              )}
            >
              <span className="font-mono-num mr-1.5 text-[10px] text-[var(--text-muted)]">
                {funnel.index}
              </span>
              {funnel.shortLabel}
            </button>
          ))}
        </div>
      </div>

      {/* Primary Asymmetric Double-Bezel Studio Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        {/* Card 1: Faturamento Confirmado vs Meta Mensal (Double-Bezel + Hairline internal breakdown) */}
        <div
          className="double-bezel stagger-in md:col-span-12 xl:col-span-6"
          style={{ ["--stagger" as string]: 0 }}
        >
          <section className="double-bezel-core viewfinder-frame h-full p-6 flex flex-col justify-between">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--status-success-bg)] text-[var(--status-success)]">
                    <DollarSign
                      className="h-4 w-4"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  </span>
                  Faturamento Confirmado (Sinais + Quitados)
                </div>
                <div className="mt-4 flex flex-wrap items-baseline gap-3">
                  <span className="font-mono-num text-4xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-5xl">
                    {formatCurrency(metrics.confirmedTotal)}
                  </span>
                  <span className="badge-success rounded-md px-2.5 py-0.5 font-mono-num text-xs font-semibold">
                    {goalProgress.toFixed(1)}% da meta
                  </span>
                </div>
              </div>

              <div className="text-right">
                <label
                  htmlFor="dashboard-monthly-goal"
                  className="block text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]"
                >
                  Meta Mensal
                </label>
                {editingGoal ? (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <input
                      id="dashboard-monthly-goal"
                      type="number"
                      min={500}
                      step={500}
                      value={goalInput}
                      onChange={(e) => setGoalInput(e.target.value)}
                      className="input-field min-h-[40px] w-28 rounded-lg px-2.5 py-1.5 font-mono-num text-xs font-semibold"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveGoal();
                        if (e.key === "Escape") setEditingGoal(false);
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleSaveGoal}
                      disabled={savingGoal}
                      className="btn-accent flex h-10 w-10 items-center justify-center rounded-lg"
                      aria-label="Salvar meta mensal"
                      title="Salvar meta"
                    >
                      <Check className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingGoal(false);
                        setGoalInput(String(settings.monthlyGoal));
                      }}
                      className="btn-ghost flex h-10 w-10 items-center justify-center rounded-lg"
                      aria-label="Cancelar edição da meta"
                      title="Cancelar"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setGoalInput(String(settings.monthlyGoal));
                      setEditingGoal(true);
                    }}
                    className="mt-1 inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] px-3 py-1.5 font-mono-num text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--accent-border)] transition-colors"
                  >
                    {formatCurrency(settings.monthlyGoal)}
                    <Pencil
                      className="h-3.5 w-3.5 text-[var(--text-muted)]"
                      aria-hidden="true"
                    />
                  </button>
                )}
              </div>
            </div>

            {/* 24FPS Film-Reel Timecode Progress Bar + Hairline Divided Sub-metrics */}
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between font-mono-num text-[10px] text-[var(--text-muted)]">
                  <span className="inline-flex items-center gap-1">
                    <Film
                      className="h-3 w-3 text-[var(--accent-text)]"
                      aria-hidden="true"
                    />
                    00:00 · INÍCIO
                  </span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>75%</span>
                  <span className="font-bold text-[var(--accent-text)]">
                    97% CLÍMAX
                  </span>
                </div>

                <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)] border border-[var(--border-hairline)]">
                  <div
                    className="h-full bg-[var(--accent)] transition-all duration-500"
                    style={{ width: `${Math.max(3, goalProgress)}%` }}
                  />
                  <div
                    className="pointer-events-none absolute inset-y-0 w-[2px] bg-[var(--text-primary)]/50"
                    style={{ left: "97%" }}
                    title="Frame 97% Clímax"
                  />
                </div>
              </div>

              {/* Anti-Card Overuse: Clean 1px Hairline Divided Row instead of nested boxes */}
              <div className="grid grid-cols-1 divide-y divide-[var(--border-hairline)] border-t border-[var(--border-hairline)] pt-3 sm:grid-cols-3 sm:divide-y-0 sm:divide-x">
                <div className="py-2 sm:py-0 sm:pr-4">
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Sinais Recebidos (50%)
                  </p>
                  <p className="mt-0.5 font-mono-num text-sm font-bold text-[var(--text-primary)]">
                    {formatCurrency(metrics.confirmedSinais)}
                  </p>
                </div>
                <div className="py-2 sm:py-0 sm:px-4">
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Projetos Quitados (100%)
                  </p>
                  <p className="mt-0.5 font-mono-num text-sm font-bold text-[var(--status-success)]">
                    {formatCurrency(metrics.confirmedQuitados)}
                  </p>
                </div>
                <div className="py-2 sm:py-0 sm:pl-4">
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Falta p/ Meta Mensal
                  </p>
                  <p className="mt-0.5 font-mono-num text-sm font-bold text-[var(--accent-text)]">
                    {formatCurrency(remainingGoal)}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Card 2: Valor em Negociação (Pipeline) */}
        <div
          className="double-bezel stagger-in md:col-span-6 xl:col-span-3"
          style={{ ["--stagger" as string]: 1 }}
        >
          <section className="double-bezel-core h-full p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-text)]">
                  <TrendingUp
                    className="h-4.5 w-4.5"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </span>
                <span className="rounded-md border border-[var(--border-hairline)] px-2.5 py-0.5 font-mono-num text-[11px] text-[var(--text-secondary)]">
                  {metrics.pipelineCount} ativos
                </span>
              </div>
              <p className="mt-5 text-xs font-medium text-[var(--text-secondary)]">
                Valor em Negociação (Pipeline)
              </p>
              <p className="mt-2 font-mono-num text-3xl font-bold tracking-tight text-[var(--text-primary)]">
                {formatCurrency(metrics.pipelineTotal)}
              </p>
            </div>
            <div className="mt-6 border-t border-[var(--border-hairline)] pt-4 flex items-center justify-between text-xs">
              <span className="text-[var(--text-muted)]">Ticket médio ativo</span>
              <span className="font-mono-num font-semibold text-[var(--text-primary)]">
                {metrics.pipelineCount > 0
                  ? formatCurrency(metrics.pipelineTotal / metrics.pipelineCount)
                  : "R$ 0"}
              </span>
            </div>
          </section>
        </div>

        {/* Card 3: Leads Parados */}
        <div
          className="double-bezel stagger-in md:col-span-6 xl:col-span-3"
          style={{ ["--stagger" as string]: 2 }}
        >
          <section className="double-bezel-core h-full p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg",
                    metrics.stagnant5dCount > 0
                      ? "bg-[var(--status-danger-bg)] text-[var(--status-danger)]"
                      : metrics.stagnantTotal > 0
                      ? "bg-[var(--status-warning-bg)] text-[var(--status-warning)]"
                      : "bg-[var(--status-success-bg)] text-[var(--status-success)]"
                  )}
                >
                  <AlertTriangle
                    className="h-4.5 w-4.5"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </span>
                <span className="text-[11px] font-medium text-[var(--text-muted)]">
                  &gt; 48h sem contato
                </span>
              </div>
              <p className="mt-5 text-xs font-medium text-[var(--text-secondary)]">
                Leads Parados (Follow-up Urgente)
              </p>
              <p className="mt-2 font-mono-num text-3xl font-bold tracking-tight text-[var(--text-primary)]">
                {metrics.stagnantTotal}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-[var(--border-hairline)] pt-4 text-xs">
              <span className="badge-warning inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 font-medium">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {metrics.stagnant48Count} (+48h)
              </span>
              <span className="badge-danger inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 font-medium">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                {metrics.stagnant5dCount} (+5 dias)
              </span>
            </div>
          </section>
        </div>

        {/* Horizontal 6-Stage Commercial Funnel Strip (Double-Bezel + Hairline Dividers, Zero Nested Cards) */}
        <div
          className="double-bezel stagger-in md:col-span-12"
          style={{ ["--stagger" as string]: 3 }}
        >
          <section className="double-bezel-core overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] px-5 py-3">
              <span className="font-mono-num text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Termômetro de Etapas do Funil · {filteredLeads.length} leads
              </span>
              <span className="font-mono-num text-[11px] text-[var(--text-secondary)]">
                Distribuição do pipeline por etapa comercial
              </span>
            </div>

            <div className="grid grid-cols-2 divide-y divide-x divide-[var(--border-hairline)] sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
              {stageSummary.map((st, idx) => (
                <div
                  key={st.id}
                  className="px-4 py-3.5 flex flex-col justify-between gap-2 hover:bg-[var(--bg-surface-hover)] transition-colors"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)] truncate">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full shrink-0",
                          st.accentClass
                        )}
                        aria-hidden="true"
                      />
                      <span className="font-mono-num text-[10px] text-[var(--text-muted)]">
                        0{idx + 1}
                      </span>
                      {st.shortLabel}
                    </span>
                    <span className="font-mono-num text-xs font-bold text-[var(--text-secondary)]">
                      {st.count}
                    </span>
                  </div>

                  <div>
                    <p className="font-mono-num text-xs font-semibold text-[var(--text-secondary)]">
                      {formatCurrency(st.sum)}
                    </p>
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                      <div
                        className={cn("h-full rounded-full", st.accentClass)}
                        style={{ width: `${Math.max(6, st.pct)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Row 3: Comissões de Parceiros (Hairline Divided List) */}
        <div
          className="double-bezel stagger-in md:col-span-6 xl:col-span-4"
          style={{ ["--stagger" as string]: 4 }}
        >
          <section className="double-bezel-core h-full p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-text)]">
                    <Handshake className="h-4 w-4" aria-hidden="true" />
                  </span>
                  Comissões de Parceiros (15%)
                </div>
                <span className="text-[11px] font-medium text-[var(--text-muted)]">
                  A pagar
                </span>
              </div>

              <p className="mt-4 font-mono-num text-3xl font-bold tracking-tight text-[var(--text-primary)]">
                {formatCurrencyExact(metrics.commissionsPayable)}
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Modelos de provador &amp; espaços (pagos:{" "}
                <span className="font-mono-num text-[var(--text-secondary)]">
                  {formatCurrencyExact(metrics.commissionsPaid)}
                </span>
                )
              </p>
            </div>

            <div className="mt-5 border-t border-[var(--border-hairline)] pt-2">
              {metrics.partnerBreakdown.length === 0 ? (
                <p className="py-3 text-xs text-[var(--text-muted)]">
                  Nenhum parceiro vinculado neste filtro.
                </p>
              ) : (
                <div className="divide-y divide-[var(--border-hairline)]">
                  {metrics.partnerBreakdown.map((item) => (
                    <div
                      key={item.partner.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
                          {item.partner.name}
                        </p>
                        <p className="truncate text-[11px] text-[var(--text-muted)]">
                          {PARTNER_ROLES[item.partner.role]} · {item.leadsCount}{" "}
                          {item.leadsCount === 1 ? "indicação" : "indicações"}
                        </p>
                      </div>
                      <span className="font-mono-num text-xs font-bold text-[var(--accent-text)] shrink-0">
                        {formatCurrencyExact(item.pending)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Frentes de Receita (Hairline Divided List) */}
        <div
          className="double-bezel stagger-in md:col-span-6 xl:col-span-4"
          style={{ ["--stagger" as string]: 5 }}
        >
          <section className="double-bezel-core h-full p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--status-info-bg)] text-[var(--status-info)]">
                    <Users className="h-4 w-4" aria-hidden="true" />
                  </span>
                  Frentes de Receita
                </div>
                <span className="text-[11px] text-[var(--text-muted)]">
                  Confirmado + Pipeline
                </span>
              </div>

              <div className="mt-4 divide-y divide-[var(--border-hairline)] border-t border-[var(--border-hairline)]">
                {funnelStats.map((f) => {
                  const total = f.confirmed + f.pipeline;
                  const widthPct = Math.max(8, (total / maxFunnelTotal) * 100);
                  const confirmedPct =
                    total > 0 ? (f.confirmed / total) * 100 : 0;

                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => onJumpToFunnel(f.id)}
                      className="group w-full text-left py-2.5 hover:bg-[var(--bg-surface-hover)] px-2 -mx-2 rounded-lg transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition-colors inline-flex items-center gap-1">
                          <span className="font-mono-num text-[10px] text-[var(--text-muted)] mr-1">
                            {f.index}
                          </span>
                          {f.label}
                          <ArrowUpRight
                            className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-hidden="true"
                          />
                        </span>
                        <span className="font-mono-num text-[var(--text-secondary)]">
                          {formatCurrency(f.confirmed)}{" "}
                          <span className="text-[var(--text-muted)]">
                            / {formatCurrency(f.pipeline)}
                          </span>
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                        <div
                          className="flex h-full rounded-full overflow-hidden"
                          style={{ width: `${widthPct}%` }}
                        >
                          <div
                            className="h-full bg-[var(--status-success)]"
                            style={{ width: `${confirmedPct}%` }}
                          />
                          <div
                            className="h-full bg-[var(--accent)]"
                            style={{ width: `${100 - confirmedPct}%` }}
                          />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 flex items-center gap-4 border-t border-[var(--border-hairline)] pt-3 text-[11px] text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full bg-[var(--status-success)]"
                  aria-hidden="true"
                />
                Confirmado
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full bg-[var(--accent)]"
                  aria-hidden="true"
                />
                Em negociação
              </span>
            </div>
          </section>
        </div>

        {/* Radar de Ação Imediata (Hairline Divided Rows) */}
        <div
          className="double-bezel stagger-in md:col-span-12 xl:col-span-4"
          style={{ ["--stagger" as string]: 6 }}
        >
          <section className="double-bezel-core h-full p-6 flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--status-warning-bg)] text-[var(--status-warning)]">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                </span>
                Radar de Ação Imediata
              </div>
              <span className="font-mono-num text-[11px] text-[var(--text-muted)]">
                {metrics.stagnantLeads.length} alertas
              </span>
            </div>

            <div className="mt-4 flex-1 border-t border-[var(--border-hairline)]">
              {metrics.stagnantLeads.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-xs font-medium text-[var(--text-secondary)]">
                    Nenhum lead estagnado acima de 48h.
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                    Seu ritmo de follow-up está em dia.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-hairline)]">
                  {metrics.stagnantLeads
                    .slice(0, 4)
                    .map(({ lead, stagnation }) => (
                      <button
                        key={lead.id}
                        type="button"
                        onClick={() => onSelectLead(lead)}
                        className="w-full text-left py-3 px-2 -mx-2 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
                              {lead.companyName}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                              {lead.contactName} · {getFunnelLabel(lead.funnel)}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold",
                              stagnation.level === "critical"
                                ? "badge-danger"
                                : "badge-warning"
                            )}
                          >
                            {stagnation.label}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[11px]">
                          <span className="text-[var(--text-secondary)]">
                            {getStageLabel(lead.stage)}
                          </span>
                          <span className="font-mono-num font-semibold text-[var(--text-primary)]">
                            {formatCurrency(lead.estimatedValue)}
                          </span>
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>

            {metrics.viewedProposals.length > 0 && (
              <div className="mt-4 border-t border-[var(--border-hairline)] pt-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                  <Eye
                    className="h-3.5 w-3.5 text-[var(--accent-text)]"
                    aria-hidden="true"
                  />
                  Propostas Visualizadas Recentemente
                </p>
                <div className="mt-2 divide-y divide-[var(--border-hairline)]">
                  {metrics.viewedProposals.slice(0, 2).map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => onSelectLead(lead)}
                      className="flex min-h-[38px] w-full items-center justify-between py-1.5 px-2 -mx-2 rounded-lg text-xs hover:bg-[var(--bg-surface-hover)] transition-colors"
                    >
                      <span className="truncate font-medium text-[var(--text-primary)]">
                        {lead.companyName}
                      </span>
                      <span className="shrink-0 text-[11px] text-[var(--accent-text)] font-mono-num">
                        {lead.visualizacoesProposta}x ·{" "}
                        {lead.visualizadaEm
                          ? formatRelativeTime(lead.visualizadaEm)
                          : ""}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Row 4: Fluxo de Caixa Real + Conversão por Origem + Minhas Ações Agendadas */}
        <div
          className="double-bezel stagger-in md:col-span-6 xl:col-span-4"
          style={{ ["--stagger" as string]: 7 }}
        >
          <section className="double-bezel-core h-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--status-success-bg)] text-[var(--status-success)]">
                  <DollarSign className="h-4 w-4" aria-hidden="true" />
                </span>
                Fluxo de Caixa Real &amp; Conversão
              </div>
              <span className="badge-accent rounded-md px-2 py-0.5 font-mono-num text-[10px] font-bold">
                {metrics.conversionRate}% CONV.
              </span>
            </div>

            <div className="divide-y divide-[var(--border-hairline)] border-t border-[var(--border-hairline)] text-xs">
              <div className="flex items-center justify-between py-2.5">
                <span className="text-[var(--text-secondary)]">
                  Caixa Recebido (Sinais + Quitados)
                </span>
                <span className="font-mono-num font-bold text-[var(--status-success)]">
                  {formatCurrency(metrics.confirmedTotal)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-[var(--text-secondary)]">
                  A Receber Garantido (Saldo 50%)
                </span>
                <span className="font-mono-num font-bold text-[var(--accent-text)]">
                  {formatCurrency(metrics.accountsReceivable)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-[var(--text-secondary)]">
                  Receita Líquida (após comissões)
                </span>
                <span className="font-mono-num font-bold text-[var(--text-primary)]">
                  {formatCurrency(metrics.netRevenue)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-[var(--text-secondary)]">
                  Ganhos vs. Perdidos / Arquivados
                </span>
                <span className="font-mono-num font-semibold text-[var(--text-primary)]">
                  {metrics.wonCount} ganho(s) · {metrics.lostCount} perdido(s)
                </span>
              </div>
              <div className="flex items-center justify-between pt-2.5">
                <span className="text-[var(--text-secondary)]">
                  Ticket Médio Fechado
                </span>
                <span className="font-mono-num font-bold text-[var(--text-primary)]">
                  {formatCurrency(metrics.avgTicket)}
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* Minhas Próximas Ações (Tarefas Manuais de Follow-up) */}
        <div
          className="double-bezel stagger-in md:col-span-6 xl:col-span-4"
          style={{ ["--stagger" as string]: 8 }}
        >
          <section className="double-bezel-core h-full p-6 flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-text)]">
                  <Calendar className="h-4 w-4" aria-hidden="true" />
                </span>
                Próximas Ações &amp; Tarefas
              </div>
              <span className="font-mono-num text-[11px] text-[var(--text-muted)]">
                {metrics.dueActions.length} agendada(s)
              </span>
            </div>

            <div className="mt-4 flex-1 border-t border-[var(--border-hairline)]">
              {metrics.dueActions.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-xs font-medium text-[var(--text-secondary)]">
                    Nenhuma tarefa pendente.
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                    Defina uma Próxima Ação dentro da página do cliente para
                    aparecer aqui.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-hairline)]">
                  {metrics.dueActions.slice(0, 5).map((act) => (
                    <button
                      key={`${act.lead.id}-${act.dueAt}`}
                      type="button"
                      onClick={() => onSelectLead(act.lead)}
                      className="w-full py-3 px-2 -mx-2 rounded-lg text-left hover:bg-[var(--bg-surface-hover)] transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-bold text-[var(--text-primary)]">
                          {act.title}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 rounded-md px-2 py-0.5 font-mono-num text-[10px] font-bold",
                            act.overdue ? "badge-danger" : "badge-info"
                          )}
                        >
                          {act.overdue ? "Atrasada" : act.dueAt.slice(5, 10).split("-").reverse().join("/")}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                        {act.lead.companyName} · {act.lead.contactName}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Conversão & Receita por Canal de Origem */}
        <div
          className="double-bezel stagger-in md:col-span-12 xl:col-span-4"
          style={{ ["--stagger" as string]: 9 }}
        >
          <section className="double-bezel-core h-full p-6 flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-text)]">
                  <TrendingUp className="h-4 w-4" aria-hidden="true" />
                </span>
                Performance por Canal de Origem
              </div>
              <span className="font-mono-num text-[11px] text-[var(--text-muted)]">
                {metrics.originStats.length} canais
              </span>
            </div>

            <div className="mt-4 flex-1 divide-y divide-[var(--border-hairline)] border-t border-[var(--border-hairline)]">
              {metrics.originStats.slice(0, 5).map((row) => {
                const rate =
                  row.total > 0 ? Math.round((row.won / row.total) * 100) : 0;
                return (
                  <div
                    key={row.origin}
                    className="flex items-center justify-between gap-2 py-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--text-primary)]">
                        {row.origin}
                      </p>
                      <p className="font-mono-num text-[11px] text-[var(--text-muted)]">
                        {row.total} leads · {row.won} ganho(s) ({rate}%)
                      </p>
                    </div>
                    <span className="shrink-0 font-mono-num font-bold text-[var(--text-primary)]">
                      {formatCurrency(row.revenue)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
