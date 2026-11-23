"use client";

import React, { useEffect, useState } from "react";
import {
  Calendar,
  CalendarClock,
  CalendarPlus,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Film,
  KeyRound,
  Lock,
  MessageCircle,
  QrCode,
  Send,
  ShieldCheck,
  ThumbsUp,
  Upload,
  Video,
} from "lucide-react";
import { uploadStudioImage } from "@/lib/imageUpload";
import {
  ClientBriefing,
  ClientDeliverable,
  ClientMeeting,
  ClientPaymentNotice,
  Lead,
  MEETING_TYPES,
  MeetingType,
  PRODUCTION_STAGES,
} from "@/types/crm";
import {
  buildWhatsappUrl,
  cn,
  formatCurrency,
  formatDateBr,
  formatDateTimeBr,
} from "@/lib/utils";
import { BrandMark } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProposalClient } from "@/components/proposal/ProposalClient";

type PortalTab = "escopo" | "contrato" | "reunioes" | "entregas" | "briefing";

interface ClientPortalViewProps {
  lead: Lead;
  pinProtected: boolean;
  studioName: string;
  studioWhatsapp: string;
  pixKey: string;
  pixRecipientName: string;
  pixCopyPaste: string;
  pixQrDataUrl: string;
  pixNextAmount: number;
  pixNextKind: "sinal_50" | "quitacao";
}

function buildGoogleCalendarUrl(
  meeting: ClientMeeting,
  companyName: string,
  studioName: string
): string {
  const cleanDate = meeting.date.replace(/-/g, "");
  const [hh, mm] = (meeting.time || "10:00").split(":");
  const startH = Number(hh) || 10;
  const endH = Math.min(23, startH + 1);
  const start = `${cleanDate}T${String(startH).padStart(2, "0")}${mm || "00"}00`;
  const end = `${cleanDate}T${String(endH).padStart(2, "0")}${mm || "00"}00`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${meeting.title} | ${studioName} x ${companyName}`,
    dates: `${start}/${end}`,
    details:
      meeting.notes ||
      `Reunião agendada pelo Portal do Cliente ${studioName}.`,
    location:
      meeting.locationOrUrl ||
      (meeting.format === "online" ? "Online" : "Presencial"),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function getVideoEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname.includes("youtube.com") &&
      parsed.searchParams.get("v")
    ) {
      return `https://www.youtube.com/embed/${parsed.searchParams.get("v")}`;
    }
    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.replace("/", "");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (parsed.hostname.includes("vimeo.com")) {
      const match = parsed.pathname.match(/\/(\d+)/);
      if (match?.[1]) return `https://player.vimeo.com/video/${match[1]}`;
    }
  } catch {
    return null;
  }
  return null;
}

