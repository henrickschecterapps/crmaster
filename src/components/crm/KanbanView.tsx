"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  ExternalLink,
  Eye,
  Handshake,
  Instagram,
  MessageCircle,
  Plus,
  Search,
} from "lucide-react";
import {
  FUNNELS,
  FunnelId,
  Lead,
  Partner,
  STAGES,
  StageId,
} from "@/types/crm";
import { cn, formatCurrency, getLeadStagnation } from "@/lib/utils";

interface KanbanViewProps {
  leads: Lead[];
  partners: Partner[];
  activeFunnel: FunnelId;
  onChangeFunnel: (funnel: FunnelId) => void;
  onMoveStage: (leadId: string, newStage: StageId) => Promise<void>;
  onSelectLead: (lead: Lead) => void;
  onQuickDispatch: (lead: Lead) => void;
  onOpenNewLead: (funnel: FunnelId) => void;
}

export function KanbanView({
  leads,
  partners,
  activeFunnel,
  onChangeFunnel,
  onMoveStage,
  onSelectLead,
  onQuickDispatch,
  onOpenNewLead,
}: KanbanViewProps) {
  const [search, setSearch] = useState("");
  const [onlyStagnant, setOnlyStagnant] = useState(false);
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<StageId | null>(null);

  const partnerMap = useMemo(() => {
    const map = new Map<string, Partner>();
    for (const p of partners) map.set(p.id, p);
    return map;
  }, [partners]);

  const funnelLeads = useMemo(() => {
    return leads.filter((l) => {
      if (l.funnel !== activeFunnel) return false;
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
  }, [leads, activeFunnel, onlyStagnant, search, partnerMap]);

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

  return (
    <div className="space-y-5">
      {/* Funnel Tabs Header: 5 Official Ultimo Quadro Verticals */}
      <div className="flex flex-col gap-4">
        <div
          className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5"
          role="tablist"
          aria-label="Frentes de serviço do Kanban"
        >
          {FUNNELS.map((funnel) => {
            const fLeads = leads.filter((l) => l.funnel === funnel.id);
            const total = fLeads.reduce((sum, l) => sum + l.estimatedValue, 0);
            const isActive = activeFunnel === funnel.id;
            return (
              <button
                key={funnel.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onChangeFunnel(funnel.id)}
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

        <div className="flex flex-wrap items-center justify-between gap-2">
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

      {/* Horizontal Scrollable 6-Column Kanban Board */}
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
                "flex min-h-[540px] w-[296px] shrink-0 flex-col rounded-xl p-3 transition-colors border",
                isDropTarget
                  ? "bg-[var(--accent-soft)] border-[var(--accent-border)]"
                  : "bg-[var(--bg-subtle)] border-[var(--border-hairline)]"
              )}
            >
              <div className="mb-3 flex items-center justify-between px-1 pt-0.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full shrink-0",
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
                          "surface-card surface-card-hover group cursor-grab active:cursor-grabbing rounded-xl p-3.5",
                          isDragging && "opacity-45 scale-[0.98]"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => onSelectLead(lead)}
                          className="block w-full text-left"
                        >
                          {/* Badges Row */}
                          {(stagnation.level !== "none" ||
                            (lead.tags ?? []).length > 0 ||
                            lead.visualizadaEm ||
                            lead.propostaAprovadaEm) && (
                            <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                              {stagnation.level === "critical" && (
                                <span className="badge-danger inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold">
                                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                                  {stagnation.label}
                                </span>
                              )}
                              {stagnation.level === "warning" && (
                                <span className="badge-warning inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold">
                                  <Clock className="h-3 w-3" aria-hidden="true" />
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
                                  <Eye className="h-3 w-3" aria-hidden="true" />
                                  Visualizada
                                  {lead.visualizacoesProposta > 1
                                    ? ` (${lead.visualizacoesProposta}x)`
                                    : ""}
                                </span>
                              )}
                              {lead.propostaAprovadaEm && (
                                <span className="badge-success inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold">
                                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
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

                          <div className="mt-3 flex items-center justify-between gap-2">
                            <span className="font-mono-num text-sm font-bold text-[var(--text-primary)]">
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

                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                            {partner ? (
                              <span className="inline-flex items-center gap-1 truncate rounded-md bg-[var(--bg-subtle)] px-2 py-1 text-[10px] font-medium text-[var(--text-secondary)]">
                                <Handshake
                                  className="h-3 w-3 text-[var(--accent-text)] shrink-0"
                                  aria-hidden="true"
                                />
                                <span className="truncate">
                                  {partner.name} ({partner.commissionRate}%)
                                </span>
                              </span>
                            ) : (
                              <span className="truncate rounded-md bg-[var(--bg-subtle)] px-2 py-1 text-[10px]">
                                {lead.origin}
                              </span>
                            )}

                            {lead.instagram && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-subtle)] px-2 py-1 text-[10px] text-[var(--text-secondary)]">
                                <Instagram
                                  className="h-2.5 w-2.5 text-[var(--accent-text)]"
                                  aria-hidden="true"
                                />
                                {lead.instagram}
                              </span>
                            )}

                            {checklist.length > 0 && (
                              <span className="badge-success inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono-num text-[10px] font-semibold">
                                <ClipboardCheck className="h-3 w-3" aria-hidden="true" />
                                {checklistDone}/{checklist.length} Pós-venda
                              </span>
                            )}
                          </div>
                        </button>

                        {/* Touch & Keyboard Stage Mover + Quick Card Actions */}
                        <div className="mt-3 space-y-2 border-t border-[var(--border-hairline)] pt-2.5">
                          <div className="flex items-center gap-1.5">
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
                                onMoveStage(lead.id, e.target.value as StageId)
                              }
                              aria-label={`Mover etapa de ${lead.companyName}`}
                              className="input-field min-h-[34px] w-full rounded-md px-2 py-1 text-[11px] font-medium"
                            >
                              {STAGES.map((st) => (
                                <option key={st.id} value={st.id}>
                                  Etapa: {st.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <a
                              href={`/proposta/${lead.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex min-h-[34px] items-center gap-1 text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--accent-text)] transition-colors"
                            >
                              <ExternalLink className="h-3 w-3" aria-hidden="true" />
                              Proposta
                            </a>

                            <button
                              type="button"
                              onClick={() => onQuickDispatch(lead)}
                              className="badge-success inline-flex min-h-[34px] items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold hover:opacity-85 transition-opacity"
                            >
                              <MessageCircle className="h-3 w-3" aria-hidden="true" />
                              Disparar
                            </button>
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
    </div>
  );
}
