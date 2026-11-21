"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  Handshake,
  Instagram,
  Kanban,
  List,
  MessageCircle,
  Plus,
  Search,
  Send,
} from "lucide-react";
import {
  FUNNELS,
  FunnelId,
  Lead,
  Partner,
  STAGES,
  StageId,
} from "@/types/crm";
import {
  buildWhatsappUrl,
  cn,
  formatCurrency,
  formatRelativeTime,
  getFunnelLabel,
  getLeadStagnation,
} from "@/lib/utils";

interface KanbanViewProps {
  leads: Lead[];
  partners: Partner[];
  activeFunnel: FunnelId;
  onChangeFunnel: (funnel: FunnelId) => void;
  onMoveStage: (leadId: string, newStage: StageId) => Promise<void>;
  onSelectLead: (lead: Lead) => void;
  onQuickDispatch: (lead: Lead) => void;
  onOpenNewLead: (funnel: FunnelId) => void;
  onNotify?: (message: string, tone?: "success" | "info" | "error") => void;
}

const STAGE_BORDER_COLORS: Record<StageId, string> = {
  captado: "border-l-zinc-400",
  contatado: "border-l-sky-400",
  proposta_aberta: "border-l-[var(--accent)]",
  follow_up: "border-l-amber-400",
  sinal_pago: "border-l-emerald-400",
  fechado: "border-l-emerald-500",
};

const STAGE_ORDER: StageId[] = STAGES.map((s) => s.id);

