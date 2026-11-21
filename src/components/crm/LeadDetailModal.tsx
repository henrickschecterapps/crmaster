"use client";

import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  Handshake,
  Instagram,
  Mail,
  MessageCircle,
  Plus,
  Save,
  Search,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  FUNNELS,
  InteractionType,
  Lead,
  Partner,
  PARTNER_ROLES,
  PartnerRole,
  PaymentStatus,
  PostSaleChecklistItem,
  STAGES,
  StageId,
} from "@/types/crm";
import {
  buildPostSaleChecklist,
  cn,
  formatCurrency,
  formatCurrencyExact,
  formatDateBr,
  formatDateTimeBr,
  getLeadStagnation,
} from "@/lib/utils";

interface LeadDetailModalProps {
  lead: Lead;
  partners: Partner[];
  onClose: () => void;
  onUpdateLead: (
    leadId: string,
    patch: Partial<Lead>,
    interaction?: { type: InteractionType; title: string; description: string },
    touchLastInteraction?: boolean
  ) => Promise<void>;
  onSyncLead: (lead: Lead) => void;
  onDeleteLead: (leadId: string) => Promise<void>;
  onCreatePartner: (
    partner: Omit<Partner, "id" | "createdAt">
  ) => Promise<Partner>;
  onOpenDispatcher: (lead: Lead) => void;
  onNotify: (message: string, tone?: "success" | "info" | "error") => void;
}

