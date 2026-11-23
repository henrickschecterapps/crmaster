"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
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
  Film,
  FolderKanban,
  Globe,
  Handshake,
  Instagram,
  KeyRound,
  Link2,
  Mail,
  MessageCircle,
  Plus,
  Save,
  Search,
  Send,
  Trash2,
  Video,
} from "lucide-react";
import {
  ClientDeliverable,
  ClientMeeting,
  DELIVERABLE_TYPES,
  DeliverableType,
  FUNNELS,
  IntegrationStatus,
  InteractionType,
  Lead,
  MEETING_TYPES,
  MeetingType,
  Partner,
  PARTNER_ROLES,
  PartnerRole,
  PaymentStatus,
  PostSaleChecklistItem,
  PRODUCTION_STAGES,
  ProductionStageId,
  STAGES,
  StageId,
  StudioSettings,
} from "@/types/crm";
import {
  buildPostSaleChecklist,
  buildWhatsappUrl,
  cn,
  formatCnpj,
  formatCpf,
  formatCurrency,
  formatCurrencyExact,
  formatDateBr,
  formatDateTimeBr,
  formatPhoneBr,
  generateId,
  getLeadStagnation,
} from "@/lib/utils";
import { BrandMark } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";

type AdminTab = "comercial" | "portal" | "financeiro" | "timeline";

interface ClientWorkspaceAdminProps {
  initialLead: Lead;
  initialPartners: Partner[];
  studioSettings: StudioSettings;
  integrationStatus: IntegrationStatus;
}