export function ClientPortalView({
  lead: initialLead,
  pinProtected,
  studioName,
  studioWhatsapp,
  pixKey,
  pixRecipientName,
  pixCopyPaste,
  pixQrDataUrl,
  pixNextAmount,
  pixNextKind,
}: ClientPortalViewProps) {
  const [lead, setLead] = useState<Lead>(initialLead);
  const [unlocked, setUnlocked] = useState(!pinProtected);
  const [pinInput, setPinInput] = useState("");
  const [verifiedPin, setVerifiedPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [checkingPin, setCheckingPin] = useState(false);

  const [activeTab, setActiveTab] = useState<PortalTab>("escopo");
  const [meetings, setMeetings] = useState<ClientMeeting[]>(
    lead.meetings ?? []
  );
  const [deliverables, setDeliverables] = useState<ClientDeliverable[]>(
    lead.deliverables ?? []
  );
  const [paymentNotices, setPaymentNotices] = useState<ClientPaymentNotice[]>(
    lead.paymentNotices ?? []
  );

  // Meeting request form
  const [meetingType, setMeetingType] = useState<MeetingType>("alinhamento");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("10:00");
  const [meetingFormat, setMeetingFormat] = useState<"online" | "presencial">(
    "online"
  );
  const [meetingNotes, setMeetingNotes] = useState("");
  const [submittingMeeting, setSubmittingMeeting] = useState(false);

  // Reschedule state
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("10:00");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [submittingReschedule, setSubmittingReschedule] = useState(false);

  // Pix payment report state
  const [pixRef, setPixRef] = useState("");
  const [pixReceiptUrl, setPixReceiptUrl] = useState("");
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [reportingPix, setReportingPix] = useState(false);
  const [copiedPixCode, setCopiedPixCode] = useState(false);

  const handleUploadReceipt = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingReceipt(true);
    try {
      const uploaded = await uploadStudioImage({
        file,
        folder: "receipts",
        leadId: lead.id,
        pin: verifiedPin || undefined,
      });
      setPixReceiptUrl(uploaded.url);
      showBanner("Comprovante anexado! Agora clique em 'Já fiz o Pix'.", "success");
    } catch (err) {
      showBanner(
        err instanceof Error ? err.message : "Erro ao enviar imagem.",
        "error"
      );
    } finally {
      setUploadingReceipt(false);
      e.target.value = "";
    }
  };

  // Deliverable feedback
  const [feedbackById, setFeedbackById] = useState<Record<string, string>>({});
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  // Briefing form
  const [briefing, setBriefing] = useState<ClientBriefing>({
    referencesLinks: lead.briefing?.referencesLinks || "",
    venueAddress: lead.briefing?.venueAddress || lead.address || "",
    accessTime: lead.briefing?.accessTime || "",
    onSiteContactName:
      lead.briefing?.onSiteContactName || lead.contactName || "",
    onSiteContactPhone: lead.briefing?.onSiteContactPhone || lead.phone || "",
    dressCodeOrNotes: lead.briefing?.dressCodeOrNotes || "",
  });
  const [savingBriefing, setSavingBriefing] = useState(false);

  const [banner, setBanner] = useState<{
    text: string;
    tone: "success" | "error";
  } | null>(null);

  const showBanner = (text: string, tone: "success" | "error" = "success") => {
    setBanner({ text, tone });
    setTimeout(() => setBanner(null), 4500);
  };

  useEffect(() => {
    if (!unlocked) return;
    fetch(`/api/proposals/${lead.id}/track`, { method: "POST" }).catch(() => {});
  }, [lead.id, unlocked]);

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError("");
    if (pinInput.trim().length !== 4) {
      setPinError("Digite o código PIN de 4 dígitos.");
      return;
    }
    setCheckingPin(true);
    try {
      const res = await fetch(`/api/portal/${lead.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify_pin", pin: pinInput.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPinError(json.error || "PIN incorreto.");
        return;
      }
      setVerifiedPin(pinInput.trim());
      setUnlocked(true);
    } catch {
      setPinError("Erro de conexão ao validar PIN.");
    } finally {
      setCheckingPin(false);
    }
  };

  const handleRequestMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingDate || !meetingTime) {
      showBanner("Escolha a data e o horário desejados.", "error");
      return;
    }
    setSubmittingMeeting(true);
    try {
      const res = await fetch(`/api/portal/${lead.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request_meeting",
          pin: verifiedPin || undefined,
          type: meetingType,
          date: meetingDate,
          time: meetingTime,
          format: meetingFormat,
          notes: meetingNotes,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showBanner(json.error || "Não foi possível agendar.", "error");
        return;
      }
      setMeetings(json.meetings || []);
      setMeetingDate("");
      setMeetingNotes("");
      showBanner(
        "Solicitação de reunião enviada. Você receberá a confirmação por aqui e pelo WhatsApp.",
        "success"
      );
    } finally {
      setSubmittingMeeting(false);
    }
  };

  const handleRescheduleMeeting = async (meetingId: string) => {
    if (!rescheduleDate || !rescheduleTime) {
      showBanner("Informe a nova data e horário para reagendar.", "error");
      return;
    }
    setSubmittingReschedule(true);
    try {
      const res = await fetch(`/api/portal/${lead.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reschedule_meeting",
          pin: verifiedPin || undefined,
          meetingId,
          date: rescheduleDate,
          time: rescheduleTime,
          reason: rescheduleReason,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showBanner(json.error || "Erro ao solicitar reagendamento.", "error");
        return;
      }
      setMeetings(json.meetings || []);
      setRescheduleId(null);
      setRescheduleDate("");
      setRescheduleReason("");
      showBanner(
        "Pedido de reagendamento enviado para a produção.",
        "success"
      );
    } finally {
      setSubmittingReschedule(false);
    }
  };

  const handleReportPix = async (e: React.FormEvent) => {
    e.preventDefault();
    setReportingPix(true);
    try {
      const res = await fetch(`/api/portal/${lead.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "report_payment",
          pin: verifiedPin || undefined,
          kind: pixNextKind,
          amount: pixNextAmount,
          transactionRef: pixRef.trim(),
          receiptUrl: pixReceiptUrl || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showBanner(json.error || "Não foi possível registrar o aviso.", "error");
        return;
      }
      setPaymentNotices(json.paymentNotices || []);
      setPixRef("");
      setPixReceiptUrl("");
      showBanner(
        "Aviso de pagamento enviado! Nossa equipe conferirá o extrato e atualizará o status no portal.",
        "success"
      );
    } finally {
      setReportingPix(false);
    }
  };

  const handleReviewDeliverable = async (
    deliverableId: string,
    decision: "aprovado" | "ajuste_solicitado"
  ) => {
    const feedback = (feedbackById[deliverableId] || "").trim();
    if (decision === "ajuste_solicitado" && !feedback) {
      showBanner("Descreva o ajuste desejado antes de enviar.", "error");
      return;
    }
    setReviewingId(deliverableId);
    try {
      const res = await fetch(`/api/portal/${lead.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review_deliverable",
          pin: verifiedPin || undefined,
          deliverableId,
          decision,
          feedback,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showBanner(json.error || "Erro ao registrar avaliação.", "error");
        return;
      }
      setDeliverables(json.deliverables || []);
      showBanner(
        decision === "aprovado"
          ? "Entrega aprovada com sucesso."
          : "Pedido de ajuste enviado para a equipe de edição.",
        "success"
      );
    } finally {
      setReviewingId(null);
    }
  };

  const handleSaveBriefing = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBriefing(true);
    try {
      const res = await fetch(`/api/portal/${lead.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_briefing",
          pin: verifiedPin || undefined,
          briefing,
        }),
      });
      if (!res.ok) {
        showBanner("Erro ao salvar briefing.", "error");
        return;
      }
      showBanner("Briefing e referências salvos no projeto.", "success");
    } finally {
      setSavingBriefing(false);
    }
  };

  const handleCopyPixCode = async () => {
    try {
      await navigator.clipboard.writeText(pixCopyPaste || pixKey);
      setCopiedPixCode(true);
      setTimeout(() => setCopiedPixCode(false), 2000);
    } catch {
      // ignore
    }
  };

  // PIN Lock Screen
  if (!unlocked) {
    return (
      <main className="relative min-h-[100dvh] flex flex-col items-center justify-center px-4 py-10">
        <div className="cinema-grain" aria-hidden="true" />
        <div className="double-bezel stagger-in w-full max-w-sm">
          <div className="double-bezel-core viewfinder-frame p-6 sm:p-8 space-y-6">
            <div className="space-y-3">
              <BrandMark showTagline />
              <div className="border-t border-[var(--border-hairline)] pt-4">
                <span className="badge-accent inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono-num text-[10px] font-bold uppercase">
                  <Lock className="h-3 w-3" /> Portal Protegido
                </span>
                <h1 className="mt-2 text-lg font-bold text-[var(--text-primary)]">
                  {lead.companyName}
                </h1>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Digite o PIN de 4 dígitos enviado pela equipe da {studioName}{" "}
                  para acessar sua proposta, contrato e entregas.
                </p>
              </div>
            </div>

            <form onSubmit={handleVerifyPin} className="space-y-4">
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  autoFocus
                  value={pinInput}
                  onChange={(e) =>
                    setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  placeholder="PIN de 4 dígitos"
                  className="input-field min-h-[46px] w-full rounded-lg pl-10 pr-4 font-mono-num text-center text-lg tracking-[0.4em]"
                />
              </div>

              {pinError && (
                <p
                  role="alert"
                  className="badge-danger rounded-lg px-3 py-2 text-xs font-medium"
                >
                  {pinError}
                </p>
              )}

              <button
                type="submit"
                disabled={checkingPin}
                className="btn-accent w-full min-h-[44px] rounded-lg text-sm font-bold disabled:opacity-60"
              >
                {checkingPin ? "Verificando..." : "Acessar Portal do Projeto"}
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  const currentProdIdx = Math.max(
    0,
    PRODUCTION_STAGES.findIndex(
      (ps) => ps.id === (lead.productionStage || "pre_producao")
    )
  );
  const isApproved = Boolean(lead.propostaAprovadaEm);
  const signalValue = (lead.estimatedValue || 0) * 0.5;
  const milestones = lead.milestoneDates ?? {};

  return (
    <div className="min-h-[100dvh] bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <div className="cinema-grain" aria-hidden="true" />

      {/* Top Portal Header */}
      <header className="glass-bar sticky top-0 z-30 border-b border-[var(--border-hairline)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <BrandMark compact />
            <div className="hidden sm:block h-5 w-px bg-[var(--border-hairline)]" />
            <div className="min-w-0">
              <p className="text-[10px] font-mono-num uppercase tracking-wider text-[var(--accent-text)] font-bold">
                PORTAL EXCLUSIVO DO CLIENTE
              </p>
              <h1 className="truncate text-sm sm:text-base font-bold text-[var(--text-primary)]">
                {lead.companyName}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={buildWhatsappUrl(
                studioWhatsapp,
                `Olá equipe ${studioName}! Estou no Portal do Projeto (${lead.companyName}) e gostaria de falar sobre nosso atendimento.`
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-accent inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Falar com a Produção</span>
              <span className="sm:hidden">WhatsApp</span>
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 space-y-6">
        {banner && (
          <div
            role="status"
            className={cn(
              "rounded-xl px-4 py-3 text-xs font-semibold",
              banner.tone === "success" ? "badge-success" : "badge-danger"
            )}
          >
            {banner.text}
          </div>
        )}

        {/* Production Storyboard Progress Bar with Milestone Dates */}
        <div className="double-bezel stagger-in">
          <div className="double-bezel-core p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Film className="h-4 w-4 text-[var(--accent-text)]" />
                <span className="text-xs font-bold text-[var(--text-primary)]">
                  Cronograma de Produção ·{" "}
                  {PRODUCTION_STAGES[currentProdIdx].label}
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 font-mono-num text-[11px] text-[var(--text-muted)]">
                <ShieldCheck className="h-3.5 w-3.5 text-[var(--status-success)]" />
                {isApproved ? "Escopo Fechado" : "Proposta Ativa"}
                {lead.eventDate
                  ? ` · Data: ${formatDateBr(lead.eventDate)}`
                  : ""}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {PRODUCTION_STAGES.map((ps, idx) => {
                const done = idx <= currentProdIdx;
                const plannedDate = milestones[ps.id];
                return (
                  <div key={ps.id} className="space-y-1.5">
                    <div
                      className={cn(
                        "h-1.5 rounded-full transition-colors",
                        done
                          ? "bg-[var(--accent)]"
                          : "bg-[var(--border-hairline)]"
                      )}
                    />
                    <div className="flex items-center justify-between gap-1">
                      <p
                        className={cn(
                          "text-[11px] font-semibold truncate",
                          done
                            ? "text-[var(--text-primary)]"
                            : "text-[var(--text-muted)]"
                        )}
                      >
                        {ps.shortLabel}
                      </p>
                      {plannedDate && (
                        <span className="font-mono-num text-[10px] text-[var(--accent-text)] shrink-0">
                          {formatDateBr(plannedDate).slice(0, 5)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Portal Navigation Dock */}
        <div className="dock-shell flex flex-wrap gap-1">
          {(
            [
              {
                id: "escopo",
                label: isApproved ? "Escopo Fechado" : "Proposta Comercial",
                icon: CheckCircle2,
              },
              { id: "contrato", label: "Contrato & Pix", icon: FileText },
              {
                id: "reunioes",
                label: `Reuniões (${meetings.length})`,
                icon: Calendar,
              },
              {
                id: "entregas",
                label: `Entregas 4K (${deliverables.length})`,
                icon: Video,
              },
              {
                id: "briefing",
                label: "Briefing & Local",
                icon: ClipboardList,
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
                  "inline-flex min-h-[40px] flex-1 sm:flex-none items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors",
                  active
                    ? "bg-[var(--bg-surface-solid)] text-[var(--text-primary)] border border-[var(--border-hairline)] shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
              >
                <Icon className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: PROPOSTA / ESCOPO FECHADO */}
        {activeTab === "escopo" && (
          <div>
            {!isApproved ? (
              <div className="double-bezel stagger-in">
                <div className="double-bezel-core overflow-hidden">
                  <ProposalClient
                    lead={lead}
                    studioWhatsapp={studioWhatsapp}
                    embedded
                    onApproved={(updatedLead) => setLead(updatedLead)}
                  />
                </div>
              </div>
            ) : (
              <div className="double-bezel stagger-in">
                <div className="double-bezel-core p-6 sm:p-8 space-y-6">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-hairline)] pb-5">
                    <div>
                      <span className="badge-success inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Escopo Aprovado &amp; Reservado
                      </span>
                      <h2 className="mt-3 text-xl font-bold text-[var(--text-primary)]">
                        {lead.proposalPackage ||
                          lead.customProposal?.title ||
                          "Pacote Personalizado ÚLTIMO QUADRO"}
                      </h2>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        Aprovado em{" "}
                        {formatDateBr(
                          lead.propostaAprovadaEm || lead.updatedAt
                        )}{" "}
                        · Data do projeto:{" "}
                        {lead.eventDate
                          ? formatDateBr(lead.eventDate)
                          : "A confirmar"}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                        Investimento Fechado
                      </p>
                      <p className="text-2xl font-bold font-mono-num text-[var(--accent-text)]">
                        {formatCurrency(lead.estimatedValue)}
                      </p>
                    </div>
                  </div>

                  {lead.customProposal?.enabled &&
                    lead.customProposal.deliverables.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                          Entregáveis do Escopo Sob Medida
                        </h3>
                        <ul className="divide-y divide-[var(--border-hairline)] border-t border-b border-[var(--border-hairline)]">
                          {lead.customProposal.deliverables.map((item) => (
                            <li
                              key={item}
                              className="flex items-center gap-2 py-2.5 text-xs text-[var(--text-primary)]"
                            >
                              <Check className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  {lead.proposalAddons && lead.proposalAddons.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        Adicionais Inclusos
                      </h3>
                      <ul className="divide-y divide-[var(--border-hairline)] border-t border-b border-[var(--border-hairline)]">
                        {lead.proposalAddons.map((addon) => (
                          <li
                            key={addon}
                            className="flex items-center gap-2 py-2.5 text-xs text-[var(--text-primary)]"
                          >
                            <Check className="h-3.5 w-3.5 text-[var(--status-success)]" />
                            {addon}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveTab("contrato")}
                      className="btn-accent inline-flex min-h-[42px] items-center gap-2 rounded-lg px-4 text-xs font-bold"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Ver Contrato PDF &amp; Pagamento Pix
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("reunioes")}
                      className="btn-ghost inline-flex min-h-[42px] items-center gap-2 rounded-lg px-4 text-xs font-semibold"
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      Agendar Reunião de Alinhamento
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CONTRATO, CERTIFICADO DE ACEITE & PIX QR CODE */}
        {activeTab === "contrato" && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Contract & Electronic Acceptance Certificate */}
            <div className="double-bezel stagger-in lg:col-span-6">
              <div className="double-bezel-core h-full p-6 space-y-5">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[var(--accent-text)]" />
                  <h2 className="text-sm font-bold text-[var(--text-primary)]">
                    Contrato de Prestação de Serviços
                  </h2>
                </div>
                <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                  Formaliza a reserva de data, o escopo fotográfico/audiovisual
                  4K e os prazos de entrega da {studioName}.
                </p>

                <div className="divide-y divide-[var(--border-hairline)] border-t border-b border-[var(--border-hairline)] text-xs">
                  <div className="flex justify-between py-2.5">
                    <span className="text-[var(--text-muted)]">Contratante</span>
                    <span className="font-semibold">
                      {lead.razaoSocial || lead.companyName}
                    </span>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <span className="text-[var(--text-muted)]">Documento</span>
                    <span className="font-mono-num">
                      {lead.cnpj || lead.cpf || "Informado na aprovação"}
                    </span>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <span className="text-[var(--text-muted)]">
                      Data do Projeto
                    </span>
                    <span className="font-mono-num">
                      {lead.eventDate
                        ? formatDateBr(lead.eventDate)
                        : "A definir"}
                    </span>
                  </div>
                </div>

                {lead.acceptanceCertificate && (
                  <div className="rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-4 space-y-2 text-[11px]">
                    <div className="flex items-center gap-2 font-bold text-[var(--status-success)]">
                      <FileCheck2 className="h-4 w-4" />
                      Certificado de Aceite Eletrônico Registrado
                    </div>
                    <p className="text-[var(--text-primary)]">
                      <strong>Signatário:</strong>{" "}
                      {lead.acceptanceCertificate.signerName} (
                      {lead.acceptanceCertificate.signerDocument})
                    </p>
                    <p className="font-mono-num text-[var(--text-secondary)]">
                      Data:{" "}
                      {formatDateTimeBr(lead.acceptanceCertificate.acceptedAt)} ·
                      IP: {lead.acceptanceCertificate.ipAddress}
                    </p>
                    <p className="font-mono-num text-[10px] text-[var(--text-muted)] break-all">
                      Hash SHA-256: {lead.acceptanceCertificate.hash}
                    </p>
                  </div>
                )}

                <a
                  href={`/api/proposals/${lead.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-accent inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg text-xs font-bold"
                >
                  <Download className="h-4 w-4" />
                  Baixar Contrato em PDF
                </a>
              </div>
            </div>

            {/* Real Pix QR Code + "Já fiz o Pix" */}
            <div className="double-bezel stagger-in lg:col-span-6">
              <div className="double-bezel-core h-full p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <QrCode className="h-4 w-4 text-[var(--accent-text)]" />
                    <h2 className="text-sm font-bold text-[var(--text-primary)]">
                      Pagamento via Pix (BR Code)
                    </h2>
                  </div>
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase",
                      lead.paymentStatus === "quitado" && "badge-success",
                      lead.paymentStatus === "sinal_pago" && "badge-info",
                      lead.paymentStatus === "pendente" && "badge-warning"
                    )}
                  >
                    {lead.paymentStatus === "quitado"
                      ? "Quitado 100%"
                      : lead.paymentStatus === "sinal_pago"
                      ? "Sinal 50% Pago"
                      : "Sinal Pendente"}
                  </span>
                </div>

                <div className="divide-y divide-[var(--border-hairline)] border-t border-b border-[var(--border-hairline)] text-xs">
                  <div className="flex justify-between py-2.5">
                    <span className="text-[var(--text-muted)]">Valor Total</span>
                    <span className="font-mono-num font-bold">
                      {formatCurrency(lead.estimatedValue)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <span className="text-[var(--text-muted)]">
                      {pixNextKind === "quitacao"
                        ? "Saldo Restante (50%)"
                        : "Sinal de Reserva (50%)"}
                    </span>
                    <span className="font-mono-num font-bold text-[var(--accent-text)]">
                      {lead.paymentStatus === "quitado"
                        ? "R$ 0"
                        : formatCurrency(signalValue)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <span className="text-[var(--text-muted)]">Favorecido</span>
                    <span>{pixRecipientName}</span>
                  </div>
                </div>

                {lead.paymentStatus !== "quitado" && (
                  <>
                    <div className="flex flex-col sm:flex-row items-center gap-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-4">
                      {pixQrDataUrl && (
                        <img
                          src={pixQrDataUrl}
                          alt="QR Code Pix ÚLTIMO QUADRO"
                          className="h-32 w-32 rounded-lg bg-white p-1.5 shrink-0"
                        />
                      )}
                      <div className="space-y-2.5 flex-1 min-w-0 w-full">
                        <p className="text-xs font-semibold text-[var(--text-primary)]">
                          Escaneie o QR Code no app do seu banco ou use o Pix
                          Copia e Cola:
                        </p>
                        <code className="block truncate rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface-solid)] px-2.5 py-2 font-mono-num text-[11px]">
                          {pixCopyPaste || pixKey}
                        </code>
                        <button
                          type="button"
                          onClick={handleCopyPixCode}
                          className="btn-ghost min-h-[38px] w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold"
                        >
                          {copiedPixCode ? (
                            <Check className="h-3.5 w-3.5 text-[var(--status-success)]" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          {copiedPixCode
                            ? "Código Pix Copiado!"
                            : "Copiar Pix Copia e Cola"}
                        </button>
                      </div>
                    </div>

                    {/* "Já fiz o Pix" Form */}
                    <form
                      onSubmit={handleReportPix}
                      className="space-y-2.5 border-t border-[var(--border-hairline)] pt-4"
                    >
                      <p className="text-xs font-bold text-[var(--text-primary)]">
                        Já realizou o pagamento? Avise nossa produção:
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={pixRef}
                          onChange={(e) => setPixRef(e.target.value)}
                          placeholder="ID da transação ou observação (opcional)"
                          className="input-field min-h-[40px] flex-1 rounded-lg px-3 text-xs"
                        />
                        <label className="btn-ghost min-h-[40px] inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold">
                          <Upload className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                          <span>
                            {uploadingReceipt
                              ? "Enviando..."
                              : pixReceiptUrl
                              ? "Foto Anexada"
                              : "Anexar Print"}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            disabled={uploadingReceipt}
                            onChange={handleUploadReceipt}
                            className="sr-only"
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={reportingPix || uploadingReceipt}
                          className="badge-success min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-lg px-4 text-xs font-bold disabled:opacity-60"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {reportingPix ? "Avisando..." : "Já fiz o Pix"}
                        </button>
                      </div>
                      <a
                        href={buildWhatsappUrl(
                          studioWhatsapp,
                          `Olá equipe ${studioName}! Acabei de realizar o Pix (${
                            pixNextKind === "quitacao"
                              ? "Quitação 50%"
                              : "Sinal 50%"
                          } - ${formatCurrency(pixNextAmount)}) referente ao projeto ${lead.companyName}. Segue o comprovante:`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--accent-text)] hover:underline"
                      >
                        <MessageCircle className="h-3 w-3" />
                        Enviar foto do comprovante pelo WhatsApp
                      </a>
                    </form>
                  </>
                )}

                {paymentNotices.length > 0 && (
                  <div className="border-t border-[var(--border-hairline)] pt-3 space-y-1.5 text-[11px]">
                    <p className="font-semibold text-[var(--text-muted)] uppercase">
                      Avisos de pagamento enviados
                    </p>
                    {paymentNotices.map((pn) => (
                      <div
                        key={pn.id}
                        className="flex items-center justify-between text-[var(--text-secondary)]"
                      >
                        <span>
                          {pn.kind === "quitacao" ? "Quitação" : "Sinal 50%"} (
                          {formatCurrency(pn.amount)})
                        </span>
                        <span className="font-mono-num text-[var(--text-muted)]">
                          {formatDateTimeBr(pn.reportedAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: REUNIÕES & REAGENDAMENTO */}
        {activeTab === "reunioes" && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <div className="double-bezel stagger-in lg:col-span-5">
              <form
                onSubmit={handleRequestMeeting}
                className="double-bezel-core p-6 space-y-4"
              >
                <div className="flex items-center gap-2">
                  <CalendarPlus className="h-4 w-4 text-[var(--accent-text)]" />
                  <h2 className="text-sm font-bold text-[var(--text-primary)]">
                    Solicitar Nova Reunião
                  </h2>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Atendimento padrão: <strong>Seg a Sex, 09h às 18h</strong>{" "}
                  (BH/Nova Lima). Sugira o melhor horário para alinhamento,
                  visita técnica ou revisão de corte.
                </p>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                    Tipo de Reunião
                  </label>
                  <select
                    value={meetingType}
                    onChange={(e) =>
                      setMeetingType(e.target.value as MeetingType)
                    }
                    className="input-field min-h-[42px] w-full rounded-lg px-3 text-xs"
                  >
                    {MEETING_TYPES.map((mt) => (
                      <option key={mt.id} value={mt.id}>
                        {mt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                      Data Sugerida
                    </label>
                    <input
                      type="date"
                      required
                      value={meetingDate}
                      onChange={(e) => setMeetingDate(e.target.value)}
                      className="input-field min-h-[42px] w-full rounded-lg px-3 font-mono-num text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                      Horário
                    </label>
                    <input
                      type="time"
                      required
                      value={meetingTime}
                      onChange={(e) => setMeetingTime(e.target.value)}
                      className="input-field min-h-[42px] w-full rounded-lg px-3 font-mono-num text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                    Formato
                  </label>
                  <select
                    value={meetingFormat}
                    onChange={(e) =>
                      setMeetingFormat(
                        e.target.value as "online" | "presencial"
                      )
                    }
                    className="input-field min-h-[42px] w-full rounded-lg px-3 text-xs"
                  >
                    <option value="online">Online (Google Meet)</option>
                    <option value="presencial">
                      Presencial (BH / Nova Lima)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                    Pauta / Observações
                  </label>
                  <textarea
                    rows={3}
                    value={meetingNotes}
                    onChange={(e) => setMeetingNotes(e.target.value)}
                    placeholder="Ex.: Alinhamento de pratos, luz do salão, horário de gravação..."
                    className="input-field w-full rounded-lg px-3 py-2 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingMeeting}
                  className="btn-accent min-h-[44px] w-full inline-flex items-center justify-center gap-2 rounded-lg text-xs font-bold disabled:opacity-60"
                >
                  <Send className="h-3.5 w-3.5" />
                  {submittingMeeting
                    ? "Enviando solicitação..."
                    : "Enviar Solicitação de Reunião"}
                </button>
              </form>
            </div>

            <div className="double-bezel stagger-in lg:col-span-7">
              <div className="double-bezel-core h-full p-6 space-y-4">
                <h2 className="text-sm font-bold text-[var(--text-primary)]">
                  Reuniões do Projeto
                </h2>

                {meetings.length === 0 ? (
                  <p className="py-10 text-center text-xs text-[var(--text-muted)]">
                    Nenhuma reunião agendada ainda. Use o formulário ao lado
                    para sugerir um horário.
                  </p>
                ) : (
                  <div className="divide-y divide-[var(--border-hairline)] border-t border-[var(--border-hairline)]">
                    {meetings.map((m) => (
                      <div key={m.id} className="py-4 space-y-2.5 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
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
                          {m.format === "online" ? "Online" : "Presencial"}
                        </p>
                        {m.locationOrUrl && (
                          <p className="text-[11px] text-[var(--accent-text)] break-all">
                            Local / Link: {m.locationOrUrl}
                          </p>
                        )}
                        {m.notes && (
                          <p className="text-[11px] text-[var(--text-muted)]">
                            {m.notes}
                          </p>
                        )}

                        {m.status === "confirmada" && (
                          <div className="pt-1 flex flex-wrap gap-2">
                            <a
                              href={buildGoogleCalendarUrl(
                                m,
                                lead.companyName,
                                studioName
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-ghost inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold"
                            >
                              <Calendar className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                              Google Calendar
                            </a>
                            {m.locationOrUrl?.startsWith("http") && (
                              <a
                                href={m.locationOrUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-accent inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-3 text-[11px] font-bold"
                              >
                                Entrar na Reunião
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setRescheduleId(
                                  rescheduleId === m.id ? null : m.id
                                );
                                setRescheduleDate(m.date);
                                setRescheduleTime(m.time);
                              }}
                              className="btn-ghost inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-3 text-[11px] text-[var(--text-secondary)]"
                            >
                              <CalendarClock className="h-3.5 w-3.5" />
                              Pedir Reagendamento
                            </button>
                          </div>
                        )}

                        {rescheduleId === m.id && (
                          <div className="mt-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-3 space-y-2.5">
                            <p className="text-[11px] font-bold text-[var(--text-primary)]">
                              Sugerir nova data e horário:
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="date"
                                value={rescheduleDate}
                                onChange={(e) =>
                                  setRescheduleDate(e.target.value)
                                }
                                className="input-field min-h-[36px] rounded-md px-2.5 font-mono-num text-xs"
                              />
                              <input
                                type="time"
                                value={rescheduleTime}
                                onChange={(e) =>
                                  setRescheduleTime(e.target.value)
                                }
                                className="input-field min-h-[36px] rounded-md px-2.5 font-mono-num text-xs"
                              />
                            </div>
                            <input
                              type="text"
                              value={rescheduleReason}
                              onChange={(e) =>
                                setRescheduleReason(e.target.value)
                              }
                              placeholder="Motivo opcional..."
                              className="input-field min-h-[36px] w-full rounded-md px-2.5 text-xs"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setRescheduleId(null)}
                                className="btn-ghost rounded-md px-3 py-1.5 text-[11px]"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                disabled={submittingReschedule}
                                onClick={() => handleRescheduleMeeting(m.id)}
                                className="btn-accent rounded-md px-3 py-1.5 text-[11px] font-bold"
                              >
                                {submittingReschedule
                                  ? "Enviando..."
                                  : "Confirmar Pedido"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ENTREGAS 4K COM PLAYER / THUMBNAIL E VERSÃO */}
        {activeTab === "entregas" && (
          <div className="double-bezel stagger-in">
            <div className="double-bezel-core p-6 space-y-5">
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)]">
                  Sala de Exibição &amp; Entregas 4K
                </h2>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Assista às prévias, baixe suas galerias em alta resolução e
                  aprove ou solicite ajustes com controle de versão.
                </p>
              </div>

              {deliverables.length === 0 ? (
                <div className="border-t border-[var(--border-hairline)] py-10 text-center space-y-1">
                  <Video className="mx-auto h-6 w-6 text-[var(--text-muted)]" />
                  <p className="text-xs font-semibold text-[var(--text-secondary)]">
                    Seus materiais aparecerão aqui assim que entrarem em edição
                    ou entrega.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-hairline)] border-t border-[var(--border-hairline)]">
                  {deliverables.map((d) => {
                    const embedUrl = getVideoEmbedUrl(d.url);
                    return (
                      <div key={d.id} className="py-5 space-y-3.5 text-xs">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                                {d.title}
                              </h3>
                              {d.version && (
                                <span className="badge-accent rounded-md px-2 py-0.5 font-mono-num text-[10px] font-bold uppercase">
                                  {d.version}
                                </span>
                              )}
                              <span
                                className={cn(
                                  "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase",
                                  d.status === "aprovado" && "badge-success",
                                  d.status === "ajuste_solicitado" &&
                                    "badge-danger",
                                  d.status === "pronto_aprovacao" &&
                                    "badge-warning",
                                  d.status === "em_producao" && "badge-info"
                                )}
                              >
                                {d.status.replace("_", " ")}
                              </span>
                            </div>
                            {d.description && (
                              <p className="text-[var(--text-secondary)]">
                                {d.description}
                              </p>
                            )}
                          </div>
                          <a
                            href={d.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-accent inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-4 text-xs font-bold"
                          >
                            Abrir Material
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>

                        {embedUrl ? (
                          <div className="aspect-video w-full max-w-2xl overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-black">
                            <iframe
                              src={embedUrl}
                              title={d.title}
                              className="h-full w-full"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        ) : d.thumbnailUrl ? (
                          <a
                            href={d.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block max-w-md overflow-hidden rounded-xl border border-[var(--border-hairline)]"
                          >
                            <img
                              src={d.thumbnailUrl}
                              alt={`Capa de ${d.title}`}
                              className="h-48 w-full object-cover transition-transform hover:scale-[1.02]"
                            />
                          </a>
                        ) : null}

                        {d.status !== "aprovado" && (
                          <div className="flex flex-col sm:flex-row gap-2 pt-1">
                            <input
                              type="text"
                              value={
                                feedbackById[d.id] ?? d.clientFeedback ?? ""
                              }
                              onChange={(e) =>
                                setFeedbackById((prev) => ({
                                  ...prev,
                                  [d.id]: e.target.value,
                                }))
                              }
                              placeholder="Comentário opcional ou lista de ajustes desejados..."
                              className="input-field min-h-[38px] flex-1 rounded-lg px-3 text-xs"
                            />
                            <button
                              type="button"
                              disabled={reviewingId === d.id}
                              onClick={() =>
                                handleReviewDeliverable(d.id, "aprovado")
                              }
                              className="badge-success min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 text-xs font-bold"
                            >
                              <ThumbsUp className="h-3.5 w-3.5" />
                              Aprovar Entrega
                            </button>
                            <button
                              type="button"
                              disabled={reviewingId === d.id}
                              onClick={() =>
                                handleReviewDeliverable(
                                  d.id,
                                  "ajuste_solicitado"
                                )
                              }
                              className="btn-ghost min-h-[38px] rounded-lg px-3.5 text-xs font-semibold"
                            >
                              Solicitar Ajuste
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: BRIEFING & REFERÊNCIAS */}
        {activeTab === "briefing" && (
          <div className="double-bezel stagger-in">
            <form
              onSubmit={handleSaveBriefing}
              className="double-bezel-core p-6 space-y-5"
            >
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)]">
                  Briefing, Acesso ao Local &amp; Referências Visuais
                </h2>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Preencha os detalhes logísticos e links de inspiração para que
                  nossa equipe chegue 100% alinhada no dia da captação.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                    Endereço Completo do Local
                  </label>
                  <input
                    type="text"
                    value={briefing.venueAddress}
                    onChange={(e) =>
                      setBriefing((prev) => ({
                        ...prev,
                        venueAddress: e.target.value,
                      }))
                    }
                    placeholder="Rua, número, bairro, estacionamento..."
                    className="input-field min-h-[42px] w-full rounded-lg px-3.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                    Horário Liberado para Chegada da Equipe
                  </label>
                  <input
                    type="text"
                    value={briefing.accessTime}
                    onChange={(e) =>
                      setBriefing((prev) => ({
                        ...prev,
                        accessTime: e.target.value,
                      }))
                    }
                    placeholder="Ex.: Montagem a partir das 17h30"
                    className="input-field min-h-[42px] w-full rounded-lg px-3.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                    Responsável no Local (Dia do Evento)
                  </label>
                  <input
                    type="text"
                    value={briefing.onSiteContactName}
                    onChange={(e) =>
                      setBriefing((prev) => ({
                        ...prev,
                        onSiteContactName: e.target.value,
                      }))
                    }
                    className="input-field min-h-[42px] w-full rounded-lg px-3.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                    WhatsApp do Responsável no Local
                  </label>
                  <input
                    type="text"
                    value={briefing.onSiteContactPhone}
                    onChange={(e) =>
                      setBriefing((prev) => ({
                        ...prev,
                        onSiteContactPhone: e.target.value,
                      }))
                    }
                    className="input-field min-h-[42px] w-full rounded-lg px-3.5 font-mono-num text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                  Links de Referência Visual (Pinterest, Instagram, YouTube,
                  Drive)
                </label>
                <textarea
                  rows={3}
                  value={briefing.referencesLinks}
                  onChange={(e) =>
                    setBriefing((prev) => ({
                      ...prev,
                      referencesLinks: e.target.value,
                    }))
                  }
                  placeholder="Cole um link por linha..."
                  className="input-field w-full rounded-lg px-3.5 py-2.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                  Dress Code, Pessoas VIP / Momentos Obrigatórios
                </label>
                <textarea
                  rows={3}
                  value={briefing.dressCodeOrNotes}
                  onChange={(e) =>
                    setBriefing((prev) => ({
                      ...prev,
                      dressCodeOrNotes: e.target.value,
                    }))
                  }
                  placeholder="Ex.: Foto obrigatória dos pratos assinatura, sócios no salão..."
                  className="input-field w-full rounded-lg px-3.5 py-2.5 text-xs"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingBriefing}
                  className="btn-accent min-h-[44px] inline-flex items-center gap-2 rounded-lg px-5 text-xs font-bold disabled:opacity-60"
                >
                  <Check className="h-4 w-4" />
                  {savingBriefing
                    ? "Salvando..."
                    : "Salvar Briefing do Projeto"}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
