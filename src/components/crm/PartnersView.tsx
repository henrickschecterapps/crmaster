"use client";

import React, { useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  Edit3,
  Handshake,
  MessageCircle,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  InteractionType,
  Lead,
  Partner,
  PARTNER_ROLES,
  PartnerRole,
} from "@/types/crm";
import {
  buildWhatsappUrl,
  formatCurrency,
  formatCurrencyExact,
  formatPhoneBr,
  getPartnerCommission,
  getStageLabel,
} from "@/lib/utils";

interface PartnersViewProps {
  partners: Partner[];
  leads: Lead[];
  onCreatePartner: (
    partner: Omit<Partner, "id" | "createdAt">
  ) => Promise<Partner>;
  onUpdatePartner: (
    partnerId: string,
    patch: Partial<Omit<Partner, "id" | "createdAt">>
  ) => Promise<void>;
  onDeletePartner: (partnerId: string) => Promise<void>;
  onUpdateLead: (
    leadId: string,
    patch: Partial<Lead>,
    interaction?: { type: InteractionType; title: string; description: string },
    touchLastInteraction?: boolean
  ) => Promise<void>;
  onSelectLead: (lead: Lead) => void;
  onNotify: (message: string, tone?: "success" | "info" | "error") => void;
}

export function PartnersView({
  partners,
  leads,
  onCreatePartner,
  onUpdatePartner,
  onDeletePartner,
  onUpdateLead,
  onSelectLead,
  onNotify,
}: PartnersViewProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState<PartnerRole>("modelo_provador");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [commissionRate, setCommissionRate] = useState("15");
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const partnerSummaries = useMemo(() => {
    return partners.map((partner) => {
      const referred = leads.filter((l) => l.partnerId === partner.id);
      let payable = 0;
      let paid = 0;
      let potential = 0;

      for (const lead of referred) {
        const comm = getPartnerCommission(lead, partners);
        const qualifies =
          lead.stage === "sinal_pago" ||
          lead.stage === "fechado" ||
          lead.paymentStatus !== "pendente";

        if (qualifies) {
          if (lead.commissionPaid) paid += comm;
          else payable += comm;
        } else {
          potential += comm;
        }
      }

      return {
        partner,
        referred,
        payable,
        paid,
        potential,
      };
    });
  }, [partners, leads]);

  const totals = useMemo(() => {
    return partnerSummaries.reduce(
      (acc, s) => ({
        payable: acc.payable + s.payable,
        paid: acc.paid + s.paid,
        potential: acc.potential + s.potential,
        referrals: acc.referrals + s.referred.length,
      }),
      { payable: 0, paid: 0, potential: 0, referrals: 0 }
    );
  }, [partnerSummaries]);

  const openCreate = () => {
    setEditingId(null);
    setName("");
    setRole("modelo_provador");
    setCompany("");
    setPhone("");
    setCommissionRate("15");
    setFormOpen(true);
  };

  const openEdit = (partner: Partner) => {
    setEditingId(partner.id);
    setName(partner.name);
    setRole(partner.role);
    setCompany(partner.company);
    setPhone(partner.phone);
    setCommissionRate(String(partner.commissionRate));
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        role,
        company: company.trim() || "Belo Horizonte",
        phone: phone.trim(),
        commissionRate: Number(commissionRate) || 15,
      };
      if (editingId) {
        await onUpdatePartner(editingId, payload);
        onNotify(`Parceiro "${payload.name}" atualizado.`, "success");
      } else {
        await onCreatePartner(payload);
      }
      setFormOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCommissionPaid = async (lead: Lead, partner: Partner) => {
    const nextPaid = !lead.commissionPaid;
    const comm = getPartnerCommission(lead, partners);
    await onUpdateLead(
      lead.id,
      { commissionPaid: nextPaid },
      {
        type: "pagamento",
        title: nextPaid
          ? `Comissão de ${partner.name} marcada como paga`
          : `Comissão de ${partner.name} reaberta como pendente`,
        description: `Valor (${partner.commissionRate}%): ${formatCurrencyExact(
          comm
        )}.`,
      },
      false
    );
    onNotify(
      nextPaid
        ? `Comissão de ${formatCurrencyExact(comm)} quitada para ${partner.name}.`
        : `Comissão de ${partner.name} marcada como pendente.`,
      "success"
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono-num text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-text)]">
            Alianças Comerciais · 15% via Pix
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            Parceiros e Comissões
          </h1>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="btn-accent min-h-[44px] inline-flex items-center justify-center gap-2 self-start rounded-lg px-4 py-2.5 text-xs font-bold"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          Novo Parceiro
        </button>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="surface-card rounded-xl p-5">
          <p className="text-xs font-medium text-[var(--text-secondary)]">
            Parceiros Ativos
          </p>
          <p className="mt-2 font-mono-num text-2xl font-bold text-[var(--text-primary)]">
            {partners.length}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {totals.referrals} indicações vinculadas
          </p>
        </div>

        <div className="surface-card rounded-xl p-5">
          <p className="text-xs font-medium text-[var(--text-secondary)]">
            Comissões a Pagar
          </p>
          <p className="mt-2 font-mono-num text-2xl font-bold text-[var(--accent-text)]">
            {formatCurrencyExact(totals.payable)}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Projetos com sinal pago ou fechados
          </p>
        </div>

        <div className="surface-card rounded-xl p-5">
          <p className="text-xs font-medium text-[var(--text-secondary)]">
            Comissões Pagas
          </p>
          <p className="mt-2 font-mono-num text-2xl font-bold text-[var(--status-success)]">
            {formatCurrencyExact(totals.paid)}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Total já repassado aos parceiros
          </p>
        </div>

        <div className="surface-card rounded-xl p-5">
          <p className="text-xs font-medium text-[var(--text-secondary)]">
            Potencial em Pipeline
          </p>
          <p className="mt-2 font-mono-num text-2xl font-bold text-[var(--text-primary)]">
            {formatCurrencyExact(totals.potential)}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Indicações ainda em negociação
          </p>
        </div>
      </div>

      {/* Create / Edit Partner Panel */}
      {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="surface-card rounded-xl p-5 space-y-4 border-[var(--accent-border)]"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--text-primary)]">
              {editingId ? "Editar Parceiro" : "Cadastrar Parceiro Indicador"}
            </h2>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              aria-label="Fechar formulário de parceiro"
              className="btn-ghost flex h-11 w-11 items-center justify-center rounded-lg"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label
                htmlFor="partner-name"
                className="block text-xs font-semibold text-[var(--text-secondary)] mb-1"
              >
                Nome *
              </label>
              <input
                id="partner-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do parceiro"
                className="input-field w-full rounded-lg px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label
                htmlFor="partner-role"
                className="block text-xs font-semibold text-[var(--text-secondary)] mb-1"
              >
                Perfil
              </label>
              <select
                id="partner-role"
                value={role}
                onChange={(e) => setRole(e.target.value as PartnerRole)}
                className="input-field w-full rounded-lg px-3 py-2 text-xs"
              >
                <option value="modelo_provador">Modelo de Provador VIP</option>
                <option value="gerente_espaco">
                  Gerente de Espaço / Promoter
                </option>
                <option value="outro">Parceiro Comercial</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="partner-company"
                className="block text-xs font-semibold text-[var(--text-secondary)] mb-1"
              >
                Espaço / Região
              </label>
              <input
                id="partner-company"
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Ex: Barro Preto BH"
                className="input-field w-full rounded-lg px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label
                htmlFor="partner-phone"
                className="block text-xs font-semibold text-[var(--text-secondary)] mb-1"
              >
                WhatsApp
              </label>
              <input
                id="partner-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhoneBr(e.target.value))}
                placeholder="(31) 99999-9999"
                className="input-field w-full rounded-lg px-3 py-2 font-mono-num text-xs"
              />
            </div>

            <div>
              <label
                htmlFor="partner-rate"
                className="block text-xs font-semibold text-[var(--text-secondary)] mb-1"
              >
                Comissão (%)
              </label>
              <input
                id="partner-rate"
                type="number"
                min={1}
                max={50}
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
                className="input-field w-full rounded-lg px-3 py-2 font-mono-num text-xs font-semibold"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="btn-ghost min-h-[44px] rounded-lg px-4 py-2 text-xs font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-accent min-h-[44px] rounded-lg px-5 py-2 text-xs font-bold disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar Parceiro"}
            </button>
          </div>
        </form>
      )}

      {/* Partner Cards List */}
      {partnerSummaries.length === 0 ? (
        <div className="surface-card rounded-xl p-10 text-center space-y-2">
          <Users
            aria-hidden="true"
            className="mx-auto h-8 w-8 text-[var(--text-muted)]"
          />
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            Nenhum parceiro cadastrado ainda
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            Cadastre modelos de provador VIP ou gerentes de espaços de eventos
            para rastrear comissões de 15% automaticamente.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {partnerSummaries.map(({ partner, referred, payable, paid }) => {
            const waUrl = partner.phone
              ? buildWhatsappUrl(
                  partner.phone,
                  `Olá ${partner.name}, tudo bem? Passando pela ÚLTIMO QUADRO para alinhar o repasse das suas indicações.`
                )
              : null;

            return (
              <section
                key={partner.id}
                className="surface-card rounded-xl p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="badge-accent inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold">
                        <Handshake aria-hidden="true" className="h-3 w-3" />
                        {PARTNER_ROLES[partner.role]} ({partner.commissionRate}
                        %)
                      </span>
                      <h2 className="mt-2 text-base font-bold text-[var(--text-primary)]">
                        {partner.name}
                      </h2>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {partner.company}
                        {partner.phone ? ` · ${partner.phone}` : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Abrir WhatsApp de ${partner.name}`}
                          className="btn-ghost flex h-11 w-11 items-center justify-center rounded-lg"
                        >
                          <MessageCircle
                            aria-hidden="true"
                            className="h-4 w-4 text-[var(--status-success)]"
                          />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => openEdit(partner)}
                        aria-label={`Editar parceiro ${partner.name}`}
                        className="btn-ghost flex h-11 w-11 items-center justify-center rounded-lg"
                      >
                        <Edit3 aria-hidden="true" className="h-4 w-4" />
                      </button>
                      {confirmDeleteId === partner.id ? (
                        <button
                          type="button"
                          onClick={async () => {
                            await onDeletePartner(partner.id);
                            setConfirmDeleteId(null);
                          }}
                          className="badge-danger min-h-[44px] rounded-lg px-2.5 text-xs font-bold"
                        >
                          Confirmar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(partner.id)}
                          aria-label={`Excluir parceiro ${partner.name}`}
                          className="btn-ghost flex h-11 w-11 items-center justify-center rounded-lg text-[var(--status-danger)]"
                        >
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Commission totals for this partner */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-lg bg-[var(--bg-subtle)] p-3">
                      <p className="text-[11px] text-[var(--text-muted)]">
                        A pagar
                      </p>
                      <p className="mt-0.5 font-mono-num text-sm font-bold text-[var(--accent-text)]">
                        {formatCurrencyExact(payable)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[var(--bg-subtle)] p-3">
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Já pago
                      </p>
                      <p className="mt-0.5 font-mono-num text-sm font-bold text-[var(--status-success)]">
                        {formatCurrencyExact(paid)}
                      </p>
                    </div>
                  </div>

                  {/* Referred Leads List */}
                  <div className="space-y-2 border-t border-[var(--border-hairline)] pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Indicações ({referred.length})
                    </p>
                    {referred.length === 0 ? (
                      <p className="text-xs text-[var(--text-muted)]">
                        Nenhuma indicação vinculada até o momento.
                      </p>
                    ) : (
                      referred.map((lead) => {
                        const comm = getPartnerCommission(lead, partners);
                        return (
                          <div
                            key={lead.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--bg-subtle)] px-3 py-2 text-xs"
                          >
                            <button
                              type="button"
                              onClick={() => onSelectLead(lead)}
                              className="min-w-0 flex-1 text-left hover:text-[var(--accent-text)]"
                            >
                              <p className="truncate font-semibold text-[var(--text-primary)]">
                                {lead.companyName}
                              </p>
                              <p className="text-[11px] text-[var(--text-muted)]">
                                {getStageLabel(lead.stage)} · Projeto{" "}
                                {formatCurrency(lead.estimatedValue)}
                              </p>
                            </button>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono-num font-bold text-[var(--text-primary)]">
                                {formatCurrencyExact(comm)}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleCommissionPaid(lead, partner)
                                }
                                className={
                                  lead.commissionPaid
                                    ? "badge-success min-h-[36px] inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold"
                                    : "btn-ghost min-h-[36px] inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold"
                                }
                              >
                                {lead.commissionPaid ? (
                                  <>
                                    <CheckCircle2
                                      aria-hidden="true"
                                      className="h-3.5 w-3.5"
                                    />
                                    Paga
                                  </>
                                ) : (
                                  <>
                                    <Check
                                      aria-hidden="true"
                                      className="h-3.5 w-3.5"
                                    />
                                    Quitar
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