export function KanbanView({
  leads,
  partners,
  activeFunnel,
  onChangeFunnel,
  onMoveStage,
  onSelectLead,
  onQuickDispatch,
  onOpenNewLead,
  onNotify,
}: KanbanViewProps) {
  const [showAllFunnels, setShowAllFunnels] = useState(false);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [search, setSearch] = useState("");
  const [onlyStagnant, setOnlyStagnant] = useState(false);
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<StageId | null>(null);
  const [copiedLeadId, setCopiedLeadId] = useState<string | null>(null);

  const partnerMap = useMemo(() => {
    const map = new Map<string, Partner>();
    for (const p of partners) map.set(p.id, p);
    return map;
  }, [partners]);

  const funnelLeads = useMemo(() => {
    return leads.filter((l) => {
      if (!showAllFunnels && l.funnel !== activeFunnel) return false;
      if (onlyStagnant && getLeadStagnation(l).level === "none") return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const partnerName = l.partnerId
          ? partnerMap.get(l.partnerId)?.name.toLowerCase() ?? ""
          : "";
        return (
          l.companyName.toLowerCase().includes(q) ||
          l.contactName.toLowerCase().includes(q) ||
          l.origin.toLowerCase().includes(q) ||
          (l.instagram || "").toLowerCase().includes(q) ||
          partnerName.includes(q)
        );
      }
      return true;
    });
  }, [leads, showAllFunnels, activeFunnel, onlyStagnant, search, partnerMap]);

  const leadsByStage = useMemo(() => {
    const grouped: Record<StageId, Lead[]> = {
      captado: [],
      contatado: [],
      proposta_aberta: [],
      follow_up: [],
      sinal_pago: [],
      fechado: [],
    };
    for (const lead of funnelLeads) {
      grouped[lead.stage].push(lead);
    }
    return grouped;
  }, [funnelLeads]);

  const handleDrop = async (targetStage: StageId) => {
    const leadId = draggingLeadId;
    setDraggingLeadId(null);
    setDragOverStage(null);
    if (!leadId) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stage === targetStage) return;
    await onMoveStage(leadId, targetStage);
  };

  const handleCopyProposalUrl = async (lead: Lead) => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/proposta/${lead.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLeadId(lead.id);
      onNotify?.(
        `Link da proposta de ${lead.companyName} copiado.`,
        "info"
      );
      setTimeout(() => {
        setCopiedLeadId((prev) => (prev === lead.id ? null : prev));
      }, 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleStepStage = async (lead: Lead, delta: -1 | 1) => {
    const currentIdx = STAGE_ORDER.indexOf(lead.stage);
    const nextIdx = currentIdx + delta;
    if (nextIdx < 0 || nextIdx >= STAGE_ORDER.length) return;
    await onMoveStage(lead.id, STAGE_ORDER[nextIdx]);
  };

  const allLeadsTotal = useMemo(
    () => leads.reduce((sum, l) => sum + l.estimatedValue, 0),
    [leads]
  );

  return (
    <div className="space-y-5">
      {/* Funnel Tabs Header: "Todas as Verticais" + 5 Official Ultimo Quadro Verticals */}
      <div className="flex flex-col gap-4">
        <div
          className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6"
          role="tablist"
          aria-label="Frentes de serviço do Kanban"
        >
          <button
            type="button"
            role="tab"
            aria-selected={showAllFunnels}
            onClick={() => setShowAllFunnels(true)}
            className={cn(
              "min-h-[60px] rounded-xl px-3.5 py-3 text-left transition-colors border",
              showAllFunnels
                ? "bg-[var(--accent-soft)] border-[var(--accent-border)]"
                : "surface-card hover:border-[var(--border-strong)]"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  "truncate text-xs font-bold tracking-tight",
                  showAllFunnels
                    ? "text-[var(--accent-text)]"
                    : "text-[var(--text-primary)]"
                )}
              >
                <span className="font-mono-num mr-1.5 opacity-75">00</span>
                Todas as Verticais
              </span>
              <span className="rounded-md bg-[var(--bg-subtle)] px-2 py-0.5 font-mono-num text-[11px] font-semibold text-[var(--text-secondary)]">
                {leads.length}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-1 text-[11px] text-[var(--text-muted)]">
              <span className="truncate">Visão Geral 360°</span>
              <span className="font-mono-num text-[var(--text-secondary)] shrink-0">
                {formatCurrency(allLeadsTotal)}
              </span>
            </div>
          </button>

          {FUNNELS.map((funnel) => {
            const fLeads = leads.filter((l) => l.funnel === funnel.id);
            const total = fLeads.reduce((sum, l) => sum + l.estimatedValue, 0);
            const isActive = !showAllFunnels && activeFunnel === funnel.id;
            return (
              <button
                key={funnel.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  setShowAllFunnels(false);
                  onChangeFunnel(funnel.id);
                }}
                className={cn(
                  "min-h-[60px] rounded-xl px-3.5 py-3 text-left transition-colors border",
                  isActive
                    ? "bg-[var(--accent-soft)] border-[var(--accent-border)]"
                    : "surface-card hover:border-[var(--border-strong)]"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "truncate text-xs font-bold tracking-tight",
                      isActive
                        ? "text-[var(--accent-text)]"
                        : "text-[var(--text-primary)]"
                    )}
                  >
                    <span className="font-mono-num mr-1.5 opacity-75">
                      {funnel.index}
                    </span>
                    {funnel.shortLabel}
                  </span>
                  <span className="rounded-md bg-[var(--bg-subtle)] px-2 py-0.5 font-mono-num text-[11px] font-semibold text-[var(--text-secondary)]">
                    {fLeads.length}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-1 text-[11px] text-[var(--text-muted)]">
                  <span className="truncate">{funnel.subtitle}</span>
                  <span className="font-mono-num text-[var(--text-secondary)] shrink-0">
                    {formatCurrency(total)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Search + View Toggle (Kanban / Lista) + Filters + Novo Lead */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 flex-1 sm:flex-initial">
            <div className="relative flex-1 sm:flex-initial">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
                aria-hidden="true"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar empresa, decisor..."
                aria-label="Buscar empresa, decisor, origem ou parceiro"
                className="input-field min-h-[44px] w-full sm:w-64 rounded-lg py-2 pl-9 pr-3 text-xs"
              />
            </div>

            <div
              className="inline-flex rounded-lg p-1 surface-card"
              role="group"
              aria-label="Modo de visualização"
            >
              <button
                type="button"
                onClick={() => setViewMode("kanban")}
                aria-pressed={viewMode === "kanban"}
                className={cn(
                  "inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                  viewMode === "kanban"
                    ? "bg-[var(--accent-btn)] text-[var(--accent-fg)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
              >
                <Kanban className="h-3.5 w-3.5" aria-hidden="true" />
                Quadro
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-pressed={viewMode === "list"}
                className={cn(
                  "inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                  viewMode === "list"
                    ? "bg-[var(--accent-btn)] text-[var(--accent-fg)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
              >
                <List className="h-3.5 w-3.5" aria-hidden="true" />
                Lista
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyStagnant((prev) => !prev)}
              aria-pressed={onlyStagnant}
              className={cn(
                "inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold border transition-colors",
                onlyStagnant
                  ? "badge-warning"
                  : "btn-ghost text-[var(--text-secondary)]"
              )}
            >
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              Parados &gt;48h
            </button>

            <button
              type="button"
              onClick={() => onOpenNewLead(activeFunnel)}
              className="btn-accent inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Novo Lead
            </button>
          </div>
        </div>
      </div>

      {/* VIEW MODE 1: COMPACT TABLE / LIST VIEW */}
      {viewMode === "list" ? (
        <div className="surface-card overflow-x-auto rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--border-hairline)] bg-[var(--bg-subtle)] text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3">Empresa &amp; Decisor</th>
                <th className="px-4 py-3">Vertical</th>
                <th className="px-4 py-3">Etapa</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Último Contato</th>
                <th className="px-4 py-3 text-right">Ações 1-Clique</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-hairline)]">
              {funnelLeads.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-xs text-[var(--text-muted)]"
                  >
                    Nenhum lead encontrado neste filtro.
                  </td>
                </tr>
              ) : (
                funnelLeads.map((lead) => {
                  const stagnation = getLeadStagnation(lead);
                  return (
                    <tr
                      key={lead.id}
                      className="hover:bg-[var(--bg-subtle)] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => onSelectLead(lead)}
                          className="text-left"
                        >
                          <p className="font-bold text-[var(--text-primary)] hover:text-[var(--accent-text)]">
                            {lead.companyName}
                          </p>
                          <p className="text-[11px] text-[var(--text-secondary)]">
                            {lead.contactName} ·{" "}
                            <span className="font-mono-num">{lead.phone}</span>
                          </p>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-[var(--bg-subtle)] px-2 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                          {getFunnelLabel(lead.funnel)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={lead.stage}
                          onChange={(e) =>
                            onMoveStage(lead.id, e.target.value as StageId)
                          }
                          aria-label={`Mover etapa de ${lead.companyName}`}
                          className="input-field min-h-[34px] rounded-md px-2 py-1 text-xs font-semibold"
                        >
                          {STAGES.map((st) => (
                            <option key={st.id} value={st.id}>
                              {st.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 font-mono-num font-bold text-[var(--text-primary)]">
                        {formatCurrency(lead.estimatedValue)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono-num text-[11px] text-[var(--text-secondary)]">
                            {formatRelativeTime(lead.ultimaInteracaoEm)}
                          </span>
                          {stagnation.level !== "none" && (
                            <span
                              className={cn(
                                "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                                stagnation.level === "critical"
                                  ? "badge-danger"
                                  : "badge-warning"
                              )}
                            >
                              {stagnation.label}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopyProposalUrl(lead)}
                            className="btn-ghost inline-flex h-8 w-8 items-center justify-center rounded-md"
                            title="Copiar link da proposta"
                            aria-label={`Copiar proposta de ${lead.companyName}`}
                          >
                            {copiedLeadId === lead.id ? (
                              <Check
                                className="h-3.5 w-3.5 text-[var(--status-success)]"
                                aria-hidden="true"
                              />
                            ) : (
                              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                          </button>
                          <a
                            href={buildWhatsappUrl(
                              lead.phone,
                              `Olá ${lead.contactName}, tudo bem? Aqui é o Henrique da ÚLTIMO QUADRO.`
                            )}
                            target="_blank"
                            rel="noreferrer"
                            className="badge-success inline-flex h-8 w-8 items-center justify-center rounded-md"
                            title="Abrir WhatsApp direto"
                            aria-label={`Abrir WhatsApp de ${lead.companyName}`}
                          >
                            <MessageCircle
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                          </a>
                          <button
                            type="button"
                            onClick={() => onQuickDispatch(lead)}
                            className="btn-accent inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-[11px] font-bold"
                          >
                            <Send className="h-3 w-3" aria-hidden="true" />
                            Disparar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* VIEW MODE 2: 6-COLUMN KANBAN BOARD */
        <div className="flex gap-3.5 overflow-x-auto pb-4 -mx-1 px-1">
          {STAGES.map((stage) => {
            const stageLeads = leadsByStage[stage.id];
            const stageSum = stageLeads.reduce(
              (sum, l) => sum + l.estimatedValue,
              0
            );
            const isDropTarget = dragOverStage === stage.id;

            return (
              <section
                key={stage.id}
                aria-label={`Etapa ${stage.label}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverStage !== stage.id) setDragOverStage(stage.id);
                }}
                onDragLeave={() => {
                  if (dragOverStage === stage.id) setDragOverStage(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(stage.id);
                }}
                className={cn(
                  "flex min-h-[540px] w-[298px] shrink-0 flex-col rounded-xl p-3 transition-colors border",
                  isDropTarget
                    ? "bg-[var(--accent-soft)] border-[var(--accent-border)]"
                    : "bg-[var(--bg-subtle)] border-[var(--border-hairline)]"
                )}
              >
                <div className="mb-3 flex items-center justify-between px-1 pt-0.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full shrink-0",
                        stage.accentClass
                      )}
                      aria-hidden="true"
                    />
                    <h2 className="truncate text-xs font-bold text-[var(--text-primary)]">
                      {stage.label}
                    </h2>
                    <span className="rounded-md bg-[var(--bg-surface-solid)] px-1.5 py-0.5 font-mono-num text-[10px] font-semibold text-[var(--text-muted)]">
                      {stageLeads.length}
                    </span>
                  </div>
                  <span className="font-mono-num text-[11px] font-semibold text-[var(--text-secondary)]">
                    {formatCurrency(stageSum)}
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-2.5">
                  {stageLeads.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-hairline)] px-4 py-8 text-center">
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Arraste ou mova um card para{" "}
                        <span className="font-medium text-[var(--text-secondary)]">
                          {stage.shortLabel}
                        </span>
                      </p>
                    </div>
                  ) : (
                    stageLeads.map((lead) => {
                      const stagnation = getLeadStagnation(lead);
                      const partner = lead.partnerId
                        ? partnerMap.get(lead.partnerId)
                        : undefined;
                      const isDragging = draggingLeadId === lead.id;
                      const checklist = lead.postSaleChecklist ?? [];
                      const checklistDone = checklist.filter(
                        (c) => c.completed
                      ).length;
                      const stageIdx = STAGE_ORDER.indexOf(lead.stage);

                      return (
                        <article
                          key={lead.id}
                          draggable
                          onDragStart={(e) => {
                            setDraggingLeadId(lead.id);
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", lead.id);
                          }}
                          onDragEnd={() => {
                            setDraggingLeadId(null);
                            setDragOverStage(null);
                          }}
                          className={cn(
                            "surface-card surface-card-hover group cursor-grab active:cursor-grabbing rounded-xl border-l-[3px] p-3.5",
                            STAGE_BORDER_COLORS[lead.stage],
                            isDragging && "opacity-45 scale-[0.98]"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => onSelectLead(lead)}
                            className="block w-full text-left"
                          >
                            {/* Badges Row */}
                            {(showAllFunnels ||
                              stagnation.level !== "none" ||
                              (lead.tags ?? []).length > 0 ||
                              lead.visualizadaEm ||
                              lead.propostaAprovadaEm) && (
                              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                                {showAllFunnels && (
                                  <span className="rounded-md bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent-text)]">
                                    {getFunnelLabel(lead.funnel)}
                                  </span>
                                )}
                                {stagnation.level === "critical" && (
                                  <span className="badge-danger inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold">
                                    <AlertTriangle
                                      className="h-3 w-3"
                                      aria-hidden="true"
                                    />
                                    {stagnation.label}
                                  </span>
                                )}
                                {stagnation.level === "warning" && (
                                  <span className="badge-warning inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold">
                                    <Clock
                                      className="h-3 w-3"
                                      aria-hidden="true"
                                    />
                                    {stagnation.label}
                                  </span>
                                )}
                                {(lead.tags ?? []).map((tag) => (
                                  <span
                                    key={tag}
                                    className="badge-danger inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold"
                                  >
                                    {tag}
                                  </span>
                                ))}
                                {lead.visualizadaEm && (
                                  <span
                                    title={`Proposta visualizada ${lead.visualizacoesProposta}x`}
                                    className="badge-accent inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold"
                                  >
                                    <Eye
                                      className="h-3 w-3"
                                      aria-hidden="true"
                                    />
                                    Vista
                                    {lead.visualizacoesProposta > 1
                                      ? ` ${lead.visualizacoesProposta}x`
                                      : ""}
                                  </span>
                                )}
                                {lead.propostaAprovadaEm && (
                                  <span className="badge-success inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold">
                                    <CheckCircle2
                                      className="h-3 w-3"
                                      aria-hidden="true"
                                    />
                                    Aprovada
                                  </span>
                                )}
                              </div>
                            )}

                            <h3 className="text-sm font-bold leading-snug text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition-colors">
                              {lead.companyName}
                            </h3>
                            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                              {lead.contactName}
                              {lead.contactRole ? ` · ${lead.contactRole}` : ""}
                            </p>

                            <div className="mt-2.5 flex items-center justify-between gap-2">
                              <span className="font-mono-num text-sm font-extrabold text-[var(--text-primary)]">
                                {formatCurrency(lead.estimatedValue)}
                              </span>
                              <div className="flex items-center gap-1">
                                {lead.automacaoAtiva &&
                                  (lead.stage === "contatado" ||
                                    lead.stage === "proposta_aberta") && (
                                    <span
                                      title="Cadência automática ativa"
                                      className="inline-flex items-center gap-0.5 rounded-md bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]"
                                    >
                                      <Bot
                                        className="h-2.5 w-2.5 text-[var(--accent-text)]"
                                        aria-hidden="true"
                                      />
                                      Auto
                                    </span>
                                  )}
                                {lead.paymentStatus === "sinal_pago" && (
                                  <span className="badge-success rounded-md px-1.5 py-0.5 text-[10px] font-semibold">
                                    50% Pago
                                  </span>
                                )}
                                {lead.paymentStatus === "quitado" && (
                                  <span className="badge-success rounded-md px-1.5 py-0.5 text-[10px] font-semibold">
                                    Quitado
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                              {partner ? (
                                <span className="inline-flex items-center gap-1 truncate rounded-md bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                                  <Handshake
                                    className="h-3 w-3 text-[var(--accent-text)] shrink-0"
                                    aria-hidden="true"
                                  />
                                  <span className="truncate">
                                    {partner.name} ({partner.commissionRate}%)
                                  </span>
                                </span>
                              ) : (
                                <span className="truncate rounded-md bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px]">
                                  {lead.origin}
                                </span>
                              )}

                              {lead.instagram && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
                                  <Instagram
                                    className="h-2.5 w-2.5 text-[var(--accent-text)]"
                                    aria-hidden="true"
                                  />
                                  {lead.instagram}
                                </span>
                              )}

                              {checklist.length > 0 && (
                                <span className="badge-success inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono-num text-[10px] font-semibold">
                                  <ClipboardCheck
                                    className="h-3 w-3"
                                    aria-hidden="true"
                                  />
                                  {checklistDone}/{checklist.length}
                                </span>
                              )}
                            </div>
                          </button>

                          {/* 1-Click Stage Stepper + Action Bar */}
                          <div className="mt-3 space-y-2 border-t border-[var(--border-hairline)] pt-2.5">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={stageIdx <= 0}
                                onClick={() => handleStepStage(lead, -1)}
                                className="btn-ghost flex h-7 w-7 shrink-0 items-center justify-center rounded-md disabled:opacity-30"
                                title="Voltar uma etapa"
                                aria-label={`Voltar etapa de ${lead.companyName}`}
                              >
                                <ChevronLeft
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                              </button>

                              <label
                                htmlFor={`move-stage-${lead.id}`}
                                className="sr-only"
                              >
                                Mover etapa de {lead.companyName}
                              </label>
                              <select
                                id={`move-stage-${lead.id}`}
                                value={lead.stage}
                                onChange={(e) =>
                                  onMoveStage(
                                    lead.id,
                                    e.target.value as StageId
                                  )
                                }
                                aria-label={`Mover etapa de ${lead.companyName}`}
                                className="input-field h-7 flex-1 rounded-md px-2 text-[11px] font-medium"
                              >
                                {STAGES.map((st) => (
                                  <option key={st.id} value={st.id}>
                                    {st.shortLabel}
                                  </option>
                                ))}
                              </select>

                              <button
                                type="button"
                                disabled={stageIdx >= STAGE_ORDER.length - 1}
                                onClick={() => handleStepStage(lead, 1)}
                                className="btn-ghost flex h-7 w-7 shrink-0 items-center justify-center rounded-md disabled:opacity-30"
                                title="Avançar uma etapa"
                                aria-label={`Avançar etapa de ${lead.companyName}`}
                              >
                                <ChevronRight
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                              </button>
                            </div>

                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleCopyProposalUrl(lead)}
                                  className="btn-ghost inline-flex h-7 items-center gap-1 rounded-md px-2 text-[10px] font-semibold"
                                  title="Copiar link da proposta"
                                >
                                  {copiedLeadId === lead.id ? (
                                    <>
                                      <Check
                                        className="h-3 w-3 text-[var(--status-success)]"
                                        aria-hidden="true"
                                      />
                                      Copiado
                                    </>
                                  ) : (
                                    <>
                                      <Copy
                                        className="h-3 w-3"
                                        aria-hidden="true"
                                      />
                                      Link
                                    </>
                                  )}
                                </button>

                                <a
                                  href={`/proposta/${lead.id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn-ghost inline-flex h-7 items-center gap-1 rounded-md px-2 text-[10px] font-semibold"
                                  title="Abrir Proposta Web em nova aba"
                                >
                                  <ExternalLink
                                    className="h-3 w-3"
                                    aria-hidden="true"
                                  />
                                  Proposta
                                </a>
                              </div>

                              <div className="flex items-center gap-1">
                                <a
                                  href={buildWhatsappUrl(
                                    lead.phone,
                                    `Olá ${lead.contactName}, tudo bem? Aqui é o Henrique da ÚLTIMO QUADRO.`
                                  )}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="badge-success inline-flex h-7 w-7 items-center justify-center rounded-md"
                                  title="Abrir WhatsApp direto"
                                  aria-label={`Chamar ${lead.companyName} no WhatsApp`}
                                >
                                  <MessageCircle
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                </a>

                                <button
                                  type="button"
                                  onClick={() => onQuickDispatch(lead)}
                                  className="btn-accent inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[10px] font-bold"
                                  title="Abrir no Disparador com script"
                                >
                                  <Send
                                    className="h-3 w-3"
                                    aria-hidden="true"
                                  />
                                  Script
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
