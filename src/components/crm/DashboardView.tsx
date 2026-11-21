"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Clock,
  DollarSign,
  Eye,
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
  StudioSettings,
} from "@/types/crm";
import {
  cn,
  formatCurrency,
  formatCurrencyExact,
  formatRelativeTime,
  getConfirmedRevenue,
  getFunnelLabel,
  getLeadStagnation,
  getPartnerCommission,
  getStageLabel,
} from "@/lib/utils";

interface DashboardViewProps {
  leads: Lead[];
  partners: Partner[];
  settings: StudioSettings;
  onUpdateMonthlyGoal: (goal: number) => Promise<void>;
  onSelectLead: (lead: Lead) => void;
  onJumpToFunnel: (funnel: FunnelId) => void;
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
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(String(settings.monthlyGoal));
  const [savingGoal, setSavingGoal] = useState(false);

  const filteredLeads = useMemo(() => {
    if (selectedFunnel === "all") return leads;
    return leads.filter((l) => l.funnel === selectedFunnel);
  }, [leads, selectedFunnel]);

  const metrics = useMemo(() => {
    let confirmedTotal = 0;
    let confirmedSinais = 0;
    let confirmedQuitados = 0;
    let pipelineTotal = 0;
    let pipelineCount = 0;
    let stagnant48Count = 0;
    let stagnant5dCount = 0;
    let commissionsPayable = 0;
    let commissionsPaid = 0;

    const stagnantLeads: Array<{
      lead: Lead;
      stagnation: ReturnType<typeof getLeadStagnation>;
    }> = [];

    const partnerBreakdown = new Map<
      string,
      { partner: Partner; total: number; pending: number; leadsCount: number }
    >();

    for (const lead of filteredLeads) {
      const confirmed = getConfirmedRevenue(lead);
      confirmedTotal += confirmed;

      if (lead.paymentStatus === "quitado" || lead.stage === "fechado") {
        confirmedQuitados += lead.estimatedValue;
      } else if (
        lead.paymentStatus === "sinal_pago" ||
        lead.stage === "sinal_pago"
      ) {
        confirmedSinais += lead.estimatedValue * 0.5;
      }

      if (lead.stage !== "fechado") {
        pipelineTotal += lead.estimatedValue;
        pipelineCount += 1;
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

    const viewedProposals = filteredLeads
      .filter((l) => l.visualizadaEm)
      .sort(
        (a, b) =>
          new Date(b.visualizadaEm || 0).getTime() -
          new Date(a.visualizadaEm || 0).getTime()
      );

    return {
      confirmedTotal,
      confirmedSinais,
      confirmedQuitados,
      pipelineTotal,
      pipelineCount,
      stagnantTotal: stagnantLeads.length,
      stagnant48Count,
      stagnant5dCount,
      stagnantLeads,
      commissionsPayable,
      commissionsPaid,
      partnerBreakdown: Array.from(partnerBreakdown.values()),
      viewedProposals,
    };
  }, [filteredLeads, partners]);

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
      const fLeads = leads.filter((l) => l.funnel === f.id);
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
  }, [leads]);

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

