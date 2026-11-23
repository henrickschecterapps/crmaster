"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Calendar,
  Check,
  Clock,
  Copy,
  Edit3,
  FileText,
  Layers,
  Mail,
  MessageCircle,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import {
  FUNNELS,
  IntegrationStatus,
  InteractionType,
  Lead,
  ScriptTemplate,
  StudioSettings,
  TemplateFunnelId,
} from "@/types/crm";
import {
  buildWhatsappUrl,
  cn,
  getFunnelLabel,
  getStageLabel,
  interpolateTemplate,
} from "@/lib/utils";

interface DispatcherViewProps {
  leads: Lead[];
  templates: ScriptTemplate[];
  settings: StudioSettings;
  integrationStatus: IntegrationStatus;
  initialLeadId?: string | null;
  onUpdateLead: (
    leadId: string,
    patch: Partial<Lead>,
    interaction?: { type: InteractionType; title: string; description: string },
    touchLastInteraction?: boolean
  ) => Promise<void>;
  onSyncLead: (lead: Lead) => void;
  onSaveTemplate: (
    template: Omit<ScriptTemplate, "id" | "createdAt" | "updatedAt"> & {
      id?: string;
    }
  ) => Promise<ScriptTemplate>;
  onDeleteTemplate: (templateId: string) => Promise<void>;
  onUpdateNextDate: (nextDate: string) => Promise<void>;
  onNotify: (message: string, tone?: "success" | "info" | "error") => void;
}

const TEMPLATE_VARIABLES = [
  { token: "{{nome_contato}}", label: "Nome do Contato" },
  { token: "{{nome_empresa}}", label: "Nome da Empresa" },
  { token: "{{link_proposta}}", label: "Link da Proposta" },
  { token: "{{proxima_data_livre}}", label: "Próxima Data Livre" },
] as const;

