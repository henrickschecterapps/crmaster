"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Film,
  ListTodo,
  Video,
} from "lucide-react";
import { Lead, PRODUCTION_STAGES } from "@/types/crm";
import { cn, formatCurrency, formatDateBr, getFunnelLabel } from "@/lib/utils";

interface AgendaViewProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
}

type AgendaItemKind = "diaria" | "reuniao" | "marco" | "tarefa";

interface AgendaItem {
  id: string;
  date: string; // YYYY-MM-DD
  time?: string;
  kind: AgendaItemKind;
  title: string;
  subtitle: string;
  statusLabel: string;
  tone: "accent" | "warning" | "success" | "info" | "danger";
  lead: Lead;
}

const KIND_LABELS: Record<AgendaItemKind, string> = {
  diaria: "Diária / Evento",
  reuniao: "Reunião Cliente",
  marco: "Marco de Entrega",
  tarefa: "Próxima Ação",
};

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function AgendaView({ leads, onSelectLead }: AgendaViewProps) {
  const now = new Date();
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [kindFilter, setKindFilter] = useState<AgendaItemKind | "all">("all");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const todayYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(now.getDate()).padStart(2, "0")}`;

  const allItems = useMemo<AgendaItem[]>(() => {
    const list: AgendaItem[] = [];
    for (const lead of leads) {
      if (lead.archived) continue;

      if (lead.eventDate && /^\d{4}-\d{2}-\d{2}$/.test(lead.eventDate)) {
        list.push({
          id: `event-${lead.id}`,
          date: lead.eventDate,
          kind: "diaria",
          title: `Diária: ${lead.companyName}`,
          subtitle: `${getFunnelLabel(lead.funnel)} · ${lead.proposalPackage || "Produção 4K"} · ${formatCurrency(lead.estimatedValue)}`,
          statusLabel:
            lead.paymentStatus === "quitado"
              ? "Quitado"
              : lead.paymentStatus === "sinal_pago"
              ? "Sinal 50% Pago"
              : "Pré-reserva",
          tone:
            lead.paymentStatus === "pendente" ? "warning" : "success",
          lead,
        });
      }

      for (const m of lead.meetings ?? []) {
        if (m.status === "cancelada" || !m.date) continue;
        list.push({
          id: `meet-${lead.id}-${m.id}`,
          date: m.date,
          time: m.time,
          kind: "reuniao",
          title: `${m.title} · ${lead.companyName}`,
          subtitle: `${m.format === "online" ? "Online" : "Presencial"}${m.locationOrUrl ? ` · ${m.locationOrUrl}` : ""}`,
          statusLabel:
            m.status === "solicitada"
              ? "Aguardando Confirmação"
              : m.status === "confirmada"
              ? "Confirmada"
              : "Realizada",
          tone:
            m.status === "solicitada"
              ? "warning"
              : m.status === "confirmada"
              ? "info"
              : "success",
          lead,
        });
      }

      const milestones = lead.milestoneDates ?? {};
      for (const ps of PRODUCTION_STAGES) {
        const d = milestones[ps.id];
        if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
          list.push({
            id: `ms-${lead.id}-${ps.id}`,
            date: d,
            kind: "marco",
            title: `${ps.shortLabel} · ${lead.companyName}`,
            subtitle: ps.label,
            statusLabel: "Prazo Previsto",
            tone: "accent",
            lead,
          });
        }
      }

      if (lead.nextAction && !lead.nextAction.completed && lead.nextAction.dueAt) {
        const datePart = lead.nextAction.dueAt.slice(0, 10);
        const timePart =
          lead.nextAction.dueAt.length >= 16
            ? lead.nextAction.dueAt.slice(11, 16)
            : undefined;
        if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
          list.push({
            id: `act-${lead.id}`,
            date: datePart,
            time: timePart,
            kind: "tarefa",
            title: `${lead.nextAction.title} · ${lead.companyName}`,
            subtitle: `Contato: ${lead.contactName}`,
            statusLabel: datePart < todayYmd ? "Atrasada" : "Agendada",
            tone: datePart < todayYmd ? "danger" : "info",
            lead,
          });
        }
      }
    }

    list.sort((a, b) =>
      `${a.date} ${a.time || "99:99"}`.localeCompare(
        `${b.date} ${b.time || "99:99"}`
      )
    );
    return list;
  }, [leads, todayYmd]);

  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      if (kindFilter !== "all" && item.kind !== kindFilter) return false;
      if (selectedDay && item.date !== selectedDay) return false;
      return true;
    });
  }, [allItems, kindFilter, selectedDay]);

  // Detect same-day conflicts for Diarias (events)
  const conflictDates = useMemo(() => {
    const eventCountByDate = new Map<string, number>();
    for (const item of allItems) {
      if (item.kind === "diaria") {
        eventCountByDate.set(
          item.date,
          (eventCountByDate.get(item.date) || 0) + 1
        );
      }
    }
    const conflicts = new Set<string>();
    for (const [d, count] of eventCountByDate.entries()) {
      if (count >= 2) conflicts.add(d);
    }
    return conflicts;
  }, [allItems]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, AgendaItem[]>();
    for (const item of allItems) {
      if (kindFilter !== "all" && item.kind !== kindFilter) continue;
      const arr = map.get(item.date) ?? [];
      arr.push(item);
      map.set(item.date, arr);
    }
    return map;
  }, [allItems, kindFilter]);

  const monthLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(viewYear, viewMonth, 1));

  const firstDayWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const calendarCells: Array<string | null> = [];
  for (let i = 0; i < firstDayWeekday; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(
      `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(
        2,
        "0"
      )}`
    );
  }

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const pendingMeetings = allItems.filter(
    (i) => i.kind === "reuniao" && i.statusLabel === "Aguardando Confirmação"
  ).length;
  const upcomingDiarias = allItems.filter(
    (i) => i.kind === "diaria" && i.date >= todayYmd
  ).length;

  return (
    <div className="space-y-6">
      {/* Header + Filter Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
            Agenda Central do Estúdio
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Diárias 4K, reuniões solicitadas no Portal, prazos de entrega e
            tarefas comerciais em um único calendário.
          </p>
        </div>

        <div className="dock-shell inline-flex flex-wrap gap-1">
          {(
            [
              { id: "all", label: `Tudo (${allItems.length})` },
              { id: "diaria", label: `Diárias (${upcomingDiarias})` },
              { id: "reuniao", label: "Reuniões" },
              { id: "marco", label: "Entregas" },
              { id: "tarefa", label: "Tarefas" },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setKindFilter(f.id)}
              className={cn(
                "min-h-[34px] rounded-lg px-3 py-1 text-xs font-semibold transition-colors",
                kindFilter === f.id
                  ? "bg-[var(--bg-surface-solid)] text-[var(--text-primary)] border border-[var(--border-hairline)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conflict Alert Banner */}
      {conflictDates.size > 0 && (
        <div
          role="alert"
          className="badge-danger flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 text-xs font-semibold"
        >
          <span className="inline-flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Conflito de agenda detectado: há 2 ou mais diárias marcadas na mesma
            data ({Array.from(conflictDates).map(formatDateBr).join(", ")}).
          </span>
        </div>
      )}

      {/* Main Bento: Monthly Grid + Chronological Stream */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Monthly Calendar */}
        <div className="double-bezel stagger-in xl:col-span-7">
          <div className="double-bezel-core p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold capitalize text-[var(--text-primary)]">
                {monthLabel}
              </h3>
              <div className="flex items-center gap-1.5">
                {selectedDay && (
                  <button
                    type="button"
                    onClick={() => setSelectedDay(null)}
                    className="btn-ghost rounded-lg px-2.5 py-1 text-[11px] font-semibold"
                  >
                    Ver mês inteiro
                  </button>
                )}
                <button
                  type="button"
                  onClick={goPrevMonth}
                  className="btn-ghost flex h-8 w-8 items-center justify-center rounded-lg"
                  aria-label="Mês anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={goNextMonth}
                  className="btn-ghost flex h-8 w-8 items-center justify-center rounded-lg"
                  aria-label="Próximo mês"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center font-mono-num text-[10px] font-bold uppercase text-[var(--text-muted)]">
              {WEEKDAYS.map((w) => (
                <div key={w} className="py-1">
                  {w}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {calendarCells.map((ymd, idx) => {
                if (!ymd) {
                  return <div key={`empty-${idx}`} className="min-h-[68px]" />;
                }
                const dayNum = Number(ymd.slice(8, 10));
                const dayItems = itemsByDate.get(ymd) ?? [];
                const isToday = ymd === todayYmd;
                const isSelected = selectedDay === ymd;
                const hasConflict = conflictDates.has(ymd);

                return (
                  <button
                    key={ymd}
                    type="button"
                    onClick={() =>
                      setSelectedDay((prev) => (prev === ymd ? null : ymd))
                    }
                    className={cn(
                      "min-h-[68px] rounded-lg border p-1.5 text-left transition-colors flex flex-col justify-between",
                      isSelected
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : hasConflict
                        ? "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)]"
                        : "border-[var(--border-hairline)] hover:bg-[var(--bg-surface-hover)]"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "font-mono-num text-[11px] font-bold",
                          isToday
                            ? "text-[var(--accent-text)]"
                            : "text-[var(--text-secondary)]"
                        )}
                      >
                        {dayNum}
                      </span>
                      {hasConflict && (
                        <AlertTriangle className="h-3 w-3 text-[var(--status-danger)]" />
                      )}
                    </div>
                    <div className="space-y-0.5 overflow-hidden">
                      {dayItems.slice(0, 2).map((it) => (
                        <div
                          key={it.id}
                          className={cn(
                            "truncate rounded px-1 py-0.5 text-[9px] font-semibold",
                            it.kind === "diaria" && "badge-success",
                            it.kind === "reuniao" && "badge-info",
                            it.kind === "marco" && "badge-accent",
                            it.kind === "tarefa" && "badge-warning"
                          )}
                        >
                          {it.lead.companyName}
                        </div>
                      ))}
                      {dayItems.length > 2 && (
                        <span className="block font-mono-num text-[9px] text-[var(--text-muted)]">
                          +{dayItems.length - 2}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Chronological Schedule Feed */}
        <div className="double-bezel stagger-in xl:col-span-5">
          <div className="double-bezel-core h-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[var(--accent-text)]" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  {selectedDay
                    ? `Compromissos em ${formatDateBr(selectedDay)}`
                    : "Linha do Tempo Completa"}
                </h3>
              </div>
              {pendingMeetings > 0 && (
                <span className="badge-warning rounded-md px-2 py-0.5 font-mono-num text-[10px] font-bold">
                  {pendingMeetings} reunião(ões) pendente(s)
                </span>
              )}
            </div>

            {filteredItems.length === 0 ? (
              <div className="border-t border-[var(--border-hairline)] py-12 text-center space-y-1.5">
                <CheckCircle2 className="mx-auto h-6 w-6 text-[var(--text-muted)]" />
                <p className="text-xs font-semibold text-[var(--text-secondary)]">
                  Nenhum compromisso neste filtro.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-hairline)] border-t border-[var(--border-hairline)] max-h-[540px] overflow-y-auto pr-1">
                {filteredItems.map((item) => {
                  const Icon =
                    item.kind === "diaria"
                      ? Film
                      : item.kind === "reuniao"
                      ? Clock
                      : item.kind === "marco"
                      ? Video
                      : ListTodo;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectLead(item.lead)}
                      className="w-full py-3.5 text-left hover:bg-[var(--bg-surface-hover)] px-2 -mx-2 rounded-lg transition-colors space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 font-mono-num text-[11px] font-bold text-[var(--accent-text)]">
                          <Icon className="h-3.5 w-3.5" />
                          {formatDateBr(item.date)}
                          {item.time ? ` · ${item.time}` : ""}
                        </span>
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase",
                            item.tone === "success" && "badge-success",
                            item.tone === "warning" && "badge-warning",
                            item.tone === "info" && "badge-info",
                            item.tone === "danger" && "badge-danger",
                            item.tone === "accent" && "badge-accent"
                          )}
                        >
                          {item.statusLabel}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-[var(--text-primary)]">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        {KIND_LABELS[item.kind]} · {item.subtitle}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