  return (
    <div className="space-y-6">
      {/* Header + Revenue Stream Quick Filters */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono-num text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            ÚLTIMO QUADRO · BH &amp; Nova Lima · 24FPS
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            Painel Financeiro &amp; Metas Comerciais
          </h1>
        </div>

        <div
          className="flex flex-wrap items-center gap-1.5 rounded-2xl p-1.5 glass-panel"
          role="tablist"
          aria-label="Filtrar por frente de receita"
        >
          <button
            type="button"
            onClick={() => setSelectedFunnel("all")}
            className={cn(
              "rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer",
              selectedFunnel === "all"
                ? "bg-[var(--accent)] text-[var(--accent-fg)] shadow-sm"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            Todas as Frentes
          </button>
          {FUNNELS.map((funnel) => (
            <button
              key={funnel.id}
              type="button"
              onClick={() => setSelectedFunnel(funnel.id)}
              className={cn(
                "rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer",
                selectedFunnel === funnel.id
                  ? "bg-[var(--accent)] text-[var(--accent-fg)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              {funnel.shortLabel}
            </button>
          ))}
        </div>
      </div>

      {/* Primary Asymmetric Bento Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        {/* Card 1: Faturamento Confirmado vs Meta Mensal Editável (6 cols) */}
        <section className="glass-panel rounded-3xl p-6 md:col-span-12 xl:col-span-6 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                  <DollarSign className="h-4 w-4" strokeWidth={2} />
                </span>
                Faturamento Confirmado (Sinais + Quitados)
              </div>
              <div className="mt-4 flex flex-wrap items-baseline gap-3">
                <span className="font-mono-num text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:text-4xl">
                  {formatCurrency(metrics.confirmedTotal)}
                </span>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-mono-num text-xs font-semibold text-emerald-400">
                  {goalProgress.toFixed(1)}% da meta
                </span>
              </div>
            </div>

            {/* Editable Monthly Goal Control */}
            <div className="text-right">
              <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Meta Mensal
              </span>
              {editingGoal ? (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <input
                    type="number"
                    min={500}
                    step={500}
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    className="input-field w-28 rounded-xl px-2.5 py-1.5 font-mono-num text-xs font-semibold"
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
                    className="btn-accent flex h-8 w-8 items-center justify-center rounded-xl cursor-pointer"
                    title="Salvar meta"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingGoal(false);
                      setGoalInput(String(settings.monthlyGoal));
                    }}
                    className="btn-ghost flex h-8 w-8 items-center justify-center rounded-xl cursor-pointer"
                    title="Cancelar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setGoalInput(String(settings.monthlyGoal));
                    setEditingGoal(true);
                  }}
                  className="mt-1 inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] px-2.5 py-1 font-mono-num text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--accent-border)] transition-colors cursor-pointer"
                >
                  {formatCurrency(settings.monthlyGoal)}
                  <Pencil className="h-3 w-3 text-[var(--text-muted)]" />
                </button>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-emerald-400 transition-all duration-500"
                style={{ width: `${Math.max(4, goalProgress)}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="rounded-2xl bg-[var(--bg-subtle)]/70 px-3.5 py-2.5">
                <p className="text-[11px] text-[var(--text-muted)]">
                  Sinais (50%)
                </p>
                <p className="mt-0.5 font-mono-num text-sm font-semibold text-[var(--text-primary)]">
                  {formatCurrency(metrics.confirmedSinais)}
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--bg-subtle)]/70 px-3.5 py-2.5">
                <p className="text-[11px] text-[var(--text-muted)]">
                  Quitados (100%)
                </p>
                <p className="mt-0.5 font-mono-num text-sm font-semibold text-emerald-400">
                  {formatCurrency(metrics.confirmedQuitados)}
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--bg-subtle)]/70 px-3.5 py-2.5">
                <p className="text-[11px] text-[var(--text-muted)]">
                  Falta p/ Meta
                </p>
                <p className="mt-0.5 font-mono-num text-sm font-semibold text-[var(--accent)]">
                  {formatCurrency(remainingGoal)}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Card 2: Valor em Negociação (Pipeline) (3 cols) */}
        <section className="glass-panel rounded-3xl p-6 md:col-span-6 xl:col-span-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <TrendingUp className="h-4.5 w-4.5" strokeWidth={2} />
              </span>
              <span className="rounded-full border border-[var(--border-hairline)] px-2.5 py-0.5 font-mono-num text-[11px] text-[var(--text-secondary)]">
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

        {/* Card 3: Leads Parados (Follow-up Urgente) (3 cols) */}
        <section className="glass-panel rounded-3xl p-6 md:col-span-6 xl:col-span-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-2xl",
                  metrics.stagnant5dCount > 0
                    ? "bg-rose-500/15 text-rose-400"
                    : metrics.stagnantTotal > 0
                    ? "bg-amber-500/15 text-amber-400"
                    : "bg-emerald-500/15 text-emerald-400"
                )}
              >
                <AlertTriangle className="h-4.5 w-4.5" strokeWidth={2} />
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

          <div className="mt-6 flex items-center gap-2 border-t border-[var(--border-hairline)] pt-4 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 font-medium text-amber-400">
              <Clock className="h-3 w-3" />
              {metrics.stagnant48Count} (+48h)
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-0.5 font-medium text-rose-400">
              <AlertTriangle className="h-3 w-3" />
              {metrics.stagnant5dCount} (+5 dias)
            </span>
          </div>
        </section>

        {/* Row 2: Comissões de Parceiros (15%) (4 cols) + Frentes de Receita (4 cols) + Radar Follow-up & Propostas (4 cols) */}
        <section className="glass-panel rounded-3xl p-6 md:col-span-6 xl:col-span-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                  <Handshake className="h-4 w-4" />
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
              Modelos de provador &amp; gerentes de espaços (pagos:{" "}
              <span className="font-mono-num text-[var(--text-secondary)]">
                {formatCurrencyExact(metrics.commissionsPaid)}
              </span>
              )
            </p>
          </div>

          <div className="mt-5 space-y-2.5 border-t border-[var(--border-hairline)] pt-4">
            {metrics.partnerBreakdown.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">
                Nenhum parceiro vinculado nesta frente.
              </p>
            ) : (
              metrics.partnerBreakdown.map((item) => (
                <div
                  key={item.partner.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--bg-subtle)]/70 px-3.5 py-2.5"
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
                  <span className="font-mono-num text-xs font-semibold text-[var(--accent)] shrink-0">
                    {formatCurrencyExact(item.pending)}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Revenue Streams Bento Tile */}
        <section className="glass-panel rounded-3xl p-6 md:col-span-6 xl:col-span-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
                  <Users className="h-4 w-4" />
                </span>
                Frentes de Receita
              </div>
              <span className="text-[11px] text-[var(--text-muted)]">
                Confirmado + Pipeline
              </span>
            </div>

            <div className="mt-5 space-y-4">
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
                    className="group w-full text-left rounded-2xl p-2 -mx-2 hover:bg-[var(--bg-subtle)]/60 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors inline-flex items-center gap-1">
                        {f.label}
                        <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </span>
                      <span className="font-mono-num text-[var(--text-secondary)]">
                        {formatCurrency(f.confirmed)}{" "}
                        <span className="text-[var(--text-muted)]">
                          / {formatCurrency(f.pipeline)}
                        </span>
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                      <div
                        className="flex h-full rounded-full overflow-hidden"
                        style={{ width: `${widthPct}%` }}
                      >
                        <div
                          className="h-full bg-emerald-400"
                          style={{ width: `${confirmedPct}%` }}
                        />
                        <div
                          className="h-full bg-[var(--accent)]/60"
                          style={{ width: `${100 - confirmedPct}%` }}
                        />
                      </div>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                      <span>{f.subtitle}</span>
                      <span>
                        {f.count} {f.count === 1 ? "lead" : "leads"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4 border-t border-[var(--border-hairline)] pt-3 text-[11px] text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Confirmado
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--accent)]/70" />
              Em negociação
            </span>
          </div>
        </section>

        {/* Actionable Follow-up & Recent Proposal Views Radar */}
        <section className="glass-panel rounded-3xl p-6 md:col-span-12 xl:col-span-4 flex flex-col">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                <Clock className="h-4 w-4" />
              </span>
              Radar de Ação Imediata
            </div>
            <span className="font-mono-num text-[11px] text-[var(--text-muted)]">
              {metrics.stagnantLeads.length} alertas
            </span>
          </div>

          <div className="mt-4 flex-1 space-y-2.5">
            {metrics.stagnantLeads.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border-hairline)] p-5 text-center">
                <p className="text-xs font-medium text-[var(--text-secondary)]">
                  Nenhum lead estagnado acima de 48h.
                </p>
                <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                  Seu ritmo de follow-up está em dia.
                </p>
              </div>
            ) : (
              metrics.stagnantLeads.slice(0, 4).map(({ lead, stagnation }) => (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => onSelectLead(lead)}
                  className="w-full text-left rounded-2xl bg-[var(--bg-subtle)]/75 px-3.5 py-3 hover:bg-[var(--bg-surface-hover)] border border-transparent hover:border-[var(--border-strong)] transition-all cursor-pointer"
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
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        stagnation.level === "critical"
                          ? "bg-rose-500/15 text-rose-400"
                          : "bg-amber-500/15 text-amber-400"
                      )}
                    >
                      {stagnation.label}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <span className="text-[var(--text-secondary)]">
                      {getStageLabel(lead.stage)}
                    </span>
                    <span className="font-mono-num font-semibold text-[var(--text-primary)]">
                      {formatCurrency(lead.estimatedValue)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

          {metrics.viewedProposals.length > 0 && (
            <div className="mt-4 border-t border-[var(--border-hairline)] pt-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-[var(--accent)]" />
                Propostas Visualizadas Recentemente
              </p>
              <div className="mt-2 space-y-1.5">
                {metrics.viewedProposals.slice(0, 2).map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => onSelectLead(lead)}
                    className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
                  >
                    <span className="truncate font-medium text-[var(--text-primary)]">
                      {lead.companyName}
                    </span>
                    <span className="shrink-0 text-[11px] text-[var(--accent)] font-mono-num">
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
    </div>
  );
}