export function DispatcherView({
  leads,
  templates,
  settings,
  integrationStatus,
  initialLeadId,
  onUpdateLead,
  onSyncLead,
  onSaveTemplate,
  onDeleteTemplate,
  onUpdateNextDate,
  onNotify,
}: DispatcherViewProps) {
  const [selectedLeadId, setSelectedLeadId] = useState<string>(
    initialLeadId || leads[0]?.id || ""
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    templates[0]?.id || ""
  );
  const [nextAvailableDate, setNextAvailableDate] = useState<string>(
    settings.nextAvailableDate || "05/12/2026"
  );
  const [customEmail, setCustomEmail] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [batchLeadIds, setBatchLeadIds] = useState<string[]>([]);
  const [enqueueingBatch, setEnqueueingBatch] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(
    null
  );

  const [editingTemplate, setEditingTemplate] = useState<{
    id?: string;
    name: string;
    funnel: TemplateFunnelId;
    channel: "whatsapp" | "email" | "ambos";
    subject: string;
    body: string;
  } | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    if (!editingTemplate) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditingTemplate(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editingTemplate]);

  useEffect(() => {
    if (initialLeadId) {
      setSelectedLeadId(initialLeadId);
    }
  }, [initialLeadId]);

  const selectedLead = useMemo(
    () => leads.find((l) => l.id === selectedLeadId) ?? leads[0] ?? null,
    [leads, selectedLeadId]
  );

  const selectedTemplate = useMemo(
    () =>
      templates.find((t) => t.id === selectedTemplateId) ??
      templates[0] ??
      null,
    [templates, selectedTemplateId]
  );

  const proposalUrl = useMemo(() => {
    if (!selectedLead) return "";
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return `${origin}/portal/${selectedLead.id}`;
  }, [selectedLead]);

  useEffect(() => {
    if (selectedLead) {
      setCustomEmail(selectedLead.email || "");
    }
  }, [selectedLead]);

  useEffect(() => {
    if (!selectedLead || !selectedTemplate) return;
    const vars = {
      nome_contato: selectedLead.contactName,
      nome_empresa: selectedLead.companyName,
      link_proposta: proposalUrl,
      proxima_data_livre: nextAvailableDate,
    };
    setCustomSubject(interpolateTemplate(selectedTemplate.subject, vars));
    setCustomMessage(interpolateTemplate(selectedTemplate.body, vars));
  }, [selectedLead, selectedTemplate, proposalUrl, nextAvailableDate]);

  const activeEmailProviderLabel = integrationStatus.gmailLive
    ? "Gmail SMTP Ativo"
    : integrationStatus.resendLive
    ? "Resend API Ativa"
    : "E-mail: Modo Simulação";

  const activeEmailProviderLive =
    integrationStatus.gmailLive || integrationStatus.resendLive;

  const handleSendWhatsappSafe = async () => {
    if (!selectedLead || !customMessage.trim()) {
      onNotify("Selecione um lead e preencha a mensagem.", "error");
      return;
    }

    const waUrl = buildWhatsappUrl(selectedLead.phone, customMessage);
    window.open(waUrl, "_blank", "noopener,noreferrer");

    const nextStage =
      selectedLead.stage === "captado" ? "contatado" : selectedLead.stage;

    await onUpdateLead(
      selectedLead.id,
      { stage: nextStage },
      {
        type: "whatsapp",
        title: "Mensagem enviada no WhatsApp (Modo Seguro)",
        description:
          selectedLead.stage === "captado"
            ? `Script "${selectedTemplate?.name || "Personalizado"}" aberto via wa.me. Lead movido automaticamente para Contatado.`
            : `Script "${selectedTemplate?.name || "Personalizado"}" aberto via wa.me com link rastreável.`,
      },
      true
    );

    onNotify(
      selectedLead.stage === "captado"
        ? `WhatsApp aberto para ${selectedLead.contactName}. Card movido para Contatado.`
        : `WhatsApp aberto e registrado na linha do tempo de ${selectedLead.companyName}.`,
      "success"
    );
  };

  const handleSendEmail = async () => {
    if (!selectedLead) return;
    const targetEmail = customEmail.trim();
    if (!targetEmail) {
      onNotify("Informe um e-mail de destino antes de disparar.", "error");
      return;
    }

    setSendingEmail(true);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: selectedLead.id,
          to: targetEmail,
          subject:
            customSubject.trim() ||
            `Proposta Comercial | ${selectedLead.companyName}`,
          message: customMessage,
          proposalUrl,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        onNotify(json.error || "Falha ao enviar e-mail.", "error");
        return;
      }

      if (json.lead) {
        onSyncLead(json.lead as Lead);
      }

      if (json.mode === "live") {
        const providerName =
          json.provider === "gmail" ? "Gmail SMTP" : "Resend API";
        onNotify(
          `E-mail enviado via ${providerName} para ${targetEmail}.`,
          "success"
        );
      } else {
        onNotify(
          "E-mail simulado e registrado no histórico. Configure Gmail SMTP ou Resend para envio real.",
          "info"
        );
      }
    } catch {
      onNotify("Erro de rede ao disparar e-mail.", "error");
    } finally {
      setSendingEmail(false);
    }
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(customMessage);
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const toggleBatchLead = (id: string) => {
    setBatchLeadIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleEnqueueWhatsappBatch = async () => {
    if (batchLeadIds.length === 0 || !selectedTemplate) {
      onNotify(
        "Selecione ao menos 1 lead para agendar na Fila Anti-Ban.",
        "error"
      );
      return;
    }

    setEnqueueingBatch(true);
    try {
      const origin =
        typeof window !== "undefined"
          ? window.location.origin
          : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

      const items = batchLeadIds
        .map((id) => leads.find((l) => l.id === id))
        .filter((l): l is Lead => Boolean(l))
        .map((lead) => ({
          leadId: lead.id,
          companyName: lead.companyName,
          phone: lead.phone,
          message: interpolateTemplate(selectedTemplate.body, {
            nome_contato: lead.contactName,
            nome_empresa: lead.companyName,
            link_proposta: `${origin}/proposta/${lead.id}`,
            proxima_data_livre: nextAvailableDate,
          }),
        }));

      const res = await fetch("/api/whatsapp/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const json = await res.json();
      if (!res.ok) {
        onNotify(json.error || "Erro ao agendar fila.", "error");
        return;
      }

      setBatchLeadIds([]);
      onNotify(
        json.mode === "live"
          ? `${json.enqueued} disparo(s) agendados via API com intervalos aleatórios de 3 a 6 min.`
          : `${json.enqueued} disparo(s) salvos na Fila Anti-Ban (configure Evolution/Z-API em Configurações para envio automático).`,
        "success"
      );
    } finally {
      setEnqueueingBatch(false);
    }
  };

  const handleSaveTemplateForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate?.name.trim() || !editingTemplate.body.trim()) return;
    setSavingTemplate(true);
    try {
      const saved = await onSaveTemplate(editingTemplate);
      setSelectedTemplateId(saved.id);
      setEditingTemplate(null);
      onNotify(`Template "${saved.name}" salvo na biblioteca.`, "success");
    } finally {
      setSavingTemplate(false);
    }
  };

  const insertVariableIntoEditor = (token: string) => {
    if (!editingTemplate) return;
    setEditingTemplate({
      ...editingTemplate,
      body: `${editingTemplate.body}${
        editingTemplate.body.endsWith(" ") || !editingTemplate.body ? "" : " "
      }${token}`,
    });
  };

  const getTemplateFunnelLabel = (funnel: TemplateFunnelId) => {
    if (funnel === "geral") return "Geral / Parcerias";
    return getFunnelLabel(funnel);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono-num text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-text)]">
            Outbound &amp; Relacionamento Ativo
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            Disparador Inteligente &amp; Biblioteca de Scripts
          </h1>
        </div>

        <button
          type="button"
          onClick={() =>
            setEditingTemplate({
              name: "",
              funnel: "corporativo",
              channel: "ambos",
              subject: "Proposta Exclusiva | {{nome_empresa}} | ÚLTIMO QUADRO",
              body: "Olá {{nome_contato}}, tudo bem?\n\nPreparei uma proposta personalizada da ÚLTIMO QUADRO para a {{nome_empresa}}: {{link_proposta}}\n\nTenho agenda em {{proxima_data_livre}}.",
            })
          }
          className="btn-accent group inline-flex min-h-[40px] items-center gap-2 self-start rounded-lg pl-4 pr-2 py-2 text-xs font-bold"
        >
          <span>Novo Script</span>
          <span className="btn-icon-badge">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* LEFT PANE: SMART DISPATCHER */}
        <div
          className="double-bezel stagger-in xl:col-span-7"
          style={{ ["--stagger" as string]: 0 }}
        >
          <section className="double-bezel-core h-full p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-text)]">
                <Send className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)]">
                  Disparador WhatsApp + E-mail
                </h2>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Variáveis substituídas em tempo real com link rastreável da
                  proposta.
                </p>
              </div>
            </div>
            <span
              className={cn(
                "rounded-md px-2.5 py-1 text-[10px] font-semibold",
                activeEmailProviderLive
                  ? "badge-success"
                  : "bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-hairline)]"
              )}
            >
              {activeEmailProviderLabel}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="dispatch-lead-select"
                className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5"
              >
                Selecionar Lead
              </label>
              <select
                id="dispatch-lead-select"
                value={selectedLead?.id || ""}
                onChange={(e) => setSelectedLeadId(e.target.value)}
                className="input-field min-h-[44px] w-full rounded-lg px-3 py-2.5 text-xs font-medium"
              >
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.companyName} ({l.contactName} · {getStageLabel(l.stage)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="dispatch-template-select"
                className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5"
              >
                Template de Script
              </label>
              <select
                id="dispatch-template-select"
                value={selectedTemplate?.id || ""}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="input-field min-h-[44px] w-full rounded-lg px-3 py-2.5 text-xs font-medium"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedLead && (
            <div className="grid grid-cols-1 gap-3 rounded-xl bg-[var(--bg-subtle)] p-3.5 sm:grid-cols-12 sm:items-center">
              <div className="sm:col-span-7 space-y-0.5 text-xs">
                <p className="font-bold text-[var(--text-primary)]">
                  {selectedLead.contactName}{" "}
                  <span className="font-normal text-[var(--text-muted)]">
                    · {selectedLead.companyName}
                  </span>
                </p>
                <p className="font-mono-num text-[11px] text-[var(--text-secondary)]">
                  {selectedLead.phone} ·{" "}
                  {selectedLead.email || "Sem e-mail cadastrado"}
                </p>
              </div>
              <div className="sm:col-span-5">
                <label
                  htmlFor="dispatch-next-date"
                  className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1"
                >
                  {"{{proxima_data_livre}}"}
                </label>
                <div className="relative">
                  <Calendar
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]"
                    aria-hidden="true"
                  />
                  <input
                    id="dispatch-next-date"
                    type="text"
                    value={nextAvailableDate}
                    onChange={(e) => setNextAvailableDate(e.target.value)}
                    onBlur={() => onUpdateNextDate(nextAvailableDate)}
                    placeholder="Ex: 05/12/2026"
                    className="input-field min-h-[38px] w-full rounded-lg py-1.5 pl-8 pr-2.5 font-mono-num text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-12">
            <div className="sm:col-span-5">
              <label
                htmlFor="dispatch-email-to"
                className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5"
              >
                E-mail de Destino
              </label>
              <input
                id="dispatch-email-to"
                type="email"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                placeholder="email@empresa.com.br"
                className="input-field min-h-[42px] w-full rounded-lg px-3.5 py-2 text-xs font-medium"
              />
            </div>
            <div className="sm:col-span-7">
              <label
                htmlFor="dispatch-email-subject"
                className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5"
              >
                Assunto do E-mail
              </label>
              <input
                id="dispatch-email-subject"
                type="text"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                className="input-field min-h-[42px] w-full rounded-lg px-3.5 py-2 text-xs font-medium"
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="dispatch-message-body"
                className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]"
              >
                Mensagem Pronta (Editável antes do disparo)
              </label>
              <button
                type="button"
                onClick={handleCopyMessage}
                className="inline-flex min-h-[32px] items-center gap-1 text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--accent-text)]"
              >
                {copiedMsg ? (
                  <>
                    <Check
                      className="h-3 w-3 text-[var(--status-success)]"
                      aria-hidden="true"
                    />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" aria-hidden="true" />
                    Copiar Texto
                  </>
                )}
              </button>
            </div>
            <textarea
              id="dispatch-message-body"
              rows={9}
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="input-field w-full rounded-xl p-4 text-xs leading-relaxed"
            />
          </div>

          <div className="flex flex-col gap-3 pt-1 sm:flex-row">
            <button
              type="button"
              onClick={handleSendWhatsappSafe}
              disabled={!selectedLead}
              className="flex-1 inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-xs font-bold text-white hover:bg-emerald-500 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Enviar no WhatsApp (Modo Seguro)
            </button>

            <button
              type="button"
              onClick={handleSendEmail}
              disabled={!selectedLead || sendingEmail}
              className="btn-accent flex-1 inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg px-5 py-3 text-xs font-bold disabled:opacity-50"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              {sendingEmail
                ? "Enviando e-mail..."
                : integrationStatus.gmailLive
                ? "Enviar E-mail (Gmail SMTP)"
                : "Enviar E-mail (Resend API)"}
            </button>
          </div>

          {/* Batch Queue Anti-Ban */}
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers
                  className="h-4 w-4 text-[var(--accent-text)]"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="text-xs font-bold text-[var(--text-primary)]">
                    Disparo em Lote: Fila Anti-Ban (3 a 6 min)
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {integrationStatus.whatsappApiLive
                      ? `API ativa (${integrationStatus.whatsappProvider.toUpperCase()}): aplica intervalo aleatório entre 3 e 6 min.`
                      : "Fila persistida no banco. Configure Evolution/Z-API em Configurações para envio automático."}
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-surface-solid)] px-2.5 py-0.5 font-mono-num text-[10px] font-semibold text-[var(--text-secondary)]">
                <Clock
                  className="h-3 w-3 text-[var(--accent-text)]"
                  aria-hidden="true"
                />
                {batchLeadIds.length} selecionado(s)
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {leads
                .filter((l) => l.stage !== "fechado")
                .map((lead) => {
                  const selected = batchLeadIds.includes(lead.id);
                  return (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => toggleBatchLead(lead.id)}
                      aria-pressed={selected}
                      className={cn(
                        "min-h-[36px] rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors",
                        selected
                          ? "badge-success"
                          : "border-[var(--border-hairline)] bg-[var(--bg-surface-solid)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                      )}
                    >
                      {lead.companyName}
                    </button>
                  );
                })}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleEnqueueWhatsappBatch}
                disabled={enqueueingBatch || batchLeadIds.length === 0}
                className="btn-ghost inline-flex min-h-[42px] items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-45 bg-[var(--bg-surface-solid)]"
              >
                <Layers
                  className="h-3.5 w-3.5 text-[var(--status-success)]"
                  aria-hidden="true"
                />
                {enqueueingBatch
                  ? "Agendando na Fila..."
                  : `Enfileirar ${batchLeadIds.length || ""} Lead(s) (3 a 6 min)`}
              </button>
            </div>
          </div>
          </section>
        </div>

        {/* RIGHT PANE: SCRIPT LIBRARY */}
        <div
          className="double-bezel stagger-in xl:col-span-5"
          style={{ ["--stagger" as string]: 1 }}
        >
          <section className="double-bezel-core h-full p-6 flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--bg-subtle)] text-[var(--accent-text)]">
                  <BookOpen className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-[var(--text-primary)]">
                    Biblioteca de Scripts
                  </h2>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {templates.length} templates ativos por funil
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 rounded-lg bg-[var(--bg-subtle)] p-3">
              {TEMPLATE_VARIABLES.map((v) => (
                <span
                  key={v.token}
                  className="rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface-solid)] px-2 py-1 font-mono-num text-[10px] text-[var(--accent-text)]"
                >
                  {v.token}
                </span>
              ))}
            </div>

            <div className="divide-y divide-[var(--border-hairline)] border-t border-[var(--border-hairline)] flex-1 overflow-y-auto pr-1">
              {templates.map((tpl) => {
                const isSelected = selectedTemplate?.id === tpl.id;
                const isConfirmingDelete = deletingTemplateId === tpl.id;

                return (
                  <div
                    key={tpl.id}
                    className={cn(
                      "py-3.5 px-3 -mx-1 rounded-lg transition-colors",
                      isSelected
                        ? "bg-[var(--accent-soft)]"
                        : "hover:bg-[var(--bg-surface-hover)]"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedTemplateId(tpl.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-surface-solid)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                          <FileText
                            className="h-2.5 w-2.5 text-[var(--accent-text)]"
                            aria-hidden="true"
                          />
                          {getTemplateFunnelLabel(tpl.funnel)}
                        </span>
                        <h3 className="mt-1.5 text-xs font-bold text-[var(--text-primary)]">
                          {tpl.name}
                        </h3>
                        <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                          {tpl.body}
                        </p>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setEditingTemplate({
                              id: tpl.id,
                              name: tpl.name,
                              funnel: tpl.funnel,
                              channel: tpl.channel,
                              subject: tpl.subject,
                              body: tpl.body,
                            })
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-surface-solid)] hover:text-[var(--text-primary)]"
                          aria-label={`Editar script ${tpl.name}`}
                          title="Editar script"
                        >
                          <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeletingTemplateId(
                              isConfirmingDelete ? null : tpl.id
                            )
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--status-danger-bg)] hover:text-[var(--status-danger)]"
                          aria-label={`Excluir script ${tpl.name}`}
                          title="Excluir script"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    {isConfirmingDelete && (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg badge-danger p-2.5 text-[11px]">
                        <span className="font-semibold">
                          Remover este template?
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={async () => {
                              await onDeleteTemplate(tpl.id);
                              setDeletingTemplateId(null);
                            }}
                            className="rounded-md bg-[var(--status-danger)] px-2.5 py-1 font-bold text-white"
                          >
                            Confirmar
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingTemplateId(null)}
                            className="rounded-md border border-current px-2.5 py-1 font-semibold"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {/* Template Create/Edit Modal */}
      {editingTemplate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setEditingTemplate(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="template-modal-title"
        >
          <form
            onSubmit={handleSaveTemplateForm}
            onClick={(e) => e.stopPropagation()}
            className="modal-surface w-full max-w-2xl rounded-xl p-6 space-y-4 max-h-[92dvh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3
                id="template-modal-title"
                className="text-base font-bold text-[var(--text-primary)]"
              >
                {editingTemplate.id ? "Editar Script" : "Criar Novo Script"}
              </h3>
              <button
                type="button"
                onClick={() => setEditingTemplate(null)}
                className="btn-ghost flex h-10 w-10 items-center justify-center rounded-lg"
                aria-label="Fechar modal de script"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="tpl-name"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1"
                >
                  Nome do Template *
                </label>
                <input
                  id="tpl-name"
                  type="text"
                  required
                  value={editingTemplate.name}
                  onChange={(e) =>
                    setEditingTemplate({
                      ...editingTemplate,
                      name: e.target.value,
                    })
                  }
                  placeholder="Ex: Follow-up Pós-Proposta Aberta"
                  className="input-field min-h-[42px] w-full rounded-lg px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label
                  htmlFor="tpl-funnel"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1"
                >
                  Funil Associado
                </label>
                <select
                  id="tpl-funnel"
                  value={editingTemplate.funnel}
                  onChange={(e) =>
                    setEditingTemplate({
                      ...editingTemplate,
                      funnel: e.target.value as TemplateFunnelId,
                    })
                  }
                  className="input-field min-h-[42px] w-full rounded-lg px-3 py-2 text-xs"
                >
                  {FUNNELS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                  <option value="geral">Geral / Parcerias</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="tpl-subject"
                className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1"
              >
                Assunto do E-mail
              </label>
              <input
                id="tpl-subject"
                type="text"
                value={editingTemplate.subject}
                onChange={(e) =>
                  setEditingTemplate({
                    ...editingTemplate,
                    subject: e.target.value,
                  })
                }
                className="input-field min-h-[42px] w-full rounded-lg px-3 py-2 text-xs"
              />
            </div>

            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="tpl-body"
                  className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]"
                >
                  Corpo do Script *
                </label>
                <div className="flex flex-wrap gap-1">
                  {TEMPLATE_VARIABLES.map((v) => (
                    <button
                      key={v.token}
                      type="button"
                      onClick={() => insertVariableIntoEditor(v.token)}
                      className="badge-accent rounded-md px-2 py-1 font-mono-num text-[10px] font-semibold hover:opacity-85"
                    >
                      + {v.token}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                id="tpl-body"
                rows={8}
                required
                value={editingTemplate.body}
                onChange={(e) =>
                  setEditingTemplate({
                    ...editingTemplate,
                    body: e.target.value,
                  })
                }
                className="input-field w-full rounded-xl p-3.5 text-xs leading-relaxed"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingTemplate(null)}
                className="btn-ghost min-h-[42px] rounded-lg px-4 py-2 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingTemplate}
                className="btn-accent min-h-[42px] rounded-lg px-5 py-2 text-xs font-bold disabled:opacity-50"
              >
                {savingTemplate ? "Salvando..." : "Salvar Script"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
