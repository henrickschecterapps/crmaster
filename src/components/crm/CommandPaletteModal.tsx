"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ExternalLink,
  Handshake,
  Kanban,
  LayoutDashboard,
  MapPin,
  MessageCircle,
  Moon,
  Plus,
  Search,
  Send,
  Settings,
  Sun,
  X,
} from "lucide-react";
import { FUNNELS, FunnelId, Lead } from "@/types/crm";
import {
  buildWhatsappUrl,
  cn,
  formatCurrency,
  getFunnelLabel,
  getStageLabel,
} from "@/lib/utils";

interface CommandPaletteModalProps {
  leads: Lead[];
  theme: "dark" | "light";
  onClose: () => void;
  onSelectLead: (lead: Lead) => void;
  onOpenNewLead: () => void;
  onNavigateModule: (
    module:
      | "dashboard"
      | "kanban"
      | "capture"
      | "dispatcher"
      | "partners"
      | "settings",
    funnel?: FunnelId
  ) => void;
  onToggleTheme: () => void;
}

export function CommandPaletteModal({
  leads,
  theme,
  onClose,
  onSelectLead,
  onOpenNewLead,
  onNavigateModule,
  onToggleTheme,
}: CommandPaletteModalProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredLeads = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads.slice(0, 6);
    return leads
      .filter(
        (l) =>
          l.companyName.toLowerCase().includes(q) ||
          l.contactName.toLowerCase().includes(q) ||
          l.phone.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          (l.instagram || "").toLowerCase().includes(q) ||
          (l.neighborhood || "").toLowerCase().includes(q) ||
          getFunnelLabel(l.funnel).toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [leads, query]);

  const quickCommands = useMemo(() => {
    const all = [
      {
        id: "cmd-new-lead",
        label: "Cadastrar Novo Lead Rápido",
        sub: "Abre o formulário modal sem sair da tela",
        icon: Plus,
        action: () => {
          onClose();
          onOpenNewLead();
        },
      },
      {
        id: "cmd-capture-bh",
        label: "Captar Empresas em BH & Nova Lima (Overture Maps)",
        sub: "8.000 empresas indexadas por nicho e bairro",
        icon: MapPin,
        action: () => {
          onClose();
          onNavigateModule("capture");
        },
      },
      {
        id: "cmd-kanban",
        label: "Abrir Quadro CRM Kanban",
        sub: "Gerenciar pipeline nas 5 verticais",
        icon: Kanban,
        action: () => {
          onClose();
          onNavigateModule("kanban");
        },
      },
      {
        id: "cmd-dispatcher",
        label: "Disparador Inteligente & Scripts",
        sub: "Enviar proposta via WhatsApp ou E-mail",
        icon: Send,
        action: () => {
          onClose();
          onNavigateModule("dispatcher");
        },
      },
      {
        id: "cmd-partners",
        label: "Parceiros & Comissões (15%)",
        sub: "Modelos de provador e espaços de eventos",
        icon: Handshake,
        action: () => {
          onClose();
          onNavigateModule("partners");
        },
      },
      {
        id: "cmd-dashboard",
        label: "Painel Financeiro & Metas",
        sub: "Faturamento confirmado, pipeline e exportação CSV",
        icon: LayoutDashboard,
        action: () => {
          onClose();
          onNavigateModule("dashboard");
        },
      },
      {
        id: "cmd-settings",
        label: "Automações, Régua Dia 2/5 & Pix",
        sub: "Configurações do motor de follow-up e histórico do Cron",
        icon: Settings,
        action: () => {
          onClose();
          onNavigateModule("settings");
        },
      },
      {
        id: "cmd-theme",
        label:
          theme === "dark"
            ? "Alternar para Modo Claro"
            : "Alternar para Modo Escuro",
        sub: "Contraste calibrado WCAG AA",
        icon: theme === "dark" ? Sun : Moon,
        action: () => {
          onToggleTheme();
          onClose();
        },
      },
    ];

    const q = query.trim().toLowerCase();
    if (!q) return all.slice(0, 5);
    return all.filter(
      (c) =>
        c.label.toLowerCase().includes(q) || c.sub.toLowerCase().includes(q)
    );
  }, [query, theme, onClose, onOpenNewLead, onNavigateModule, onToggleTheme]);

  const totalItems = filteredLeads.length + quickCommands.length;

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (totalItems > 0 ? (prev + 1) % totalItems : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) =>
          totalItems > 0 ? (prev - 1 + totalItems) % totalItems : 0
        );
      } else if (e.key === "Enter" && totalItems > 0) {
        e.preventDefault();
        if (activeIndex < filteredLeads.length) {
          const lead = filteredLeads[activeIndex];
          if (lead) {
            onClose();
            onSelectLead(lead);
          }
        } else {
          const cmd = quickCommands[activeIndex - filteredLeads.length];
          cmd?.action();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    activeIndex,
    filteredLeads,
    quickCommands,
    totalItems,
    onClose,
    onSelectLead,
  ]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 p-4 pt-16 sm:pt-24 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="command-palette-title"
    >
      <div
        className="modal-surface w-full max-w-2xl rounded-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="command-palette-title" className="sr-only">
          Busca Global e Atalhos Rápidos
        </h2>

        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-[var(--border-hairline)] px-4 py-3.5">
          <Search
            className="h-4.5 w-4.5 text-[var(--accent-text)] shrink-0"
            aria-hidden="true"
          />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar empresa, contato, telefone, @instagram ou comando..."
            aria-label="Buscar lead ou comando"
            className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-2 py-1 font-mono-num text-[10px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            ESC
          </button>
        </div>

        {/* Vertical Jump Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-4 py-2">
          <span className="font-mono-num text-[10px] uppercase tracking-wider text-[var(--text-muted)] shrink-0 mr-1">
            Verticais:
          </span>
          {FUNNELS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                onClose();
                onNavigateModule("kanban", f.id);
              }}
              className="shrink-0 rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface-solid)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)] hover:border-[var(--accent-border)] hover:text-[var(--accent-text)] transition-colors"
            >
              <span className="font-mono-num opacity-70 mr-1">{f.index}</span>
              {f.shortLabel}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div className="max-h-[62dvh] overflow-y-auto p-3 space-y-4">
          {/* Leads Match Section */}
          <div>
            <div className="flex items-center justify-between px-2 pb-1.5">
              <span className="font-mono-num text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Leads no CRM ({filteredLeads.length})
              </span>
              <span className="font-mono-num text-[10px] text-[var(--text-muted)]">
                Enter para abrir ficha
              </span>
            </div>

            {filteredLeads.length === 0 ? (
              <p className="px-2 py-3 text-xs text-[var(--text-muted)]">
                Nenhum lead encontrado para &ldquo;{query}&rdquo;.
              </p>
            ) : (
              <div className="space-y-1">
                {filteredLeads.map((lead, idx) => {
                  const selected = idx === activeIndex;
                  return (
                    <div
                      key={lead.id}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors",
                        selected
                          ? "bg-[var(--accent-soft)] border border-[var(--accent-border)]"
                          : "hover:bg-[var(--bg-subtle)] border border-transparent"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onSelectLead(lead);
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-xs font-bold text-[var(--text-primary)]">
                            {lead.companyName}
                          </span>
                          <span className="rounded-md bg-[var(--bg-surface-solid)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-text)]">
                            {getFunnelLabel(lead.funnel)}
                          </span>
                          <span className="rounded-md bg-[var(--bg-surface-solid)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                            {getStageLabel(lead.stage)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-[var(--text-secondary)]">
                          {lead.contactName} ·{" "}
                          <span className="font-mono-num">{lead.phone}</span> ·{" "}
                          <span className="font-mono-num font-semibold text-[var(--text-primary)]">
                            {formatCurrency(lead.estimatedValue)}
                          </span>
                        </p>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={buildWhatsappUrl(
                            lead.phone,
                            `Olá ${lead.contactName}, tudo bem? Aqui é o Henrique da ÚLTIMO QUADRO.`
                          )}
                          target="_blank"
                          rel="noreferrer"
                          className="badge-success flex h-8 w-8 items-center justify-center rounded-md"
                          title="Abrir WhatsApp direto"
                          aria-label={`Abrir WhatsApp de ${lead.companyName}`}
                        >
                          <MessageCircle
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                        </a>
                        <a
                          href={`/proposta/${lead.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-ghost flex h-8 w-8 items-center justify-center rounded-md bg-[var(--bg-surface-solid)]"
                          title="Abrir Proposta Web"
                          aria-label={`Abrir proposta de ${lead.companyName}`}
                        >
                          <ExternalLink
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Commands Section */}
          {quickCommands.length > 0 && (
            <div className="border-t border-[var(--border-hairline)] pt-3">
              <span className="block px-2 pb-1.5 font-mono-num text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Ações &amp; Navegação Rápida
              </span>
              <div className="space-y-1">
                {quickCommands.map((cmd, cIdx) => {
                  const globalIdx = filteredLeads.length + cIdx;
                  const selected = globalIdx === activeIndex;
                  const Icon = cmd.icon;
                  return (
                    <button
                      key={cmd.id}
                      type="button"
                      onMouseEnter={() => setActiveIndex(globalIdx)}
                      onClick={cmd.action}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                        selected
                          ? "bg-[var(--accent-soft)] border border-[var(--accent-border)]"
                          : "hover:bg-[var(--bg-subtle)] border border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface-solid)] text-[var(--accent-text)] border border-[var(--border-hairline)]">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-[var(--text-primary)]">
                            {cmd.label}
                          </p>
                          <p className="truncate text-[11px] text-[var(--text-muted)]">
                            {cmd.sub}
                          </p>
                        </div>
                      </div>
                      <ArrowRight
                        className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0"
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