export function ClientWorkspaceAdmin({
  initialLead,
  initialPartners,
  studioSettings,
  integrationStatus,
}: ClientWorkspaceAdminProps) {
  const router = useRouter();
  const [lead, setLead] = useState<Lead>(initialLead);
  const [partners, setPartners] = useState<Partner[]>(initialPartners);
  const [activeTab, setActiveTab] = useState<AdminTab>("comercial");
  const [toast, setToast] = useState<{
    message: string;
    tone: "success" | "info" | "error";
  } | null>(null);

  // Commercial & Core Fields
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
  const [notes, setNotes] = useState(lead.notes);
  const [automacaoAtiva, setAutomacaoAtiva] = useState(lead.automacaoAtiva);
  const [respondeu, setRespondeu] = useState(lead.respondeu);

  // Finance & Contract Fields
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(
    lead.paymentStatus
  );
  const [partnerId, setPartnerId] = useState(lead.partnerId || "");
  const [commissionPaid, setCommissionPaid] = useState(lead.commissionPaid);
  const [eventDate, setEventDate] = useState(lead.eventDate || "");
  const [cnpj, setCnpj] = useState(lead.cnpj || "");
  const [cpf, setCpf] = useState(lead.cpf || "");
  const [razaoSocial, setRazaoSocial] = useState(lead.razaoSocial || "");
  const [checklist, setChecklist] = useState<PostSaleChecklistItem[]>(
    lead.postSaleChecklist ?? []
  );

  // Portal Mirror Fields
  const [portalPin, setPortalPin] = useState(lead.portalPin || "");
  const [productionStage, setProductionStage] = useState<ProductionStageId>(
    lead.productionStage || "pre_producao"
  );
  const [meetings, setMeetings] = useState<ClientMeeting[]>(
    lead.meetings ?? []
  );
  const [deliverables, setDeliverables] = useState<ClientDeliverable[]>(
    lead.deliverables ?? []
  );

  // Sub-forms
  const [newMeetingType, setNewMeetingType] =
    useState<MeetingType>("alinhamento");
  const [newMeetingTitle, setNewMeetingTitle] = useState("");
  const [newMeetingDate, setNewMeetingDate] = useState("");
  const [newMeetingTime, setNewMeetingTime] = useState("10:00");
  const [newMeetingFormat, setNewMeetingFormat] = useState<
    "online" | "presencial"
  >("online");
  const [newMeetingUrl, setNewMeetingUrl] = useState("");
  const [confirmUrlById, setConfirmUrlById] = useState<Record<string, string>>(
    {}
  );

  const [newDelivTitle, setNewDelivTitle] = useState("");
  const [newDelivType, setNewDelivType] =
    useState<DeliverableType>("galeria_fotos");
  const [newDelivUrl, setNewDelivUrl] = useState("");
  const [newDelivDesc, setNewDelivDesc] = useState("");

  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [copiedPortal, setCopiedPortal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Quick Partner Creator
  const [showNewPartner, setShowNewPartner] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState("");
  const [newPartnerRole, setNewPartnerRole] =
    useState<PartnerRole>("modelo_provador");
  const [newPartnerCompany, setNewPartnerCompany] = useState("");
  const [newPartnerPhone, setNewPartnerPhone] = useState("");

  const notify = (
    message: string,
    tone: "success" | "info" | "error" = "success"
  ) => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 3600);
  };

  const stagnation = getLeadStagnation(lead);
  const selectedPartner = partners.find((p) => p.id === partnerId) ?? null;
  const numericValue = Number(estimatedValue) || 0;
  const commissionValue = selectedPartner
    ? numericValue * (selectedPartner.commissionRate / 100)
    : 0;
  const signalValue = numericValue * 0.5;
  const pendingMeetingsCount = meetings.filter(
    (m) => m.status === "solicitada"
  ).length;
  const adjustmentDeliverablesCount = deliverables.filter(
    (d) => d.status === "ajuste_solicitado"
  ).length;

  const portalUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/portal/${lead.id}`
      : `/portal/${lead.id}`;

  const patchLead = async (
    patch: Partial<Lead>,
    interaction?: { type: InteractionType; title: string; description: string },
    touchLastInteraction?: boolean
  ): Promise<Lead | null> => {
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patch, interaction, touchLastInteraction }),
      });
      if (!res.ok) {
        notify("Erro ao salvar alterações no servidor.", "error");
        return null;
      }
      const json = (await res.json()) as { lead: Lead };
      setLead(json.lead);
      setMeetings(json.lead.meetings ?? []);
      setDeliverables(json.lead.deliverables ?? []);
      setChecklist(json.lead.postSaleChecklist ?? []);
      return json.lead;
    } catch {
      notify("Erro de conexão ao salvar.", "error");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanedPin = portalPin.replace(/\D/g, "").slice(0, 4);
    const updated = await patchLead({
      companyName: companyName.trim() || lead.companyName,
      contactName: contactName.trim() || lead.contactName,
      contactRole: contactRole.trim(),
      phone: phone.trim(),
      email: email.trim(),
      website: website.trim(),
      instagram: instagram.trim(),
      funnel,
      stage,
      estimatedValue: numericValue,
      origin: origin.trim(),
      paymentStatus,
      partnerId: partnerId || null,
      commissionPaid,
      eventDate: eventDate.trim(),
      cnpj: cnpj.trim(),
      cpf: cpf.trim(),
      razaoSocial: razaoSocial.trim(),
      notes: notes.trim(),
      automacaoAtiva,
      respondeu,
      postSaleChecklist: checklist,
      portalPin: cleanedPin.length === 4 ? cleanedPin : null,
      productionStage,
    });
    if (updated) {
      setPortalPin(cleanedPin.length === 4 ? cleanedPin : "");
      notify("Workspace do cliente atualizado com sucesso.", "success");
    }
  };

  const handleQuickStageChange = async (nextStage: StageId) => {
    setStage(nextStage);
    const stageLabel =
      STAGES.find((s) => s.id === nextStage)?.label ?? nextStage;
    const nextChecklist =
      nextStage === "fechado" && checklist.length === 0
        ? buildPostSaleChecklist(funnel)
        : checklist;
    const updated = await patchLead(
      {
        stage: nextStage,
        postSaleChecklist: nextChecklist,
      },
      {
        type: "etapa",
        title: `Etapa alterada para ${stageLabel}`,
        description: "Atualização rápida na página do cliente.",
      },
      true
    );
    if (updated) {
      notify(`Lead movido para ${stageLabel}.`, "info");
    }
  };

  const handleProductionStageChange = async (nextProd: ProductionStageId) => {
    setProductionStage(nextProd);
    const label =
      PRODUCTION_STAGES.find((p) => p.id === nextProd)?.label ?? nextProd;
    const updated = await patchLead(
      { productionStage: nextProd },
      {
        type: "sistema",
        title: `Cronograma de produção: ${label}`,
        description: "Status sincronizado automaticamente no Portal do Cliente.",
      }
    );
    if (updated) {
      notify(`Cronograma atualizado para ${label}.`, "success");
    }
  };

  const handleCopyPortalLink = async () => {
    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopiedPortal(true);
      notify("Link exclusivo do Portal do Cliente copiado.", "success");
      setTimeout(() => setCopiedPortal(false), 2000);
    } catch {
      notify("Não foi possível copiar o link.", "error");
    }
  };

  const handleSendPortalEmail = async () => {
    if (!email.trim()) {
      notify("Cadastre o e-mail do cliente antes de enviar o portal.", "error");
      return;
    }
    setSendingEmail(true);
    try {
      const pinNote = portalPin.trim()
        ? `\nCódigo PIN de acesso: ${portalPin.trim()}`
        : "";
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          to: email.trim(),
          subject: `Portal Exclusivo do Projeto | ${studioSettings.studioName} x ${companyName}`,
          body: `Olá ${contactName},\n\nPreparamos o Portal Exclusivo da ${companyName} na ${studioSettings.studioName}.\n\nPor lá você acompanha a proposta comercial, contrato PDF, agendamento de reuniões, briefing e entregas em 4K:\n${portalUrl}${pinNote}\n\nQualquer dúvida, estou à disposição no WhatsApp.`,
        }),
      });
      if (res.ok) {
        notify("Convite do Portal enviado por e-mail.", "success");
      } else {
        notify("Falha ao enviar e-mail. Verifique as credenciais SMTP/Resend.", "error");
      }
    } finally {
      setSendingEmail(false);
    }
  };

  const handleEnrich = async () => {
    if (!website.trim()) {
      notify("Informe o site da empresa para enriquecer os contatos.", "info");
      return;
    }
    setEnriching(true);
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: website.trim() }),
      });
      const data = await res.json();
      if (data.email && !email) setEmail(data.email);
      if (data.instagram && !instagram) setInstagram(data.instagram);
      notify(
        data.email || data.instagram
          ? "Dados públicos encontrados e preenchidos."
          : "Nenhum e-mail ou Instagram público detectado neste domínio.",
        "info"
      );
    } finally {
      setEnriching(false);
    }
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMeetingDate || !newMeetingTime) {
      notify("Informe data e horário da reunião.", "error");
      return;
    }
    const typeLabel =
      MEETING_TYPES.find((m) => m.id === newMeetingType)?.label || "Reunião";
    const created: ClientMeeting = {
      id: generateId("meet"),
      type: newMeetingType,
      title: newMeetingTitle.trim() || typeLabel,
      date: newMeetingDate,
      time: newMeetingTime,
      format: newMeetingFormat,
      locationOrUrl: newMeetingUrl.trim(),
      status: "confirmada",
      requestedBy: "admin",
      createdAt: new Date().toISOString(),
    };
    const nextMeetings = [created, ...meetings];
    const updated = await patchLead(
      { meetings: nextMeetings },
      {
        type: "reuniao",
        title: `Reunião agendada: ${created.title}`,
        description: `${created.date} às ${created.time} (${created.format}) ${created.locationOrUrl || ""}`.trim(),
      },
      true
    );
    if (updated) {
      setNewMeetingTitle("");
      setNewMeetingDate("");
      setNewMeetingUrl("");
      notify("Reunião publicada no Portal do Cliente.", "success");
    }
  };

  const handleUpdateMeetingStatus = async (
    meetingId: string,
    nextStatus: ClientMeeting["status"]
  ) => {
    const locationOverride = confirmUrlById[meetingId];
    const nextMeetings = meetings.map((m) =>
      m.id === meetingId
        ? {
            ...m,
            status: nextStatus,
            locationOrUrl:
              locationOverride !== undefined
                ? locationOverride.trim()
                : m.locationOrUrl,
          }
        : m
    );
    const target = nextMeetings.find((m) => m.id === meetingId);
    const updated = await patchLead(
      { meetings: nextMeetings },
      {
        type: "reuniao",
        title: `Reunião ${nextStatus}: ${target?.title || ""}`,
        description: target?.locationOrUrl
          ? `Link/Local: ${target.locationOrUrl}`
          : "Status atualizado no Portal do Cliente.",
      }
    );
    if (updated) {
      notify(`Reunião marcada como ${nextStatus}.`, "success");
    }
  };

  const handleAddDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDelivTitle.trim() || !newDelivUrl.trim()) {
      notify("Informe o título e o link (Drive, Frame.io, Vimeo) do material.", "error");
      return;
    }
    const now = new Date().toISOString();
    const created: ClientDeliverable = {
      id: generateId("deliv"),
      title: newDelivTitle.trim(),
      type: newDelivType,
      url: newDelivUrl.trim(),
      description: newDelivDesc.trim(),
      status: "pronto_aprovacao",
      createdAt: now,
      updatedAt: now,
    };
    const nextDeliverables = [created, ...deliverables];
    const updated = await patchLead(
      { deliverables: nextDeliverables },
      {
        type: "entrega",
        title: `Entrega publicada no Portal: ${created.title}`,
        description: created.url,
      },
      true
    );
    if (updated) {
      setNewDelivTitle("");
      setNewDelivUrl("");
      setNewDelivDesc("");
      notify("Material publicado na Central de Entregas do Cliente.", "success");
    }
  };

  const handleDeleteDeliverable = async (deliverableId: string) => {
    const nextDeliverables = deliverables.filter((d) => d.id !== deliverableId);
    const updated = await patchLead({ deliverables: nextDeliverables });
    if (updated) {
      notify("Material removido do portal.", "info");
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    const updated = await patchLead(
      {},
      {
        type: "nota",
        title: "Nota interna da equipe comercial",
        description: newNote.trim(),
      },
      true
    );
    if (updated) {
      setNewNote("");
      notify("Nota registrada na timeline.", "success");
    }
  };

  const handleCreateQuickPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartnerName.trim()) return;
    const res = await fetch("/api/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newPartnerName.trim(),
        role: newPartnerRole,
        company: newPartnerCompany.trim() || "Parceiro ÚLTIMO QUADRO",
        phone: newPartnerPhone.trim(),
        commissionRate: 15,
      }),
    });
    if (res.ok) {
      const json = (await res.json()) as { partner: Partner };
      setPartners((prev) => [...prev, json.partner]);
      setPartnerId(json.partner.id);
      setShowNewPartner(false);
      setNewPartnerName("");
      setNewPartnerCompany("");
      setNewPartnerPhone("");
      notify("Parceiro criado e vinculado (15%).", "success");
    }
  };

  const handleDeleteLead = async () => {
    const res = await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/");
    } else {
      notify("Erro ao excluir cliente.", "error");
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <div className="cinema-grain" aria-hidden="true" />

      {/* Top Sticky Studio Context Bar */}
      <header className="glass-bar sticky top-0 z-30 border-b border-[var(--border-hairline)]">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="btn-ghost inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Pipeline</span>
            </Link>
            <div className="hidden md:block h-5 w-px bg-[var(--border-hairline)]" />
            <div className="hidden md:block">
              <BrandMark compact />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm sm:text-base font-bold tracking-tight text-[var(--text-primary)]">
                  {companyName}
                </h1>
                <span className="badge-accent hidden sm:inline-flex rounded-md px-2 py-0.5 font-mono-num text-[10px] font-bold uppercase">
                  VISÃO ADMIN
                </span>
              </div>
              <p className="truncate text-[11px] text-[var(--text-muted)] font-mono-num">
                {contactName} · {formatCurrency(numericValue)} ·{" "}
                {lead.visualizacoesProposta} acesso(s) ao portal
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyPortalLink}
              className="btn-ghost inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
            >
              {copiedPortal ? (
                <Check className="h-3.5 w-3.5 text-[var(--status-success)]" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>{copiedPortal ? "Link Copiado" : "Link do Portal"}</span>
            </button>

            <Link
              href={`/portal/${lead.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--accent-text)] border-[var(--accent-border)]"
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Ver como Cliente</span>
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </Link>

            <button
              type="button"
              onClick={() => handleSaveAll()}
              disabled={saving}
              className="btn-accent inline-flex min-h-[38px] items-center gap-2 rounded-lg pl-4 pr-1.5 py-1 text-xs font-bold disabled:opacity-60"
            >
              <span>{saving ? "Salvando..." : "Salvar"}</span>
              <span className="btn-icon-badge">
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </button>

            <ThemeToggle />
          </div>
        </div>

        {/* Pipeline Stage Stepper Strip */}
        <div className="border-t border-[var(--border-hairline)] bg-[var(--bg-subtle)]/70">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 overflow-x-auto px-4 py-2 sm:px-6">
            <div className="flex items-center gap-1.5">
              <span className="font-mono-num text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mr-1">
                ETAPA COMERCIAL:
              </span>
              {STAGES.map((s) => {
                const active = stage === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleQuickStageChange(s.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors",
                      active
                        ? "bg-[var(--accent-btn)] text-[var(--accent-fg)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        active ? "bg-current" : s.accentClass
                      )}
                    />
                    {s.shortLabel}
                  </button>
                );
              })}
            </div>

            {stagnation.level !== "none" && (
              <span className="badge-warning inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                {stagnation.label}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 space-y-6">
        {/* Toast Banner */}
        {toast && (
          <div
            role="status"
            className={cn(
              "rounded-xl px-4 py-3 text-xs font-semibold flex items-center justify-between",
              toast.tone === "success" && "badge-success",
              toast.tone === "info" && "badge-info",
              toast.tone === "error" && "badge-danger"
            )}
          >
            <span>{toast.message}</span>
          </div>
        )}

        {/* Quick KPI Strip (Double-Bezel + Hairline Dividers) */}
        <div className="double-bezel stagger-in">
          <div className="double-bezel-core grid grid-cols-2 divide-y divide-[var(--border-hairline)] lg:grid-cols-4 lg:divide-y-0 lg:divide-x">
            <div className="p-4">
              <p className="text-[10px] font-mono-num uppercase tracking-wider text-[var(--text-muted)]">
                Valor do Projeto
              </p>
              <p className="mt-1 text-xl font-bold font-mono-num text-[var(--text-primary)]">
                {formatCurrency(numericValue)}
              </p>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Sinal 50%: {formatCurrency(signalValue)}
              </p>
            </div>
            <div className="p-4">
              <p className="text-[10px] font-mono-num uppercase tracking-wider text-[var(--text-muted)]">
                Status do Portal
              </p>
              <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">
                {lead.propostaAprovadaEm
                  ? "Escopo Aprovado"
                  : "Proposta em Aberto"}
              </p>
              <p className="text-[11px] text-[var(--text-secondary)] font-mono-num">
                {portalPin.length === 4 ? `PIN Ativo (${portalPin})` : "Sem PIN (Link Direto)"}
              </p>
            </div>
            <div className="p-4">
              <p className="text-[10px] font-mono-num uppercase tracking-wider text-[var(--text-muted)]">
                Reuniões &amp; Entregas
              </p>
              <p className="mt-1 text-sm font-bold text-[var(--text-primary)] font-mono-num">
                {meetings.length} reunião(ões) · {deliverables.length} entrega(s)
              </p>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {pendingMeetingsCount > 0
                  ? `${pendingMeetingsCount} aguardando sua confirmação`
                  : adjustmentDeliverablesCount > 0
                  ? `${adjustmentDeliverablesCount} ajuste(s) solicitado(s)`
                  : "Tudo em dia no portal"}
              </p>
            </div>
            <div className="p-4 flex flex-wrap items-center gap-2">
              {phone && (
                <a
                  href={buildWhatsappUrl(
                    phone,
                    `Olá ${contactName}! Segue o link do Portal Exclusivo da ${companyName} na ${studioSettings.studioName}: ${portalUrl}`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-accent inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold"
                >
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  WhatsApp
                </a>
              )}
              <button
                type="button"
                onClick={handleSendPortalEmail}
                disabled={sendingEmail || !email.trim()}
                className="btn-ghost inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                {sendingEmail ? "Enviando..." : "E-mail Portal"}
              </button>
            </div>
          </div>
        </div>

        {/* Workspace Navigation Dock */}
        <div className="dock-shell inline-flex flex-wrap gap-1">
          {(
            [
              { id: "comercial", label: "01. Comercial & Vendas", icon: Search },
              {
                id: "portal",
                label: "02. Escopo, Reuniões & Entregas",
                icon: FolderKanban,
                badge: pendingMeetingsCount + adjustmentDeliverablesCount,
              },
              {
                id: "financeiro",
                label: "03. Financeiro & Contrato",
                icon: CreditCard,
              },
              {
                id: "timeline",
                label: `04. Timeline & Radar (${lead.interactions.length})`,
                icon: Clock,
              },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "inline-flex min-h-[40px] items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors",
                  active
                    ? "bg-[var(--bg-surface-solid)] text-[var(--text-primary)] shadow-sm border border-[var(--border-hairline)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
              >
                <Icon className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                <span>{tab.label}</span>
                {"badge" in tab && tab.badge > 0 && (
                  <span className="badge-warning rounded-full px-1.5 py-0.5 font-mono-num text-[10px] font-bold">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* TAB 1: COMERCIAL & VENDAS */}
        {activeTab === "comercial" && (
          <form
            onSubmit={handleSaveAll}
            className="grid grid-cols-1 gap-5 xl:grid-cols-12"
          >
            <div className="double-bezel stagger-in xl:col-span-8">
              <div className="double-bezel-core p-6 space-y-5">
                <h2 className="text-sm font-bold text-[var(--text-primary)]">
                  Dados Comerciais &amp; Contato do Decisor
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                      Empresa / Marca
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="input-field min-h-[42px] w-full rounded-lg px-3.5 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                      Vertical de Serviço
                    </label>
                    <select
                      value={funnel}
                      onChange={(e) => setFunnel(e.target.value as Lead["funnel"])}
                      className="input-field min-h-[42px] w-full rounded-lg px-3.5 py-2 text-xs"
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
                      Nome do Contato
                    </label>
                    <input
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      className="input-field min-h-[42px] w-full rounded-lg px-3.5 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                      Cargo / Função
                    </label>
                    <input
                      type="text"
                      value={contactRole}
                      onChange={(e) => setContactRole(e.target.value)}
                      placeholder="Ex.: Diretora de Marketing / RH"
                      className="input-field min-h-[42px] w-full rounded-lg px-3.5 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                      WhatsApp / Telefone
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(formatPhoneBr(e.target.value))}
                      className="input-field min-h-[42px] w-full rounded-lg px-3.5 py-2 font-mono-num text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                      E-mail
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input-field min-h-[42px] w-full rounded-lg px-3.5 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                      Website (Enriquecimento)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="https://empresa.com.br"
                        className="input-field min-h-[42px] flex-1 rounded-lg px-3.5 py-2 text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleEnrich}
                        disabled={enriching}
                        className="btn-ghost rounded-lg px-3 text-xs font-semibold"
                        title="Buscar e-mail e Instagram no site"
                      >
                        <Globe className="h-3.5 w-3.5" />
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
                        placeholder="@perfil"
                        className="input-field min-h-[42px] w-full rounded-lg pl-9 pr-3.5 py-2 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                    Notas Internas de Negociação (Privadas, invisíveis ao cliente)
                  </label>
                  <textarea
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Objeções, margem de desconto, decisor financeiro, histórico da conversa..."
                    className="input-field w-full rounded-lg px-3.5 py-2.5 text-xs leading-relaxed"
                  />
                </div>
              </div>
            </div>

            <div className="double-bezel stagger-in xl:col-span-4">
              <div className="double-bezel-core h-full p-6 flex flex-col justify-between space-y-5">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-[var(--accent-text)]" />
                    <h2 className="text-sm font-bold text-[var(--text-primary)]">
                      Régua de Follow-up &amp; Origem
                    </h2>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                      Origem do Lead
                    </label>
                    <input
                      type="text"
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value)}
                      className="input-field min-h-[42px] w-full rounded-lg px-3.5 py-2 text-xs"
                    />
                  </div>

                  <div className="divide-y divide-[var(--border-hairline)] border-t border-b border-[var(--border-hairline)]">
                    <label className="flex items-center justify-between py-3 text-xs cursor-pointer">
                      <span>Automação Dia 2 / Dia 5 ativa</span>
                      <input
                        type="checkbox"
                        checked={automacaoAtiva}
                        onChange={(e) => setAutomacaoAtiva(e.target.checked)}
                        className="h-4 w-4 accent-[var(--accent)]"
                      />
                    </label>
                    <label className="flex items-center justify-between py-3 text-xs cursor-pointer">
                      <span>Cliente já respondeu</span>
                      <input
                        type="checkbox"
                        checked={respondeu}
                        onChange={(e) => setRespondeu(e.target.checked)}
                        className="h-4 w-4 accent-[var(--accent)]"
                      />
                    </label>
                  </div>
                </div>

                <div className="border-t border-[var(--border-hairline)] pt-4 space-y-2">
                  {!confirmDelete ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="btn-ghost w-full min-h-[40px] inline-flex items-center justify-center gap-2 rounded-lg text-xs font-semibold text-[var(--status-danger)]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Excluir Cliente do CRM
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[11px] text-[var(--status-danger)] font-semibold text-center">
                        Confirmar exclusão permanente?
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(false)}
                          className="btn-ghost min-h-[38px] rounded-lg text-xs font-semibold"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteLead}
                          className="badge-danger min-h-[38px] rounded-lg text-xs font-bold"
                        >
                          Sim, Excluir
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </form>
        )}

        {/* TAB 2: ESCOPO, REUNIÕES & ENTREGAS (ESPELHO DO PORTAL) */}
        {activeTab === "portal" && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            {/* Production Timeline + Portal PIN */}
            <div className="double-bezel stagger-in xl:col-span-12">
              <div className="double-bezel-core p-6 space-y-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-2.5">
                    <Film className="h-4 w-4 text-[var(--accent-text)]" />
                    <div>
                      <h2 className="text-sm font-bold text-[var(--text-primary)]">
                        Cronograma de Produção (Visível no Portal do Cliente)
                      </h2>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Selecione a fase atual para atualizar a linha do tempo na tela do cliente.
                      </p>
                    </div>
                  </div>

                  {/* PIN Configuration */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        value={portalPin}
                        onChange={(e) =>
                          setPortalPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                        }
                        placeholder="PIN 4 dígitos (opcional)"
                        className="input-field min-h-[38px] w-48 rounded-lg pl-8 pr-3 font-mono-num text-xs"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSaveAll()}
                      className="btn-ghost min-h-[38px] rounded-lg px-3 text-xs font-semibold"
                    >
                      Aplicar PIN
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
                  {PRODUCTION_STAGES.map((ps, idx) => {
                    const active = productionStage === ps.id;
                    return (
                      <button
                        key={ps.id}
                        type="button"
                        onClick={() => handleProductionStageChange(ps.id)}
                        className={cn(
                          "rounded-lg border p-3 text-left transition-colors",
                          active
                            ? "border-[var(--accent-border)] bg-[var(--accent-soft)]"
                            : "border-[var(--border-hairline)] hover:bg-[var(--bg-surface-hover)]"
                        )}
                      >
                        <p className="font-mono-num text-[10px] font-bold text-[var(--accent-text)]">
                          0{idx + 1}
                        </p>
                        <p className="mt-0.5 text-xs font-bold text-[var(--text-primary)]">
                          {ps.shortLabel}
                        </p>
                        <p className="mt-1 text-[11px] text-[var(--text-muted)] line-clamp-2">
                          {ps.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Meetings Manager */}
            <div className="double-bezel stagger-in xl:col-span-6">
              <div className="double-bezel-core h-full p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-[var(--accent-text)]" />
                    <h2 className="text-sm font-bold text-[var(--text-primary)]">
                      Agenda de Reuniões do Projeto
                    </h2>
                  </div>
                  <span className="font-mono-num text-[11px] text-[var(--text-muted)]">
                    {meetings.length} registrada(s)
                  </span>
                </div>

                <form
                  onSubmit={handleCreateMeeting}
                  className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 border-b border-[var(--border-hairline)] pb-5"
                >
                  <select
                    value={newMeetingType}
                    onChange={(e) =>
                      setNewMeetingType(e.target.value as MeetingType)
                    }
                    className="input-field min-h-[40px] rounded-lg px-3 text-xs"
                  >
                    {MEETING_TYPES.map((mt) => (
                      <option key={mt.id} value={mt.id}>
                        {mt.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={newMeetingTitle}
                    onChange={(e) => setNewMeetingTitle(e.target.value)}
                    placeholder="Título personalizado (opcional)"
                    className="input-field min-h-[40px] rounded-lg px-3 text-xs"
                  />
                  <input
                    type="date"
                    value={newMeetingDate}
                    onChange={(e) => setNewMeetingDate(e.target.value)}
                    className="input-field min-h-[40px] rounded-lg px-3 font-mono-num text-xs"
                  />
                  <div className="flex gap-2">
                    <input
                      type="time"
                      value={newMeetingTime}
                      onChange={(e) => setNewMeetingTime(e.target.value)}
                      className="input-field min-h-[40px] w-28 rounded-lg px-3 font-mono-num text-xs"
                    />
                    <select
                      value={newMeetingFormat}
                      onChange={(e) =>
                        setNewMeetingFormat(
                          e.target.value as "online" | "presencial"
                        )
                      }
                      className="input-field min-h-[40px] flex-1 rounded-lg px-3 text-xs"
                    >
                      <option value="online">Online (Meet)</option>
                      <option value="presencial">Presencial</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    value={newMeetingUrl}
                    onChange={(e) => setNewMeetingUrl(e.target.value)}
                    placeholder="Link do Google Meet ou endereço presencial"
                    className="input-field min-h-[40px] sm:col-span-2 rounded-lg px-3 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-accent sm:col-span-2 min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agendar Reunião no Portal
                  </button>
                </form>

                {meetings.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)] py-4 text-center">
                    Nenhuma reunião solicitada ou agendada ainda.
                  </p>
                ) : (
                  <div className="divide-y divide-[var(--border-hairline)]">
                    {meetings.map((m) => (
                      <div key={m.id} className="py-3.5 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-[var(--text-primary)]">
                            {m.title}
                          </span>
                          <span
                            className={cn(
                              "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase",
                              m.status === "solicitada" && "badge-warning",
                              m.status === "confirmada" && "badge-success",
                              m.status === "realizada" && "badge-info",
                              m.status === "cancelada" && "badge-danger"
                            )}
                          >
                            {m.status}
                          </span>
                        </div>
                        <p className="font-mono-num text-[11px] text-[var(--text-secondary)]">
                          {formatDateBr(m.date)} às {m.time} ·{" "}
                          {m.format === "online" ? "Online" : "Presencial"} ·
                          Origem: {m.requestedBy}
                        </p>
                        {m.notes && (
                          <p className="text-[11px] text-[var(--text-muted)]">
                            Pauta: {m.notes}
                          </p>
                        )}
                        {m.status === "solicitada" && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            <input
                              type="text"
                              value={confirmUrlById[m.id] ?? m.locationOrUrl ?? ""}
                              onChange={(e) =>
                                setConfirmUrlById((prev) => ({
                                  ...prev,
                                  [m.id]: e.target.value,
                                }))
                              }
                              placeholder="Cole o link do Google Meet ou local..."
                              className="input-field min-h-[34px] flex-1 rounded-lg px-2.5 text-[11px]"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateMeetingStatus(m.id, "confirmada")
                              }
                              className="btn-accent rounded-lg px-3 py-1 text-[11px] font-bold"
                            >
                              Confirmar
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateMeetingStatus(m.id, "cancelada")
                              }
                              className="btn-ghost rounded-lg px-2.5 py-1 text-[11px] text-[var(--status-danger)]"
                            >
                              Recusar
                            </button>
                          </div>
                        )}
                        {m.status === "confirmada" && (
                          <div className="flex items-center justify-between gap-2 pt-1">
                            <span className="truncate text-[11px] text-[var(--accent-text)]">
                              {m.locationOrUrl || "Link/local não informado"}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateMeetingStatus(m.id, "realizada")
                              }
                              className="btn-ghost rounded-lg px-2.5 py-1 text-[11px] font-semibold"
                            >
                              Marcar Realizada
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Deliverables Manager */}
            <div className="double-bezel stagger-in xl:col-span-6">
              <div className="double-bezel-core h-full p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-[var(--accent-text)]" />
                    <h2 className="text-sm font-bold text-[var(--text-primary)]">
                      Central de Entregas 4K &amp; Links
                    </h2>
                  </div>
                  <span className="font-mono-num text-[11px] text-[var(--text-muted)]">
                    {deliverables.length} link(s)
                  </span>
                </div>

                <form
                  onSubmit={handleAddDeliverable}
                  className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 border-b border-[var(--border-hairline)] pb-5"
                >
                  <input
                    type="text"
                    value={newDelivTitle}
                    onChange={(e) => setNewDelivTitle(e.target.value)}
                    placeholder="Ex.: Galeria Final Tratada (280 fotos)"
                    className="input-field min-h-[40px] rounded-lg px-3 text-xs"
                  />
                  <select
                    value={newDelivType}
                    onChange={(e) =>
                      setNewDelivType(e.target.value as DeliverableType)
                    }
                    className="input-field min-h-[40px] rounded-lg px-3 text-xs"
                  >
                    {DELIVERABLE_TYPES.map((dt) => (
                      <option key={dt.id} value={dt.id}>
                        {dt.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="url"
                    value={newDelivUrl}
                    onChange={(e) => setNewDelivUrl(e.target.value)}
                    placeholder="https://drive.google.com/... ou Frame.io / Vimeo"
                    className="input-field min-h-[40px] sm:col-span-2 rounded-lg px-3 font-mono-num text-xs"
                  />
                  <input
                    type="text"
                    value={newDelivDesc}
                    onChange={(e) => setNewDelivDesc(e.target.value)}
                    placeholder="Observação técnica (ex.: Senha da galeria, formato 4K)"
                    className="input-field min-h-[40px] sm:col-span-2 rounded-lg px-3 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-accent sm:col-span-2 min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Publicar Entrega para o Cliente
                  </button>
                </form>

                {deliverables.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)] py-4 text-center">
                    Nenhuma entrega publicada ainda.
                  </p>
                ) : (
                  <div className="divide-y divide-[var(--border-hairline)]">
                    {deliverables.map((d) => (
                      <div key={d.id} className="py-3.5 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <a
                            href={d.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-[var(--text-primary)] hover:text-[var(--accent-text)] inline-flex items-center gap-1.5"
                          >
                            {d.title}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase",
                                d.status === "aprovado" && "badge-success",
                                d.status === "ajuste_solicitado" && "badge-danger",
                                d.status === "pronto_aprovacao" && "badge-warning",
                                d.status === "em_producao" && "badge-info"
                              )}
                            >
                              {d.status.replace("_", " ")}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteDeliverable(d.id)}
                              className="text-[var(--text-muted)] hover:text-[var(--status-danger)]"
                              aria-label="Remover entrega"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        {d.description && (
                          <p className="text-[11px] text-[var(--text-secondary)]">
                            {d.description}
                          </p>
                        )}
                        {d.clientFeedback && (
                          <p className="rounded-md bg-[var(--bg-subtle)] px-2.5 py-1.5 text-[11px] text-[var(--text-primary)]">
                            <strong>Retorno do cliente:</strong> {d.clientFeedback}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Client Briefing Readout */}
            <div className="double-bezel stagger-in xl:col-span-12">
              <div className="double-bezel-core p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-[var(--accent-text)]" />
                    <h2 className="text-sm font-bold text-[var(--text-primary)]">
                      Briefing &amp; Referências Enviadas pelo Cliente
                    </h2>
                  </div>
                  {lead.briefing?.updatedAt && (
                    <span className="font-mono-num text-[11px] text-[var(--text-muted)]">
                      Atualizado em {formatDateTimeBr(lead.briefing.updatedAt)}
                    </span>
                  )}
                </div>

                {!lead.briefing ? (
                  <p className="text-xs text-[var(--text-muted)]">
                    O cliente ainda não preencheu o formulário de briefing no Portal.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 border-t border-[var(--border-hairline)] pt-4 text-xs">
                    <div>
                      <p className="text-[10px] font-mono-num uppercase text-[var(--text-muted)]">
                        Local &amp; Acesso
                      </p>
                      <p className="mt-1 font-semibold text-[var(--text-primary)]">
                        {lead.briefing.venueAddress || "Não informado"}
                      </p>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        Horário de acesso: {lead.briefing.accessTime || "A definir"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-mono-num uppercase text-[var(--text-muted)]">
                        Responsável no Local
                      </p>
                      <p className="mt-1 font-semibold text-[var(--text-primary)]">
                        {lead.briefing.onSiteContactName || "Não informado"}
                      </p>
                      <p className="font-mono-num text-[11px] text-[var(--text-secondary)]">
                        {lead.briefing.onSiteContactPhone || "Sem telefone"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-mono-num uppercase text-[var(--text-muted)]">
                        Referências &amp; Observações
                      </p>
                      <p className="mt-1 text-[var(--text-secondary)] whitespace-pre-line">
                        {lead.briefing.referencesLinks || "Sem links"}
                      </p>
                      {lead.briefing.dressCodeOrNotes && (
                        <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                          {lead.briefing.dressCodeOrNotes}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: FINANCEIRO & CONTRATO */}
        {activeTab === "financeiro" && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            <div className="double-bezel stagger-in xl:col-span-7">
              <div className="double-bezel-core p-6 space-y-5">
                <h2 className="text-sm font-bold text-[var(--text-primary)]">
                  Financeiro, Dados Fiscais &amp; Parceria (15%)
                </h2>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                      Valor Total (R$)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      value={estimatedValue}
                      onChange={(e) => setEstimatedValue(e.target.value)}
                      className="input-field min-h-[42px] w-full rounded-lg px-3.5 py-2 font-mono-num text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                      Status de Pagamento
                    </label>
                    <select
                      value={paymentStatus}
                      onChange={(e) =>
                        setPaymentStatus(e.target.value as PaymentStatus)
                      }
                      className="input-field min-h-[42px] w-full rounded-lg px-3.5 py-2 text-xs"
                    >
                      <option value="pendente">Pendente</option>
                      <option value="sinal_pago">Sinal 50% Pago</option>
                      <option value="quitado">Quitado 100%</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                      Data do Evento / Diária
                    </label>
                    <input
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="input-field min-h-[42px] w-full rounded-lg px-3.5 py-2 font-mono-num text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                      Razão Social / Nome Completo
                    </label>
                    <input
                      type="text"
                      value={razaoSocial}
                      onChange={(e) => setRazaoSocial(e.target.value)}
                      className="input-field min-h-[42px] w-full rounded-lg px-3.5 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                      CNPJ
                    </label>
                    <input
                      type="text"
                      value={cnpj}
                      onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                      className="input-field min-h-[42px] w-full rounded-lg px-3.5 py-2 font-mono-num text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                      CPF
                    </label>
                    <input
                      type="text"
                      value={cpf}
                      onChange={(e) => setCpf(formatCpf(e.target.value))}
                      className="input-field min-h-[42px] w-full rounded-lg px-3.5 py-2 font-mono-num text-xs"
                    />
                  </div>
                </div>

                {/* Partner & Commission */}
                <div className="border-t border-[var(--border-hairline)] pt-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Handshake className="h-4 w-4 text-[var(--accent-text)]" />
                      <h3 className="text-xs font-bold text-[var(--text-primary)]">
                        Parceiro Indicador (Comissão 15%)
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowNewPartner((p) => !p)}
                      className="text-[11px] font-semibold text-[var(--accent-text)] hover:underline"
                    >
                      {showNewPartner ? "Cancelar" : "+ Novo Parceiro"}
                    </button>
                  </div>

                  {showNewPartner && (
                    <form
                      onSubmit={handleCreateQuickPartner}
                      className="grid grid-cols-1 gap-2 sm:grid-cols-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-3"
                    >
                      <input
                        type="text"
                        required
                        value={newPartnerName}
                        onChange={(e) => setNewPartnerName(e.target.value)}
                        placeholder="Nome do parceiro"
                        className="input-field min-h-[36px] rounded-md px-2.5 text-xs"
                      />
                      <select
                        value={newPartnerRole}
                        onChange={(e) =>
                          setNewPartnerRole(e.target.value as PartnerRole)
                        }
                        className="input-field min-h-[36px] rounded-md px-2.5 text-xs"
                      >
                        {(
                          Object.entries(PARTNER_ROLES) as Array<
                            [PartnerRole, string]
                          >
                        ).map(([roleId, roleLabel]) => (
                          <option key={roleId} value={roleId}>
                            {roleLabel}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={newPartnerCompany}
                        onChange={(e) => setNewPartnerCompany(e.target.value)}
                        placeholder="Empresa / Espaço"
                        className="input-field min-h-[36px] rounded-md px-2.5 text-xs"
                      />
                      <button
                        type="submit"
                        className="btn-accent min-h-[36px] rounded-md text-xs font-bold"
                      >
                        Criar &amp; Vincular
                      </button>
                    </form>
                  )}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 items-center">
                    <select
                      value={partnerId}
                      onChange={(e) => setPartnerId(e.target.value)}
                      className="input-field min-h-[42px] w-full rounded-lg px-3.5 py-2 text-xs"
                    >
                      <option value="">Sem parceiro indicador</option>
                      {partners.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.commissionRate}%)
                        </option>
                      ))}
                    </select>
                    {selectedPartner && (
                      <label className="flex items-center justify-between rounded-lg border border-[var(--border-hairline)] px-3.5 py-2.5 text-xs cursor-pointer">
                        <span>
                          Comissão: <strong>{formatCurrencyExact(commissionValue)}</strong>
                        </span>
                        <input
                          type="checkbox"
                          checked={commissionPaid}
                          onChange={(e) => setCommissionPaid(e.target.checked)}
                          className="h-4 w-4 accent-[var(--accent)]"
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="double-bezel stagger-in xl:col-span-5">
              <div className="double-bezel-core h-full p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[var(--accent-text)]" />
                    <h2 className="text-sm font-bold text-[var(--text-primary)]">
                      Contrato PDF &amp; Pós-Venda
                    </h2>
                  </div>
                </div>

                <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-4 space-y-3 text-xs">
                  <p className="font-semibold text-[var(--text-primary)]">
                    Escopo: {lead.proposalPackage || "Pacote sob medida"}
                  </p>
                  {lead.proposalAddons && lead.proposalAddons.length > 0 && (
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      Adicionais: {lead.proposalAddons.join(", ")}
                    </p>
                  )}
                  <a
                    href={`/api/proposals/${lead.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-accent inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-lg text-xs font-bold"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Baixar Contrato PDF Atualizado
                  </a>
                </div>

                {/* Checklist */}
                <div className="space-y-2 border-t border-[var(--border-hairline)] pt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-[var(--text-primary)]">
                      Checklist Pós-Venda
                    </h3>
                    {checklist.length === 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setChecklist(buildPostSaleChecklist(funnel))
                        }
                        className="text-[11px] font-semibold text-[var(--accent-text)] hover:underline"
                      >
                        Gerar Checklist
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-[var(--border-hairline)]">
                    {checklist.map((item) => (
                      <label
                        key={item.id}
                        className="flex items-center gap-2.5 py-2.5 text-xs cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={item.completed}
                          onChange={() =>
                            setChecklist((prev) =>
                              prev.map((i) =>
                                i.id === item.id
                                  ? { ...i, completed: !i.completed }
                                  : i
                              )
                            )
                          }
                          className="h-4 w-4 accent-[var(--accent)]"
                        />
                        <span
                          className={cn(
                            "flex-1",
                            item.completed &&
                              "line-through text-[var(--text-muted)]"
                          )}
                        >
                          {item.title}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: TIMELINE & RADAR */}
        {activeTab === "timeline" && (
          <div className="double-bezel stagger-in">
            <div className="double-bezel-core p-6 space-y-5">
              <form onSubmit={handleAddNote} className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Registrar ligação, resumo de reunião ou próxima ação..."
                  className="input-field min-h-[42px] flex-1 rounded-lg px-3.5 text-xs"
                />
                <button
                  type="submit"
                  disabled={saving || !newNote.trim()}
                  className="btn-accent min-h-[42px] inline-flex items-center justify-center gap-2 rounded-lg px-5 text-xs font-bold disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Registrar na Timeline
                </button>
              </form>

              <div className="divide-y divide-[var(--border-hairline)] border-t border-[var(--border-hairline)]">
                {lead.interactions.length === 0 ? (
                  <p className="py-6 text-center text-xs text-[var(--text-muted)]">
                    Nenhuma interação registrada ainda.
                  </p>
                ) : (
                  lead.interactions.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 py-3.5 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-[var(--accent-text)] shrink-0" />
                          <span className="font-bold text-[var(--text-primary)]">
                            {item.title}
                          </span>
                        </div>
                        <p className="pl-5 text-[var(--text-secondary)]">
                          {item.description}
                        </p>
                      </div>
                      <span className="pl-5 sm:pl-0 font-mono-num text-[11px] text-[var(--text-muted)] shrink-0">
                        {formatDateTimeBr(item.createdAt)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
