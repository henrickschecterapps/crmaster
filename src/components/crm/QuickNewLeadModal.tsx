"use client";

import React, { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { FUNNELS, FunnelId, Lead, Partner } from "@/types/crm";
import { formatPhoneBr } from "@/lib/utils";
import type { CreateLeadInput } from "@/lib/repository";

interface QuickNewLeadModalProps {
  defaultFunnel: FunnelId;
  partners: Partner[];
  onClose: () => void;
  onCreateLead: (
    input: CreateLeadInput
  ) => Promise<{ lead: Lead; duplicate: boolean }>;
  onNotify: (message: string, tone?: "success" | "info" | "error") => void;
}

export function QuickNewLeadModal({
  defaultFunnel,
  partners,
  onClose,
  onCreateLead,
  onNotify,
}: QuickNewLeadModalProps) {
  const defaultSpec =
    FUNNELS.find((f) => f.id === defaultFunnel) ?? FUNNELS[0];

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [funnel, setFunnel] = useState<FunnelId>(defaultFunnel);
  const [estimatedValue, setEstimatedValue] = useState(
    String(defaultSpec.defaultValue)
  );
  const [origin, setOrigin] = useState("Prospecção Direta");
  const [partnerId, setPartnerId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!companyName.trim()) {
      setError("Informe o nome da empresa ou cliente.");
      return;
    }
    if (phone.replace(/\D/g, "").length < 10) {
      setError("Informe um telefone ou WhatsApp válido com DDD.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await onCreateLead({
        companyName: companyName.trim(),
        contactName: contactName.trim() || "Decisor Comercial",
        phone: phone.trim(),
        email: email.trim(),
        funnel,
        estimatedValue: Number(estimatedValue) || defaultSpec.defaultValue,
        origin: origin.trim() || "Cadastro Manual",
        partnerId: partnerId || null,
        notes: notes.trim(),
      });
      if (res.duplicate) {
        setError("Já existe um lead com este telefone ou nome no CRM.");
        return;
      }
      onNotify(`Lead "${res.lead.companyName}" adicionado ao funil.`, "success");
      onClose();
    } catch {
      setError("Falha ao cadastrar o lead. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-lead-title"
        onClick={(e) => e.stopPropagation()}
        className="modal-surface w-full max-w-xl rounded-xl p-6 space-y-5 max-h-[90dvh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono-num text-[11px] font-semibold uppercase tracking-wider text-[var(--accent-text)]">
              Cadastro Rápido
            </p>
            <h2
              id="quick-lead-title"
              className="mt-1 text-lg font-bold text-[var(--text-primary)]"
            >
              Adicionar Novo Lead
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal de novo lead"
            className="btn-ghost flex h-11 w-11 items-center justify-center rounded-lg"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="ql-company"
                className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
              >
                Empresa ou Cliente *
              </label>
              <input
                id="ql-company"
                type="text"
                required
                autoFocus
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ex: Restaurante Lourdes"
                className="input-field w-full rounded-lg px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="ql-contact"
                className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
              >
                Nome do Decisor *
              </label>
              <input
                id="ql-contact"
                type="text"
                required
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Ex: Juliana Mendes"
                className="input-field w-full rounded-lg px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="ql-phone"
                className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
              >
                WhatsApp / Telefone *
              </label>
              <input
                id="ql-phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(formatPhoneBr(e.target.value))}
                placeholder="(31) 99999-9999"
                className="input-field w-full rounded-lg px-3 py-2.5 font-mono-num text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="ql-email"
                className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
              >
                E-mail Comercial
              </label>
              <input
                id="ql-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contato@empresa.com.br"
                className="input-field w-full rounded-lg px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="ql-funnel"
                className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
              >
                Vertical
              </label>
              <select
                id="ql-funnel"
                value={funnel}
                onChange={(e) => {
                  const next = e.target.value as FunnelId;
                  setFunnel(next);
                  const found = FUNNELS.find((f) => f.id === next);
                  if (found) setEstimatedValue(String(found.defaultValue));
                }}
                className="input-field w-full rounded-lg px-3 py-2.5 text-sm"
              >
                {FUNNELS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.index} · {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="ql-value"
                className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
              >
                Valor Estimado (R$)
              </label>
              <input
                id="ql-value"
                type="number"
                min={0}
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value)}
                className="input-field w-full rounded-lg px-3 py-2.5 font-mono-num text-sm font-semibold"
              />
            </div>

            <div>
              <label
                htmlFor="ql-origin"
                className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
              >
                Origem
              </label>
              <input
                id="ql-origin"
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="Instagram, Indicação, Site..."
                className="input-field w-full rounded-lg px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="ql-partner"
                className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
              >
                Parceiro Indicador (15%)
              </label>
              <select
                id="ql-partner"
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
                className="input-field w-full rounded-lg px-3 py-2.5 text-sm"
              >
                <option value="">Venda direta (sem parceiro)</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.commissionRate}%)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="ql-notes"
              className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
            >
              Briefing Inicial
            </label>
            <textarea
              id="ql-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Data desejada, formato do projeto ou observações..."
              className="input-field w-full rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="badge-danger rounded-lg px-3.5 py-2 text-xs font-medium"
            >
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost min-h-[44px] rounded-lg px-4 py-2.5 text-xs font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-accent min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-lg px-5 py-2.5 text-xs font-bold disabled:opacity-50"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              {submitting ? "Salvando..." : "Salvar Lead no Funil"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
