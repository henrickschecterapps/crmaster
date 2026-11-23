"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  Bot,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Handshake,
  Instagram,
  Kanban,
  List,
  MessageCircle,
  Plus,
  RotateCcw,
  Search,
  Send,
} from "lucide-react";
import {
  FUNNELS,
  FunnelId,
  Lead,
  LostReasonId,
  Partner,
  STAGES,
  StageId,
} from "@/types/crm";
import {
  buildWhatsappUrl,
  cn,
  exportLeadsToCsv,
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
  onBulkAction?: (params: {
    leadIds: string[];
    action: "move_stage" | "assign_partner" | "archive" | "restore";
    stage?: StageId;
    partnerId?: string | null;
    lostReason?: LostReasonId;
  }) => Promise<void>;
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
  onBulkAction,
  onSelectLead,
  onQuickDispatch,
  onOpenNewLead,
  onNotify,
}: KanbanViewProps) {
  const [showAllFunnels, setShowAllFunnels] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [search, setSearch] = useState("");
  const [onlyStagnant, setOnlyStagnant] = useState(false);
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<StageId | null>(null);
  const [copiedLeadId, setCopiedLeadId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStage, setBulkStage] = useState<StageId>("contatado");
  const [bulkPartnerId, setBulkPartnerId] = useState<string>("");
  const [runningBulk, setRunningBulk] = useState(false);

  const partnerMap = useMemo(() => {
    const map = new Map<string, Partner>();
    for (const p of partners) map.set(p.id, p);
    return map;
  }, [partners]);

  const archivedCount = useMemo(
    () => leads.filter((l) => Boolean(l.archived)).length,
    [leads]
  );

  const funnelLeads = useMemo(() => {
    return leads.filter((l) => {
      if (showArchived ? !l.archived : Boolean(l.archived)) return false;
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
  }, [leads, showArchived, showAllFunnels, activeFunnel, onlyStagnant, search, partnerMap]);

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === funnelLeads.length && funnelLeads.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(funnelLeads.map((l) => l.id));
    }
  };

  const runBulk = async (
    action: "move_stage" | "assign_partner" | "archive" | "restore"
  ) => {
    if (!onBulkAction || selectedIds.length === 0) return;
    setRunningBulk(true);
    try {
      await onBulkAction({
        leadIds: selectedIds,
        action,
        stage: action === "move_stage" ? bulkStage : undefined,
        partnerId:
          action === "assign_partner" ? bulkPartnerId || null : undefined,
      });
      setSelectedIds([]);
    } finally {
      setRunningBulk(false);
    }
  };

  const handleExportFilteredCsv = () => {
    const csv = exportLeadsToCsv(funnelLeads, partners);
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pipeline-${showAllFunnels ? "todas" : activeFunnel}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify?.(`Exportados ${funnelLeads.length} leads filtrados em CSV.`, "success");
  };

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
    const url = `${origin}/portal/${lead.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLeadId(lead.id);
      onNotify?.(
        `Link do Portal do Cliente de ${lead.companyName} copiado.`,
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

  const totalFilteredCount = Math.max(1, funnelLeads.length);

  return (
    <div className="space-y-5">
      {/* Unified Vertical Dock Strip + Toolbar */}
      <div className="flex flex-col gap-3.5">
        <div className="double-bezel">
          <div
            className="double-bezel-core grid grid-cols-1 divide-y divide-[var(--border-hairline)] sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-6 overflow-hidden"
            role="tablist"
            aria-label="Frentes de serviço do Kanban"
          >
            <button
              type="button"
              role="tab"
              aria-selected={showAllFunnels}
              onClick={() => setShowAllFunnels(true)}
              className={cn(
                "min-h-[58px] px-4 py-2.5 text-left transition-colors",
                showAllFunnels
                  ? "bg-[var(--accent-soft)]"
                  : "hover:bg-[var(--bg-surface-hover)]"
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
                <span className="rounded-md bg-[var(--bg-subtle)] px-1.5 py-0.5 font-mono-num text-[10px] font-bold text-[var(--text-secondary)]">
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
              const total = fLeads.reduce(
                (sum, l) => sum + l.estimatedValue,
                0
              );
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
                    "min-h-[58px] px-4 py-2.5 text-left transition-colors",
                    isActive
                      ? "bg-[var(--accent-soft)]"
                      : "hover:bg-[var(--bg-surface-hover)]"
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
                    <span className="rounded-md bg-[var(--bg-subtle)] px-1.5 py-0.5 font-mono-num text-[10px] font-bold text-[var(--text-secondary)]">
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
        </div>

        {/* Search + View Toggle (Kanban / Lista) + Filters + Button-in-Button Novo Lead */}
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
                placeholder="Filtrar empresa, decisor, @instagram..."
                aria-label="Buscar empresa, decisor, origem ou parceiro"
                className="input-field min-h-[40px] w-full sm:w-64 rounded-lg py-2 pl-9 pr-3 text-xs"
              />
            </div>

            <div
              className="dock-shell inline-flex items-center gap-1"
              role="group"
              aria-label="Modo de visualização"
            >
              <button
                type="button"
                onClick={() => setViewMode("kanban")}
                aria-pressed={viewMode === "kanban"}
                className={cn(
                  "inline-flex min-h-[32px] items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all",
                  viewMode === "kanban"
                    ? "bg-[var(--bg-surface-solid)] text-[var(--text-primary)] border border-[var(--accent-border)] shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent"
                )}
              >
                <Kanban className="h-3.5 w-3.5" aria-hidden="true" />
                Trilhos
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-pressed={viewMode === "list"}
                className={cn(
                  "inline-flex min-h-[32px] items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all",
                  viewMode === "list"
                    ? "bg-[var(--bg-surface-solid)] text-[var(--text-primary)] border border-[var(--accent-border)] shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent"
                )}
              >
                <List className="h-3.5 w-3.5" aria-hidden="true" />
                Lista
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyStagnant((prev) => !prev)}
              aria-pressed={onlyStagnant}
              className={cn(
                "inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold border transition-colors",
                onlyStagnant
                  ? "badge-warning"
                  : "btn-ghost text-[var(--text-secondary)] bg-[var(--bg-surface-solid)]"
              )}
            >
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              Parados &gt;48h
            </button>

            <button
              type="button"
              onClick={() => {
                setShowArchived((prev) => !prev);
                setSelectedIds([]);
              }}
              aria-pressed={showArchived}
              className={cn(
                "inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold border transition-colors",
                showArchived
                  ? "badge-danger"
                  : "btn-ghost text-[var(--text-secondary)] bg-[var(--bg-surface-solid)]"
              )}
            >
              <Archive className="h-3.5 w-3.5" aria-hidden="true" />
              Arquivados ({archivedCount})
            </button>

            <button
              type="button"
              onClick={handleExportFilteredCsv}
              className="btn-ghost inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold bg-[var(--bg-surface-solid)]"
              title="Exportar leads filtrados em CSV"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">CSV</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenNewLead(activeFunnel)}
              className="btn-accent group inline-flex min-h-[40px] items-center gap-2 rounded-lg pl-3.5 pr-2 py-1.5 text-xs font-bold"
            >
              <span>Novo Lead</span>
              <span className="btn-icon-badge">
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar (visible when 1+ leads are selected in List view) */}
      {viewMode === "list" && selectedIds.length > 0 && onBulkAction && (
        <div className="double-bezel stagger-in">
          <div className="double-bezel-core flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs">
            <span className="font-bold text-[var(--accent-text)] font-mono-num">
              {selectedIds.length} lead(s) selecionado(s)
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <select
                  value={bulkStage}
                  onChange={(e) => setBulkStage(e.target.value as StageId)}
                  className="input-field min-h-[34px] rounded-md px-2 text-xs"
                >
                  {STAGES.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.shortLabel}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={runningBulk}
                  onClick={() => runBulk("move_stage")}
                  className="btn-accent min-h-[34px] rounded-md px-3 text-xs font-bold disabled:opacity-50"
                >
                  Mover Etapa
                </button>
              </div>

              <div className="flex items-center gap-1">
                <select
                  value={bulkPartnerId}
                  onChange={(e) => setBulkPartnerId(e.target.value)}
                  className="input-field min-h-[34px] rounded-md px-2 text-xs"
                >
                  <option value="">Sem parceiro</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={runningBulk}
                  onClick={() => runBulk("assign_partner")}
                  className="btn-ghost min-h-[34px] rounded-md px-3 text-xs font-semibold disabled:opacity-50"
                >
                  Parceiro
                </button>
              </div>

              {showArchived ? (
                <button
                  type="button"
                  disabled={runningBulk}
                  onClick={() => runBulk("restore")}
                  className="badge-success min-h-[34px] inline-flex items-center gap-1 rounded-md px-3 text-xs font-bold disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reativar Lote
                </button>
              ) : (
                <button
                  type="button"
                  disabled={runningBulk}
                  onClick={() => runBulk("archive")}
                  className="badge-danger min-h-[34px] inline-flex items-center gap-1 rounded-md px-3 text-xs font-bold disabled:opacity-50"
                >
                  <Archive className="h-3.5 w-3.5" />
                  Arquivar Lote
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 1: COMPACT DOUBLE-BEZEL TABLE / LIST VIEW */}
      {viewMode === "list" ? (
        <div className="double-bezel stagger-in">
          <div className="double-bezel-core overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--border-hairline)] bg-[var(--bg-subtle)] text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                <tr>
                  <th className="w-10 px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todos os leads listados"
                      checked={
                        funnelLeads.length > 0 &&
                        selectedIds.length === funnelLeads.length
                      }
                      onChange={toggleSelectAll}
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
                  </th>
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
                      colSpan={7}
                      className="px-4 py-8 text-center text-xs text-[var(--text-muted)]"
                    >
                      Nenhum lead encontrado neste filtro.
                    </td>
                  </tr>
                ) : (
                  funnelLeads.map((lead) => {
                    const stagnation = getLeadStagnation(lead);
                    const checked = selectedIds.includes(lead.id);
                    return (
                      <tr
                        key={lead.id}
                        className={cn(
                          "hover:bg-[var(--bg-surface-hover)] transition-colors",
                          checked && "bg-[var(--accent-soft)]/40"
                        )}
                      >
                        <td className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            aria-label={`Selecionar ${lead.companyName}`}
                            checked={checked}
                            onChange={() => toggleSelectId(lead.id)}
                            className="h-4 w-4 accent-[var(--accent)]"
                          />
                        </td>
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
                              <span className="font-mono-num">
                                {lead.phone}
                              </span>
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
                                <Copy
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
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
        </div>
      ) : (
        /* VIEW MODE 2: MINIMALIST LINEAR-STYLE 6-COLUMN KANBAN RAILS (100% Width on Desktop) */
        <div className="flex gap-3.5 overflow-x-auto pb-4 xl:grid xl:grid-cols-6 xl:overflow-visible">
          {STAGES.map((stage, stageColIdx) => {
            const stageLeads = leadsByStage[stage.id];
            const stageSum = stageLeads.reduce(
              (sum, l) => sum + l.estimatedValue,
              0
            );
            const stageSharePct = Math.round(
              (stageLeads.length / totalFilteredCount) * 100
            );
            const isDropTarget = dragOverStage === stage.id;

            return (
              <section
                key={stage.id}
                aria-label={`Etapa ${stage.label}`}
                style={{ ["--stagger" as string]: stageColIdx }}
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
                  "stagger-in flex min-h-[540px] w-[285px] shrink-0 flex-col rounded-xl px-1.5 py-2 transition-colors xl:w-auto",
                  isDropTarget &&
                    "bg-[var(--accent-soft)]/50 ring-1 ring-[var(--accent-border)]"
                )}
              >
                {/* Minimalist Linear-Style Column Header + Proportional Progress Hairline */}
                <div className="mb-3 px-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full shrink-0",
                          stage.accentClass
                        )}
                        aria-hidden="true"
                      />
                      <h2 className="truncate text-xs font-bold tracking-tight text-[var(--text-primary)]">
                        {stage.label}
                      </h2>
                      <span className="rounded-md bg-[var(--bg-subtle)] border border-[var(--border-hairline)] px-1.5 py-0.2 font-mono-num text-[10px] font-bold text-[var(--text-secondary)]">
                        {stageLeads.length}
                      </span>
                    </div>
                    <span className="font-mono-num text-[11px] font-semibold text-[var(--text-secondary)] shrink-0">
                      {formatCurrency(stageSum)}
                    </span>
                  </div>

                  {/* Thin Stage Progress Hairline */}
                  <div className="mt-2 h-[2px] w-full overflow-hidden rounded-full bg-[var(--border-hairline)]">
                    <div
                      className={cn("h-full transition-all duration-300", stage.accentClass)}
                      style={{
                        width: `${stageLeads.length > 0 ? Math.max(12, stageSharePct) : 0}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Floating Cards Stack */}
                <div className="flex flex-1 flex-col gap-2.5">
                  {stageLeads.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-hairline)] px-4 py-8 text-center">
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Solte um card em{" "}
                        <span className="font-medium text-[var(--text-secondary)]">
                          {stage.shortLabel}
                        </span>
                      </p>
                    </div>
                  ) : (
                    stageLeads.map((lead, cardIdx) => {
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
                          style={{ ["--stagger" as string]: cardIdx }}
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
                            "surface-card surface-card-hover stagger-in group cursor-grab active:cursor-grabbing rounded-xl border-l-[3px] p-3.5",
                            STAGE_BORDER_COLORS[lead.stage],
                            isDragging && "opacity-45 scale-[0.98]"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => onSelectLead(lead)}
                            className="block w-full text-left"
                          >
                            {/* Top Row: Value Spotlight + Critical Status Badges */}
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="font-mono-num text-xs font-extrabold text-[var(--accent-text)]">
                                {formatCurrency(lead.estimatedValue)}
                              </span>

                              <div className="flex flex-wrap items-center gap-1">
                                {lead.visualizadaEm && (
                                  <span
                                    title={`Proposta visualizada ${lead.visualizacoesProposta}x`}
                                    className="badge-accent inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                                  >
                                    <Eye
                                      className="h-2.5 w-2.5"
                                      aria-hidden="true"
                                    />
                                    {lead.visualizacoesProposta}x
                                  </span>
                                )}
                                {lead.propostaAprovadaEm && (
                                  <span className="badge-success inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold">
                                    <CheckCircle2
                                      className="h-2.5 w-2.5"
                                      aria-hidden="true"
                                    />
                                    OK
                                  </span>
                                )}
                                {stagnation.level === "critical" && (
                                  <span className="badge-danger inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold">
                                    <AlertTriangle
                                      className="h-2.5 w-2.5"
                                      aria-hidden="true"
                                    />
                                    {stagnation.label}
                                  </span>
                                )}
                                {stagnation.level === "warning" && (
                                  <span className="badge-warning inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold">
                                    <Clock
                                      className="h-2.5 w-2.5"
                                      aria-hidden="true"
                                    />
                                    {stagnation.label}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Company & Contact */}
                            <h3 className="text-sm font-bold leading-snug text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition-colors">
                              {lead.companyName}
                            </h3>
                            <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">
                              {lead.contactName}
                              {lead.contactRole ? ` · ${lead.contactRole}` : ""}
                            </p>

                            {/* Compact Metadata Line */}
                            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                              {showAllFunnels && (
                                <span className="rounded bg-[var(--bg-subtle)] px-1.5 py-0.5 font-bold text-[var(--text-secondary)]">
                                  {getFunnelLabel(lead.funnel)}
                                </span>
                              )}

                              {partner ? (
                                <span className="inline-flex items-center gap-1 truncate rounded bg-[var(--bg-subtle)] px-1.5 py-0.5 font-medium text-[var(--text-secondary)]">
                                  <Handshake
                                    className="h-2.5 w-2.5 text-[var(--accent-text)] shrink-0"
                                    aria-hidden="true"
                                  />
                                  <span className="truncate">
                                    {partner.name}
                                  </span>
                                </span>
                              ) : (
                                <span className="truncate rounded bg-[var(--bg-subtle)] px-1.5 py-0.5">
                                  {lead.origin}
                                </span>
                              )}

                              {lead.instagram && (
                                <span className="inline-flex items-center gap-0.5 rounded bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[var(--text-secondary)]">
                                  <Instagram
                                    className="h-2.5 w-2.5 text-[var(--accent-text)]"
                                    aria-hidden="true"
                                  />
                                  {lead.instagram}
                                </span>
                              )}

                              {lead.automacaoAtiva &&
                                (lead.stage === "contatado" ||
                                  lead.stage === "proposta_aberta") && (
                                  <span
                                    title="Cadência automática ativa"
                                    className="inline-flex items-center gap-0.5 rounded bg-[var(--bg-subtle)] px-1.5 py-0.5"
                                  >
                                    <Bot
                                      className="h-2.5 w-2.5 text-[var(--accent-text)]"
                                      aria-hidden="true"
                                    />
                                    Auto
                                  </span>
                                )}

                              {checklist.length > 0 && (
                                <span className="badge-success inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-mono-num font-semibold">
                                  <ClipboardCheck
                                    className="h-2.5 w-2.5"
                                    aria-hidden="true"
                                  />
                                  {checklistDone}/{checklist.length}
                                </span>
                              )}

                              {(lead.tags ?? []).map((tag) => (
                                <span
                                  key={tag}
                                  className="badge-danger rounded px-1.5 py-0.5 font-bold"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </button>

                          {/* Subtle Hover-Spotlight Quick Action Bar (100% accessible via keyboard/mobile) */}
                          <div className="mt-3 space-y-1.5 border-t border-[var(--border-hairline)] pt-2.5 opacity-85 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
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

                            <div className="flex items-center justify-between gap-1">
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
                                  href={`/portal/${lead.id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn-ghost inline-flex h-7 items-center gap-1 rounded-md px-2 text-[10px] font-semibold"
                                  title="Abrir Portal do Cliente em nova aba"
                                >
                                  <ExternalLink
                                    className="h-3 w-3"
                                    aria-hidden="true"
                                  />
                                  Portal
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
                                  className="btn-accent inline-flex h-7 items-center gap-1 rounded-md px-2 text-[10px] font-bold"
                                  title="Abrir no Disparador com script"
                                >
                                  <Send
                                    className="h-2.5 w-2.5"
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