export function LeadDetailModal({
  lead,
  partners,
  onClose,
  onUpdateLead,
  onSyncLead,
  onDeleteLead,
  onCreatePartner,
  onOpenDispatcher,
  onNotify,
}: LeadDetailModalProps) {
  const [companyName, setCompanyName] = useState(lead.companyName);
  const [contactName, setContactName] = useState(lead.contactName);
  const [contactRole, setContactRole] = useState(lead.contactRole || "");
  const [phone, setPhone] = useState(lead.phone);
  const [email, setEmail] = useState(lead.email);
  const [website, setWebsite] = useState(lead.website || "");
  const [instagram, setInstagram] = useState(lead.instagram || "");
  const [funnel, setFunnel] = useState(lead.funnel);
  const [stage, setStage] = useState<StageId>(lead.stage);
  const [estimatedValue, setEstimatedValue] = useState(
    String(lead.estimatedValue)
  );
  const [origin, setOrigin] = useState(lead.origin);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(
    lead.paymentStatus
  );
  const [partnerId, setPartnerId] = useState<string>(lead.partnerId || "");
  const [commissionPaid, setCommissionPaid] = useState(lead.commissionPaid);
  const [eventDate, setEventDate] = useState(lead.eventDate || "");
  const [cnpj, setCnpj] = useState(lead.cnpj || "");
  const [cpf, setCpf] = useState(lead.cpf || "");
  const [razaoSocial, setRazaoSocial] = useState(lead.razaoSocial || "");
  const [notes, setNotes] = useState(lead.notes);
  const [automacaoAtiva, setAutomacaoAtiva] = useState(lead.automacaoAtiva);
  const [respondeu, setRespondeu] = useState(lead.respondeu);
  const [checklist, setChecklist] = useState<PostSaleChecklistItem[]>(
    lead.postSaleChecklist ?? []
  );

  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [showNewPartner, setShowNewPartner] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState("");
  const [newPartnerRole, setNewPartnerRole] =
    useState<PartnerRole>("gerente_espaco");
  const [newPartnerCompany, setNewPartnerCompany] = useState("");
  const [newPartnerPhone, setNewPartnerPhone] = useState("");

  useEffect(() => {
    setCompanyName(lead.companyName);
    setContactName(lead.contactName);
    setContactRole(lead.contactRole || "");
    setPhone(lead.phone);
    setEmail(lead.email);
    setWebsite(lead.website || "");
    setInstagram(lead.instagram || "");
    setFunnel(lead.funnel);
    setStage(lead.stage);
    setEstimatedValue(String(lead.estimatedValue));
    setOrigin(lead.origin);
    setPaymentStatus(lead.paymentStatus);
    setPartnerId(lead.partnerId || "");
    setCommissionPaid(lead.commissionPaid);
    setEventDate(lead.eventDate || "");
    setCnpj(lead.cnpj || "");
    setCpf(lead.cpf || "");
    setRazaoSocial(lead.razaoSocial || "");
    setNotes(lead.notes);
    setAutomacaoAtiva(lead.automacaoAtiva);
    setRespondeu(lead.respondeu);
    setChecklist(lead.postSaleChecklist ?? []);
  }, [lead]);

  const numericValue = Number(estimatedValue) || 0;
  const selectedPartner = partners.find((p) => p.id === partnerId);
  const commissionRate = selectedPartner ? selectedPartner.commissionRate : 15;
  const commissionAmount = partnerId
    ? numericValue * (commissionRate / 100)
    : 0;
  const stagnation = getLeadStagnation(lead);
  const isPortrait = Boolean(cpf) && !cnpj;

  const proposalPath = `/proposta/${lead.id}`;
  const fullProposalUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${proposalPath}`
      : proposalPath;

  const handleCopyProposal = async () => {
    try {
      await navigator.clipboard.writeText(fullProposalUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Ignore
    }
  };

  const handleEnrichWebsite = async () => {
    if (!website.trim()) {
      onNotify("Informe o site da empresa antes de buscar contatos.", "error");
      return;
    }
    setEnriching(true);
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          website: website.trim(),
          companyName,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        onNotify(json.error || "Não foi possível enriquecer o site.", "error");
        return;
      }

      if (json.bestEmail && !email) setEmail(json.bestEmail);
      if (json.bestInstagram && !instagram) setInstagram(json.bestInstagram);
      if (json.lead) onSyncLead(json.lead as Lead);

      onNotify(
        json.bestEmail || json.bestInstagram
          ? `Encontrado: ${json.bestEmail || "sem e-mail"} ${
              json.bestInstagram ? `· ${json.bestInstagram}` : ""
            }`
          : "Nenhum e-mail ou Instagram público encontrado neste site.",
        "success"
      );
    } catch {
      onNotify("Erro ao consultar site da empresa.", "error");
    } finally {
      setEnriching(false);
    }
  };

  const handleMarkResponded = async () => {
    setRespondeu(true);
    setAutomacaoAtiva(false);
    await onUpdateLead(
      lead.id,
      { respondeu: true, automacaoAtiva: false },
      {
        type: "nota",
        title: "Lead marcado como Respondeu",
        description:
          "Trava de segurança acionada: régua de follow-up automático desativada.",
      },
      true
    );
    onNotify(
      "Lead marcado como Respondeu — régua automática desativada.",
      "success"
    );
  };

  const handleToggleChecklistItem = async (itemId: string) => {
    const updatedList = checklist.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    setChecklist(updatedList);
    await onUpdateLead(
      lead.id,
      { postSaleChecklist: updatedList },
      undefined,
      false
    );
  };

  const handleGenerateChecklistNow = async () => {
    const generated = buildPostSaleChecklist(funnel);
    setChecklist(generated);
    await onUpdateLead(
      lead.id,
      { postSaleChecklist: generated },
      {
        type: "pos_venda",
        title: "Checklist de Pós-Venda & Recorrência gerado",
        description: `${generated.length} tarefas programadas automaticamente.`,
      },
      false
    );
    onNotify("Checklist de Pós-Venda criado com sucesso.", "success");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const paymentChanged = paymentStatus !== lead.paymentStatus;
      let nextStage = stage;
      if (paymentChanged) {
        if (paymentStatus === "sinal_pago" && stage !== "fechado") {
          nextStage = "sinal_pago";
        } else if (paymentStatus === "quitado") {
          nextStage = "fechado";
        }
      }

      const interaction = paymentChanged
        ? {
            type: "pagamento" as InteractionType,
            title:
              paymentStatus === "quitado"
                ? "Pagamento 100% Quitado"
                : paymentStatus === "sinal_pago"
                ? "Sinal de 50% Registrado"
                : "Status de pagamento alterado para Pendente",
            description:
              paymentStatus === "sinal_pago"
                ? `Valor do sinal (50%): ${formatCurrencyExact(
                    numericValue * 0.5
                  )}`
                : paymentStatus === "quitado"
                ? `Valor total liquidado: ${formatCurrencyExact(numericValue)}`
                : "Aguardando confirmação financeira.",
          }
        : undefined;

      await onUpdateLead(
        lead.id,
        {
          companyName,
          contactName,
          contactRole,
          phone,
          email,
          website: website.trim() || undefined,
          instagram: instagram.trim() || undefined,
          funnel,
          stage: nextStage,
          estimatedValue: numericValue,
          origin,
          paymentStatus,
          partnerId: partnerId || null,
          commissionPaid,
          eventDate: eventDate || undefined,
          cnpj: cnpj || undefined,
          cpf: cpf || undefined,
          razaoSocial: razaoSocial || undefined,
          notes,
          automacaoAtiva,
          respondeu,
          postSaleChecklist: checklist,
        },
        interaction,
        paymentChanged
      );
      setStage(nextStage);
      onNotify("Alterações do lead salvas.", "success");
    } finally {
      setSaving(false);
    }
  };

  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      await onUpdateLead(
        lead.id,
        {},
        {
          type: "nota",
          title: "Interação / Anotação registrada",
          description: newNote.trim(),
        },
        true
      );
      setNewNote("");
    } finally {
      setAddingNote(false);
    }
  };

  const handleCreatePartnerInline = async () => {
    if (!newPartnerName.trim()) return;
    const created = await onCreatePartner({
      name: newPartnerName.trim(),
      role: newPartnerRole,
      company: newPartnerCompany.trim() || "Belo Horizonte",
      phone: newPartnerPhone.trim(),
      commissionRate: 15,
    });
    setPartnerId(created.id);
    setShowNewPartner(false);
    setNewPartnerName("");
    setNewPartnerCompany("");
    setNewPartnerPhone("");
  };

  const getInteractionIcon = (type: InteractionType) => {
    switch (type) {
      case "whatsapp":
        return <MessageCircle className="h-3.5 w-3.5 text-emerald-400" />;
      case "email":
        return <Mail className="h-3.5 w-3.5 text-sky-400" />;
      case "proposta_vista":
      case "radar":
        return <Eye className="h-3.5 w-3.5 text-[var(--accent)]" />;
      case "proposta_aprovada":
        return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
      case "pagamento":
        return <CreditCard className="h-3.5 w-3.5 text-emerald-400" />;
      case "followup_auto":
        return <Bot className="h-3.5 w-3.5 text-[var(--accent)]" />;
      case "pos_venda":
        return <ClipboardCheck className="h-3.5 w-3.5 text-emerald-400" />;
      case "enriquecimento":
        return <Sparkles className="h-3.5 w-3.5 text-sky-400" />;
      default:
        return <Clock className="h-3.5 w-3.5 text-[var(--text-muted)]" />;
    }
  };

  const completedChecklist = checklist.filter((c) => c.completed).length;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex h-full w-full max-w-3xl flex-col bg-[var(--bg-surface-solid)] border-l border-[var(--border-hairline)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-hairline)] px-6 py-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--accent)]">
                Detalhes do Lead
              </span>
              {stagnation.level === "critical" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-400">
                  <AlertTriangle className="h-3 w-3" />
                  {stagnation.label}
                </span>
              )}
              {stagnation.level === "warning" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                  <Clock className="h-3 w-3" />
                  {stagnation.label}
                </span>
              )}
              {lead.visualizadaEm && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                  <Eye className="h-3 w-3" />
                  Visualizada {lead.visualizacoesProposta}x
                </span>
              )}
              {(lead.tags ?? []).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-400"
                >
                  {tag}
                </span>
              ))}
            </div>
            <h2 className="mt-1 truncate text-xl font-bold text-[var(--text-primary)]">
              {lead.companyName}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onOpenDispatcher(lead)}
              className="btn-accent inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              Disparar Msg
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost flex h-9 w-9 items-center justify-center rounded-xl cursor-pointer"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Phase 2: Follow-up Automation & Safety Lock Strip */}
          <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/65 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                  automacaoAtiva
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "bg-[var(--bg-surface-solid)] text-[var(--text-muted)]"
                )}
              >
                <Bot className="h-4.5 w-4.5" />
              </span>
              <div>
                <p className="text-xs font-bold text-[var(--text-primary)]">
                  Régua de Follow-up Automático (Dia 2 / Dia 5)
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {respondeu
                    ? "Cliente respondeu — trava de segurança desativou a cadência."
                    : automacaoAtiva
                    ? `Ativa (etapa atual: ${
                        lead.followupStep === 0
                          ? "aguardando Dia 2"
                          : lead.followupStep === 1
                          ? "Dia 2 enviado"
                          : "Dia 5 / Último Toque enviado"
                      })`
                    : "Desativada para este lead."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <label className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-solid)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={automacaoAtiva}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setAutomacaoAtiva(next);
                    if (next) setRespondeu(false);
                  }}
                  className="h-3.5 w-3.5 rounded accent-[var(--accent)]"
                />
                Automação
              </label>

              {!respondeu ? (
                <button
                  type="button"
                  onClick={handleMarkResponded}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/25 transition-colors cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  Marcar como Respondeu
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Respondeu
                </span>
              )}
            </div>
          </div>

          {/* Trackable Proposal Banner + PDF Contract Reference */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
            <div className="sm:col-span-7 rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)]/50 p-4 flex flex-col justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-[var(--text-primary)]">
                  Proposta Web Rastreável + Radar
                </p>
                <p className="mt-0.5 truncate font-mono-num text-[11px] text-[var(--text-secondary)]">
                  {fullProposalUrl}
                </p>
                {lead.visualizadaEm ? (
                  <p className="mt-1 text-[11px] text-[var(--accent)]">
                    Aberta {lead.visualizacoesProposta}x · primeira em{" "}
                    {formatDateTimeBr(lead.visualizadaEm)}
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                    Dispara alerta de Radar ao abrir (debounce 10 min).
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyProposal}
                  className="btn-ghost inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer bg-[var(--bg-surface-solid)]"
                >
                  {copiedLink ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copiar Link
                    </>
                  )}
                </button>
                <a
                  href={proposalPath}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-accent inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir Proposta
                </a>
              </div>
            </div>

            {/* Phase 2: Contract / Image Release PDF Box */}
            <div className="sm:col-span-5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/65 p-4 flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                  <FileText className="h-4 w-4 text-[var(--accent)]" />
                  {isPortrait ? "Termo de Imagem (PDF)" : "Contrato PDF"}
                </div>
                {lead.contractDocument ? (
                  <p className="mt-1 truncate font-mono-num text-[11px] text-emerald-400">
                    {lead.contractDocument.fileName}
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                    Gerado automaticamente na aprovação ou sob demanda abaixo.
                  </p>
                )}
              </div>
              <a
                href={`/api/proposals/${lead.id}/pdf`}
                download
                className="btn-ghost inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold bg-[var(--bg-surface-solid)]"
              >
                <Download className="h-3.5 w-3.5 text-[var(--accent)]" />
                Baixar PDF Agora
              </a>
            </div>
          </div>

          {/* Core Editable Fields + Website Enricher */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                Empresa / Cliente
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="input-field w-full rounded-xl px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                Decisor / Contato
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="input-field w-full rounded-xl px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                WhatsApp / Telefone
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input-field w-full rounded-xl px-3 py-2 font-mono-num text-sm"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                E-mail Comercial
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field w-full rounded-xl px-3 py-2 text-sm"
              />
            </div>

            {/* Phase 2: Website + Enricher Trigger */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                Website
              </label>
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <Globe className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://empresa.com.br"
                    className="input-field w-full rounded-xl py-2 pl-8 pr-3 text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleEnrichWebsite}
                  disabled={enriching}
                  className="btn-ghost shrink-0 inline-flex items-center gap-1 rounded-xl px-2.5 py-2 text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                  title="Buscar e-mail corporativo e Instagram no site"
                >
                  <Search className="h-3.5 w-3.5 text-[var(--accent)]" />
                  {enriching ? "..." : "Enriquecer"}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                Instagram
              </label>
              <div className="relative">
                <Instagram className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="@empresa"
                  className="input-field w-full rounded-xl py-2 pl-8 pr-3 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                Funil
              </label>
              <select
                value={funnel}
                onChange={(e) => setFunnel(e.target.value as Lead["funnel"])}
                className="input-field w-full rounded-xl px-3 py-2 text-sm"
              >
                {FUNNELS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label} ({f.subtitle})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                Etapa do Kanban
              </label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as StageId)}
                className="input-field w-full rounded-xl px-3 py-2 text-sm"
              >
                {STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                Valor Estimado (R$)
              </label>
              <input
                type="number"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value)}
                className="input-field w-full rounded-xl px-3 py-2 font-mono-num text-sm font-semibold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                Data do Evento / Ensaio
              </label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="input-field w-full rounded-xl py-2 pl-9 pr-3 font-mono-num text-sm"
                />
              </div>
            </div>
          </div>

          {/* Payment Status (50% Sinal / 50% Final) */}
          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/55 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Status Financeiro (50% Sinal / 50% Quitação)
                </h3>
              </div>
              <span className="font-mono-num text-xs text-[var(--text-secondary)]">
                Sinal 50%: {formatCurrency(numericValue * 0.5)}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: "pendente", label: "Pendente", sub: "R$ 0 recebido" },
                  {
                    id: "sinal_pago",
                    label: "Sinal Pago (50%)",
                    sub: formatCurrency(numericValue * 0.5),
                  },
                  {
                    id: "quitado",
                    label: "Quitado (100%)",
                    sub: formatCurrency(numericValue),
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPaymentStatus(opt.id)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left transition-all cursor-pointer",
                    paymentStatus === opt.id
                      ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400"
                      : "border-[var(--border-hairline)] bg-[var(--bg-surface-solid)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                  )}
                >
                  <p className="text-xs font-bold">{opt.label}</p>
                  <p className="mt-0.5 font-mono-num text-[11px] opacity-80">
                    {opt.sub}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Phase 2: Automatic Post-Sale & Recurrence Checklist */}
          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/55 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Checklist de Pós-Venda &amp; Recorrência
                </h3>
              </div>
              {checklist.length > 0 ? (
                <span className="font-mono-num text-xs font-semibold text-emerald-400">
                  {completedChecklist}/{checklist.length} concluídas
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerateChecklistNow}
                  className="text-xs font-semibold text-[var(--accent)] hover:underline cursor-pointer"
                >
                  + Gerar Checklist Agora
                </button>
              )}
            </div>

            {checklist.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">
                Criado automaticamente ao mover o card para{" "}
                <strong>Fechado</strong> (com datas de prévia, galeria, NF,
                depoimento e alerta de recorrência).
              </p>
            ) : (
              <div className="space-y-2">
                {checklist.map((item) => (
                  <label
                    key={item.id}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-xs transition-all",
                      item.completed
                        ? "border-emerald-500/30 bg-emerald-500/10 text-[var(--text-muted)] line-through"
                        : "border-[var(--border-hairline)] bg-[var(--bg-surface-solid)] text-[var(--text-primary)]"
                    )}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => handleToggleChecklistItem(item.id)}
                        className="h-4 w-4 rounded accent-emerald-500 shrink-0"
                      />
                      <span className="truncate font-medium">{item.title}</span>
                    </span>
                    <span className="shrink-0 font-mono-num text-[11px] text-[var(--text-secondary)]">
                      {formatDateBr(item.dueDate)}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Partner Linking & Automatic 15% Commission */}
          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/55 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Handshake className="h-4 w-4 text-[var(--accent)]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Parceiro Indicador &amp; Comissão Automática (15%)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewPartner((prev) => !prev)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Novo Parceiro
              </button>
            </div>

            {showNewPartner && (
              <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface-solid)] p-3.5 space-y-2.5">
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <input
                    type="text"
                    placeholder="Nome do parceiro"
                    value={newPartnerName}
                    onChange={(e) => setNewPartnerName(e.target.value)}
                    className="input-field rounded-lg px-2.5 py-1.5 text-xs"
                  />
                  <select
                    value={newPartnerRole}
                    onChange={(e) =>
                      setNewPartnerRole(e.target.value as PartnerRole)
                    }
                    className="input-field rounded-lg px-2.5 py-1.5 text-xs"
                  >
                    <option value="gerente_espaco">
                      Gerente de Espaço de Eventos (15%)
                    </option>
                    <option value="modelo_provador">
                      Modelo de Provador (15%)
                    </option>
                    <option value="outro">Parceiro Comercial (15%)</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Espaço / Agência / Região"
                    value={newPartnerCompany}
                    onChange={(e) => setNewPartnerCompany(e.target.value)}
                    className="input-field rounded-lg px-2.5 py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="WhatsApp (31) 9..."
                    value={newPartnerPhone}
                    onChange={(e) => setNewPartnerPhone(e.target.value)}
                    className="input-field rounded-lg px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewPartner(false)}
                    className="btn-ghost rounded-lg px-3 py-1.5 text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCreatePartnerInline}
                    className="btn-accent rounded-lg px-3 py-1.5 text-xs font-bold cursor-pointer"
                  >
                    Cadastrar &amp; Vincular
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-center">
              <div className="sm:col-span-7">
                <select
                  value={partnerId}
                  onChange={(e) => setPartnerId(e.target.value)}
                  className="input-field w-full rounded-xl px-3 py-2 text-xs"
                >
                  <option value="">Sem parceiro indicador (venda direta)</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {PARTNER_ROLES[p.role]} ({p.commissionRate}%)
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-5 flex items-center justify-between rounded-xl bg-[var(--bg-surface-solid)] border border-[var(--border-hairline)] px-3.5 py-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                    Comissão ({commissionRate}%)
                  </p>
                  <p className="font-mono-num text-sm font-bold text-[var(--accent)]">
                    {formatCurrencyExact(commissionAmount)}
                  </p>
                </div>
                {partnerId && (
                  <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commissionPaid}
                      onChange={(e) => setCommissionPaid(e.target.checked)}
                      className="h-4 w-4 rounded accent-[var(--accent)]"
                    />
                    Paga
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Billing / Contract Info */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                {isPortrait ? "CPF (p/ Termo de Imagem)" : "CNPJ (p/ Contrato / NFS-e)"}
              </label>
              {isPortrait ? (
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  className="input-field w-full rounded-xl px-3 py-2 font-mono-num text-sm"
                />
              ) : (
                <input
                  type="text"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="input-field w-full rounded-xl px-3 py-2 font-mono-num text-sm"
                />
              )}
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                {isPortrait ? "Nome Completo no Termo" : "Razão Social"}
              </label>
              <input
                type="text"
                value={razaoSocial}
                onChange={(e) => setRazaoSocial(e.target.value)}
                placeholder={isPortrait ? "Nome completo" : "Razão Social Ltda"}
                className="input-field w-full rounded-xl px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* General Notes */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
              Anotações Estratégicas do Projeto
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Briefing do evento, expectativas de entrega, restrições de horário..."
              className="input-field w-full rounded-xl px-3.5 py-2.5 text-sm leading-relaxed"
            />
          </div>

          {/* Chronological Timeline + Add Note */}
          <div className="space-y-3 border-t border-[var(--border-hairline)] pt-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
              Linha do Tempo de Interações ({lead.interactions.length})
            </h3>

            <form onSubmit={handleAddInteraction} className="flex gap-2">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Registrar ligação, follow-up ou observação (zera o alerta de 48h)..."
                className="input-field flex-1 rounded-xl px-3.5 py-2 text-xs"
              />
              <button
                type="submit"
                disabled={addingNote || !newNote.trim()}
                className="btn-accent rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-50 cursor-pointer"
              >
                Registrar
              </button>
            </form>

            <div className="space-y-2.5 pt-1">
              {lead.interactions.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3 rounded-2xl bg-[var(--bg-subtle)]/65 p-3.5 border border-[var(--border-hairline)]"
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-surface-solid)] border border-[var(--border-hairline)]">
                    {getInteractionIcon(item.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-[var(--text-primary)]">
                        {item.title}
                      </p>
                      <span className="font-mono-num text-[10px] text-[var(--text-muted)]">
                        {formatDateTimeBr(item.createdAt)}
                      </span>
                    </div>
                    {item.description && (
                      <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sticky Footer Actions */}
        <div className="flex items-center justify-between gap-3 border-t border-[var(--border-hairline)] bg-[var(--bg-surface-solid)] px-6 py-4">
          <button
            type="button"
            onClick={async () => {
              if (
                window.confirm(
                  `Deseja realmente remover "${lead.companyName}" do CRM?`
                )
              ) {
                await onDeleteLead(lead.id);
                onClose();
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Excluir
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-accent inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-60 cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Salvando..." : "Salvar Alterações"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
