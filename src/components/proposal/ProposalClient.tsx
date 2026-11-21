"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileCheck2,
  FileText,
  Film,
  MessageCircle,
  Moon,
  QrCode,
  ShieldCheck,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import {
  BRAND_DEFAULTS,
  FunnelId,
  getServiceVertical,
  Lead,
  SERVICES_CATALOG,
  SOCIAL_MODA_PACKAGES,
} from "@/types/crm";
import {
  buildWhatsappUrl,
  cn,
  formatCnpj,
  formatCpf,
  formatCurrency,
  formatCurrencyExact,
  formatDateBr,
} from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";
import { BrandMark } from "@/components/BrandMark";

interface ProposalClientProps {
  lead: Lead;
  studioWhatsapp: string;
}

interface ApprovedConfirmationData {
  whatsappUrl: string;
  total: number;
  deposit: number;
  verticalTitle: string;
  packageName: string;
  addons: string[];
  eventDate: string;
  isPortrait: boolean;
  pdfUrl: string;
  pdfFileName: string;
  pix: {
    key: string;
    recipientName: string;
    city: string;
    depositAmount: number;
    copyPaste: string;
    qrDataUrl: string;
  };
}

const DIFFERENTIALS = [
  {
    icon: ShieldCheck,
    title: "Backup Simultâneo",
    description:
      "Equipamento profissional Full-Frame 4K com gravação simultânea em cartões duplos durante toda a produção. Risco zero de perda de material.",
  },
  {
    icon: Film,
    title: "Direção & Luz Dedicada",
    description:
      "Iluminação portátil, ótica fixa luminosa (35/50/85mm) e direção de postura e cena para resultados limpos, fiéis e de alto impacto comercial.",
  },
  {
    icon: Clock,
    title: "Entrega Expressa",
    description:
      "Prévias editadas entregues no mesmo dia ou na manhã seguinte para manter o timing perfeito no Instagram, LinkedIn, imprensa e tráfego pago.",
  },
  {
    icon: FileCheck2,
    title: "Atendimento PJ & NFS-e",
    description:
      "Emissão de Nota Fiscal de Serviços (NFS-e), contrato digital objetivo e pagamento estruturado em 50% na reserva e 50% na entrega.",
  },
];

export function ProposalClient({
  lead,
  studioWhatsapp,
}: ProposalClientProps) {
  const { theme, toggleTheme } = useTheme();
  const trackedRef = useRef(false);

  const [selectedVerticalId, setSelectedVerticalId] = useState<FunnelId>(
    lead.funnel
  );
  const [useSocialModa, setUseSocialModa] = useState(false);

  const currentVertical = useMemo(
    () => getServiceVertical(selectedVerticalId),
    [selectedVerticalId]
  );

  const activePackages = useMemo(() => {
    if (selectedVerticalId === "moda" && useSocialModa) {
      return SOCIAL_MODA_PACKAGES;
    }
    return currentVertical.packages;
  }, [selectedVerticalId, useSocialModa, currentVertical]);

  const [selectedPackageId, setSelectedPackageId] = useState<string>(
    activePackages[1]?.id ?? activePackages[0].id
  );
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);

  // Reset selected package & addons whenever vertical or Social Moda toggle changes
  useEffect(() => {
    const featured = activePackages.find((p) => p.featured) ?? activePackages[0];
    setSelectedPackageId(featured.id);
    setSelectedAddonIds([]);
  }, [activePackages]);

  // Approval modal state (supports both PJ CNPJ and PF CPF)
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [docMode, setDocMode] = useState<"cnpj" | "cpf">(
    lead.cpf && !lead.cnpj ? "cpf" : "cnpj"
  );
  const [cnpj, setCnpj] = useState(lead.cnpj || "");
  const [cpf, setCpf] = useState(lead.cpf || "");
  const [razaoSocial, setRazaoSocial] = useState(
    lead.razaoSocial || lead.companyName
  );
  const [eventDate, setEventDate] = useState(lead.eventDate || "");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [approvedInfo, setApprovedInfo] =
    useState<ApprovedConfirmationData | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);

  // Automatic open tracking + Real-time Radar alert (10-min debounce on server)
  useEffect(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;

    fetch(`/api/proposals/${lead.id}/track`, { method: "POST" })
      .then((res) => {
        if (res.ok && typeof BroadcastChannel !== "undefined") {
          const channel = new BroadcastChannel("crmaster-sync");
          channel.postMessage({
            type: "proposal_viewed",
            leadId: lead.id,
            companyName: lead.companyName,
          });
          channel.close();
        }
      })
      .catch(() => {
        // Silent tracking fallback
      });
  }, [lead.id, lead.companyName]);

  const selectedPackage = useMemo(
    () =>
      activePackages.find((p) => p.id === selectedPackageId) ??
      activePackages[0],
    [activePackages, selectedPackageId]
  );

  const selectedAddons = useMemo(
    () =>
      currentVertical.addons.filter((a) => selectedAddonIds.includes(a.id)),
    [currentVertical.addons, selectedAddonIds]
  );

  const totalValue = useMemo(() => {
    const addonsSum = selectedAddons.reduce((sum, a) => sum + a.price, 0);
    return selectedPackage.price + addonsSum;
  }, [selectedPackage, selectedAddons]);

  const depositValue = totalValue * 0.5;

  const toggleAddon = (id: string) => {
    setSelectedAddonIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCopyPix = async () => {
    if (!approvedInfo?.pix.copyPaste) return;
    try {
      await navigator.clipboard.writeText(approvedInfo.pix.copyPaste);
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 2200);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const isPortrait = docMode === "cpf";
    if (isPortrait) {
      if (cpf.replace(/\D/g, "").length < 11) {
        setErrorMsg("Informe um CPF válido com 11 dígitos.");
        return;
      }
    } else {
      if (cnpj.replace(/\D/g, "").length < 14) {
        setErrorMsg("Informe um CNPJ válido com 14 dígitos.");
        return;
      }
    }

    if (!razaoSocial.trim() || !eventDate) {
      setErrorMsg("Preencha o nome/razão social e a data para reservar.");
      return;
    }

    setSubmitting(true);
    try {
      const addonNames = selectedAddons.map((a) => a.name);
      const res = await fetch(`/api/proposals/${lead.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageName: selectedPackage.name,
          addons: addonNames,
          totalValue,
          cnpj: isPortrait ? undefined : cnpj,
          cpf: isPortrait ? cpf : undefined,
          razaoSocial: razaoSocial.trim(),
          eventDate,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || "Não foi possível confirmar a aprovação.");
        return;
      }

      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel("crmaster-sync");
        channel.postMessage({
          type: "proposal_approved",
          leadId: lead.id,
          companyName: lead.companyName,
        });
        channel.close();
      }

      const formattedDate = formatDateBr(eventDate);
      const addonsText =
        addonNames.length > 0 ? addonNames.join(", ") : "Nenhum adicional";

      const confirmationMessage = `Olá ÚLTIMO QUADRO! Acabamos de aprovar a proposta online para *${lead.companyName}* e segue o comprovante do sinal de 50% via Pix.

*Resumo da Reserva:*
- Vertical: ${currentVertical.title}
- Pacote: ${selectedPackage.name} (${formatCurrency(selectedPackage.price)})
- Adicionais: ${addonsText}
- Valor Total: *${formatCurrencyExact(totalValue)}*
- Sinal de Reserva (50% via Pix): *${formatCurrencyExact(depositValue)}*

*Dados para ${isPortrait ? "Termo de Uso de Imagem" : "Contrato / NFS-e"}:*
- ${isPortrait ? "Nome" : "Razão Social"}: ${razaoSocial.trim()}
- ${isPortrait ? "CPF" : "CNPJ"}: ${isPortrait ? cpf : cnpj}
- Data Reservada: ${formattedDate}
- Responsável: ${lead.contactName}`;

      const waUrl = buildWhatsappUrl(studioWhatsapp, confirmationMessage);

      setApprovedInfo({
        whatsappUrl: waUrl,
        total: totalValue,
        deposit: depositValue,
        verticalTitle: currentVertical.title,
        packageName: selectedPackage.name,
        addons: addonNames,
        eventDate,
        isPortrait,
        pdfUrl: json.pdfUrl || `/api/proposals/${lead.id}/pdf`,
        pdfFileName: json.pdfFileName || "Contrato-Ultimo-Quadro.pdf",
        pix: json.pix,
      });

      setShowApprovalModal(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setErrorMsg("Erro de conexão ao registrar aprovação. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] pb-20">
      {/* Official ÚLTIMO QUADRO Cinema Header */}
      <header className="sticky top-0 z-30 border-b border-[var(--border-hairline)] bg-[var(--bg-canvas)]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <BrandMark showTagline />

          <div className="flex items-center gap-2.5">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-1 font-mono-num text-[11px] font-semibold text-[var(--accent)]">
              <Camera className="h-3 w-3" />
              24FPS · PROPOSTA INTERATIVA
            </span>
            <button
              type="button"
              onClick={toggleTheme}
              className="btn-ghost flex h-9 w-9 items-center justify-center rounded-xl cursor-pointer"
              aria-label="Alternar tema"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-[var(--accent)]" />
              ) : (
                <Moon className="h-4 w-4 text-[var(--text-primary)]" />
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 lg:px-8 space-y-12">
        {/* Confirmation Screen with Static Pix BR Code + Contract PDF Download */}
        {approvedInfo ? (
          <section className="space-y-6">
            <div className="glass-panel rounded-3xl border border-emerald-500/40 p-6 sm:p-8 space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                Proposta Aprovada &amp; Pré-Reserva Confirmada
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-4xl">
                Data pré-reservada para {lead.companyName}
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)]">
                Seu{" "}
                {approvedInfo.isPortrait
                  ? "Termo de Uso de Imagem"
                  : "Contrato de Prestação de Serviços"}{" "}
                da <strong>ÚLTIMO QUADRO</strong> já foi gerado em PDF. Para
                efetivar o bloqueio exclusivo da data{" "}
                <strong className="font-mono-num text-[var(--text-primary)]">
                  {formatDateBr(approvedInfo.eventDate)}
                </strong>
                , realize o Pix do sinal de 50% abaixo e envie o comprovante no
                WhatsApp.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
              {/* Left: Pix QR Code & Copy-Paste (7 cols) */}
              <div className="glass-panel rounded-3xl p-6 sm:p-8 lg:col-span-7 space-y-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                      <QrCode className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="text-base font-bold text-[var(--text-primary)]">
                        Pix Copia e Cola — Sinal de 50%
                      </h2>
                      <p className="text-xs text-[var(--text-muted)]">
                        Padrão BR Code / EMV · {approvedInfo.pix.recipientName} ·{" "}
                        {approvedInfo.pix.city}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono-num text-xl font-extrabold text-emerald-400">
                    {formatCurrencyExact(approvedInfo.pix.depositAmount)}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-12 sm:items-center">
                  <div className="sm:col-span-5 flex justify-center">
                    <div className="rounded-3xl bg-white p-3.5 shadow-xl border border-zinc-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={approvedInfo.pix.qrDataUrl}
                        alt="QR Code Pix para pagamento do sinal de 50%"
                        className="h-48 w-48 object-contain"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-7 space-y-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                        Código Pix Copia e Cola
                      </p>
                      <div className="rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)] p-3 font-mono-num text-[11px] leading-relaxed text-[var(--text-secondary)] break-all max-h-28 overflow-y-auto select-all">
                        {approvedInfo.pix.copyPaste}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2.5 sm:flex-row">
                      <button
                        type="button"
                        onClick={handleCopyPix}
                        className="btn-accent flex-1 inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-extrabold cursor-pointer"
                      >
                        {copiedPix ? (
                          <>
                            <Check className="h-4 w-4" />
                            Código Pix Copiado!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            Copiar Código Pix
                          </>
                        )}
                      </button>

                      <a
                        href={approvedInfo.whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-xs font-extrabold text-zinc-950 hover:bg-emerald-400 transition-colors"
                      >
                        <MessageCircle className="h-4 w-4" />
                        Enviar Comprovante no WhatsApp
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Summary & Instant PDF Download (5 cols) */}
              <div className="glass-panel rounded-3xl p-6 space-y-5 lg:col-span-5">
                <div>
                  <p className="font-mono-num text-[11px] font-bold uppercase tracking-wider text-[var(--accent)]">
                    Resumo &amp; Documentação
                  </p>
                  <h3 className="mt-1 text-base font-bold text-[var(--text-primary)]">
                    Detalhes da Reserva
                  </h3>
                </div>

                <div className="space-y-2.5 border-y border-[var(--border-hairline)] py-4 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[var(--text-muted)]">Vertical</span>
                    <span className="font-semibold text-[var(--text-primary)] text-right">
                      {approvedInfo.verticalTitle}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[var(--text-muted)]">Pacote</span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {approvedInfo.packageName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[var(--text-muted)]">Adicionais</span>
                    <span className="font-medium text-[var(--text-secondary)] text-right">
                      {approvedInfo.addons.length > 0
                        ? approvedInfo.addons.join(", ")
                        : "Nenhum"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-muted)]">
                      Data Reservada
                    </span>
                    <span className="font-mono-num font-semibold text-[var(--text-primary)]">
                      {formatDateBr(approvedInfo.eventDate)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-muted)]">Valor Total</span>
                    <span className="font-mono-num font-bold text-[var(--text-primary)]">
                      {formatCurrencyExact(approvedInfo.total)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-muted)]">Sinal (50%)</span>
                    <span className="font-mono-num font-bold text-emerald-400">
                      {formatCurrencyExact(approvedInfo.deposit)}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)]/50 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-[var(--accent)] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[var(--text-primary)]">
                        {approvedInfo.isPortrait
                          ? "Termo de Cessão de Uso de Imagem (PDF)"
                          : "Contrato de Prestação de Serviços (PDF)"}
                      </p>
                      <p className="mt-0.5 truncate font-mono-num text-[11px] text-[var(--text-secondary)]">
                        {approvedInfo.pdfFileName}
                      </p>
                    </div>
                  </div>
                  <a
                    href={approvedInfo.pdfUrl}
                    download={approvedInfo.pdfFileName}
                    className="btn-accent w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold"
                  >
                    <Download className="h-4 w-4" />
                    Baixar Documento em PDF
                  </a>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <>
            {/* Asymmetric Editorial Hero */}
            <section className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-end">
              <div className="lg:col-span-8 space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3.5 py-1.5 font-mono-num text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                  {currentVertical.kicker}
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-5xl leading-[1.08]">
                  Proposta Exclusiva para {lead.companyName}
                </h1>
                <p className="max-w-2xl text-sm sm:text-base leading-relaxed text-[var(--text-secondary)]">
                  {currentVertical.subheadline}
                </p>
              </div>

              <div className="lg:col-span-4">
                <div className="glass-panel rounded-3xl p-5 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[var(--text-muted)]">Cliente</span>
                    <span className="font-semibold text-[var(--text-primary)] truncate">
                      {lead.companyName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[var(--text-muted)]">Contato</span>
                    <span className="font-medium text-[var(--text-secondary)]">
                      {lead.contactName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[var(--text-muted)]">Atuação</span>
                    <span className="font-medium text-[var(--text-secondary)]">
                      BH &amp; Nova Lima — MG
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-[var(--border-hairline)] pt-2.5">
                    <span className="text-[var(--text-muted)]">Condição</span>
                    <span className="font-semibold text-[var(--accent)]">
                      50% reserva · 50% entrega
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Vertical Selector + 4 Vertical Pillars */}
            <section className="space-y-4">
              <div className="flex flex-wrap items-center gap-1.5 rounded-2xl p-1.5 glass-panel">
                {SERVICES_CATALOG.map((svc) => {
                  const active = svc.id === selectedVerticalId;
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => {
                        setSelectedVerticalId(svc.id);
                        setUseSocialModa(false);
                      }}
                      className={cn(
                        "rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer",
                        active
                          ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      )}
                    >
                      <span className="font-mono-num mr-1.5 opacity-75">
                        {svc.index}
                      </span>
                      {svc.shortLabel}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {currentVertical.pillars.map((p) => (
                  <div
                    key={p.num}
                    className="glass-panel rounded-2xl px-4 py-3.5"
                  >
                    <p className="font-mono-num text-[11px] font-bold text-[var(--accent)]">
                      {p.num}
                    </p>
                    <p className="mt-1 text-xs font-bold text-[var(--text-primary)]">
                      {p.label}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Interactive Packages + Addons + Sticky Dynamic Summary */}
            <section className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
              <div className="lg:col-span-8 space-y-8">
                {/* Packages */}
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="font-mono-num text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                        Passo 01 · {currentVertical.title}
                      </p>
                      <h2 className="mt-1 text-xl font-bold tracking-tight text-[var(--text-primary)]">
                        Selecione o pacote ideal para sua produção
                      </h2>
                    </div>

                    {selectedVerticalId === "moda" && (
                      <button
                        type="button"
                        onClick={() => setUseSocialModa((prev) => !prev)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all cursor-pointer self-start",
                          useSocialModa
                            ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                            : "btn-ghost text-[var(--text-secondary)]"
                        )}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        {useSocialModa
                          ? "Projeto Impulso Moda BH Ativo (65% OFF)"
                          : "Ver Cota Social Moda BH (65% OFF)"}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {activePackages.map((pkg) => {
                      const isSelected = selectedPackage.id === pkg.id;
                      return (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() => setSelectedPackageId(pkg.id)}
                          className={cn(
                            "relative flex flex-col justify-between rounded-3xl p-6 text-left transition-all cursor-pointer border",
                            isSelected
                              ? "bg-[var(--accent-soft)]/70 border-[var(--accent)] shadow-lg"
                              : "glass-panel hover:border-[var(--border-strong)]"
                          )}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono-num text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                                {pkg.tier}
                              </span>
                              {pkg.badge && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[var(--accent-fg)]">
                                  <Sparkles className="h-3 w-3" />
                                  {pkg.badge}
                                </span>
                              )}
                            </div>

                            <h3 className="mt-2 text-base font-extrabold text-[var(--text-primary)]">
                              {pkg.name}
                            </h3>
                            <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                              {pkg.format}
                            </p>

                            <div className="mt-5 flex items-baseline gap-2">
                              <span className="font-mono-num text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
                                {formatCurrency(pkg.price)}
                              </span>
                              {pkg.originalPrice && (
                                <span className="font-mono-num text-xs line-through text-[var(--text-muted)]">
                                  {formatCurrency(pkg.originalPrice)}
                                </span>
                              )}
                            </div>

                            <ul className="mt-5 space-y-2.5 border-t border-[var(--border-hairline)] pt-4">
                              {pkg.features.map((feat) => (
                                <li
                                  key={feat}
                                  className="flex items-start gap-2.5 text-xs text-[var(--text-secondary)]"
                                >
                                  <span
                                    className={cn(
                                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                                      isSelected
                                        ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                                        : "bg-[var(--bg-subtle)] text-[var(--accent)]"
                                    )}
                                  >
                                    <Check
                                      className="h-2.5 w-2.5"
                                      strokeWidth={3}
                                    />
                                  </span>
                                  <span>{feat}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="mt-6 pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between text-xs font-bold">
                            <span
                              className={
                                isSelected
                                  ? "text-[var(--accent)]"
                                  : "text-[var(--text-muted)]"
                              }
                            >
                              {isSelected
                                ? "Pacote selecionado"
                                : "Clique para selecionar"}
                            </span>
                            <span
                              className={cn(
                                "h-5 w-5 rounded-full border-2 flex items-center justify-center",
                                isSelected
                                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]"
                                  : "border-[var(--border-strong)]"
                              )}
                            >
                              {isSelected && (
                                <Check className="h-3 w-3" strokeWidth={3} />
                              )}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Add-ons */}
                <div className="space-y-4">
                  <div>
                    <p className="font-mono-num text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                      Passo 02 · Adicionais da Vertical (Opcional)
                    </p>
                    <h2 className="mt-1 text-xl font-bold tracking-tight text-[var(--text-primary)]">
                      Personalize o escopo da sua produção
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    {currentVertical.addons.map((addon) => {
                      const checked = selectedAddonIds.includes(addon.id);
                      return (
                        <label
                          key={addon.id}
                          className={cn(
                            "flex cursor-pointer items-start gap-3.5 rounded-3xl border p-5 transition-all",
                            checked
                              ? "border-[var(--accent)] bg-[var(--accent-soft)]/55"
                              : "glass-panel hover:border-[var(--border-strong)]"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAddon(addon.id)}
                            className="mt-1 h-4 w-4 rounded accent-[var(--accent)] cursor-pointer"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-bold text-[var(--text-primary)]">
                                {addon.name}
                              </span>
                              <span className="font-mono-num text-xs font-bold text-[var(--accent)] shrink-0">
                                +{formatCurrency(addon.price)}
                              </span>
                            </div>
                            <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                              {addon.description}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Differentials Bento Grid */}
                <div className="space-y-4 pt-2">
                  <div>
                    <p className="font-mono-num text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                      Posicionamento &amp; Método · 97% Clímax
                    </p>
                    <h2 className="mt-1 text-xl font-bold tracking-tight text-[var(--text-primary)]">
                      Padrão Técnico ÚLTIMO QUADRO
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    {DIFFERENTIALS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.title}
                          className="glass-panel rounded-3xl p-5 flex items-start gap-3.5"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                            <Icon className="h-5 w-5" strokeWidth={1.9} />
                          </div>
                          <div>
                            <h3 className="text-xs font-bold text-[var(--text-primary)]">
                              {item.title}
                            </h3>
                            <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                              {item.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right: Sticky Dynamic Pricing Summary (4 cols) */}
              <aside className="lg:col-span-4 lg:sticky lg:top-24">
                <div className="glass-panel rounded-3xl p-6 space-y-5">
                  <div>
                    <p className="font-mono-num text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--accent)]">
                      Investimento Transparente
                    </p>
                    <h3 className="mt-1 text-lg font-bold text-[var(--text-primary)]">
                      Resumo da Proposta
                    </h3>
                  </div>

                  <div className="space-y-3 border-y border-[var(--border-hairline)] py-4 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[var(--text-primary)]">
                        {selectedPackage.name}
                      </span>
                      <span className="font-mono-num font-semibold text-[var(--text-primary)]">
                        {formatCurrency(selectedPackage.price)}
                      </span>
                    </div>

                    {selectedAddons.map((addon) => (
                      <div
                        key={addon.id}
                        className="flex items-center justify-between gap-2 text-[var(--text-secondary)]"
                      >
                        <span>+ {addon.name}</span>
                        <span className="font-mono-num">
                          {formatCurrency(addon.price)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">
                        Valor Total
                      </span>
                      <span className="font-mono-num text-3xl font-extrabold text-[var(--text-primary)]">
                        {formatCurrencyExact(totalValue)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="rounded-2xl bg-[var(--accent-soft)] border border-[var(--accent-border)] p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)]">
                          Sinal (50% Reserva)
                        </p>
                        <p className="mt-1 font-mono-num text-sm font-extrabold text-[var(--text-primary)]">
                          {formatCurrencyExact(depositValue)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-[var(--bg-subtle)]/80 border border-[var(--border-hairline)] p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                          50% na Entrega
                        </p>
                        <p className="mt-1 font-mono-num text-sm font-bold text-[var(--text-secondary)]">
                          {formatCurrencyExact(depositValue)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowApprovalModal(true)}
                    className="btn-accent w-full inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-extrabold cursor-pointer"
                  >
                    <CheckCircle2 className="h-4.5 w-4.5" />
                    Aprovar Proposta e Reservar Data
                  </button>

                  <p className="text-center text-[11px] leading-relaxed text-[var(--text-muted)]">
                    Gera automaticamente o Contrato/Termo em PDF e o QR Code Pix
                    do sinal de 50% na hora · {BRAND_DEFAULTS.whatsappDisplay}
                  </p>
                </div>
              </aside>
            </section>
          </>
        )}
      </main>

      {/* Quick Approval & Reservation Modal */}
      {showApprovalModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setShowApprovalModal(false)}
        >
          <form
            onSubmit={handleApproveSubmit}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel w-full max-w-lg rounded-3xl bg-[var(--bg-surface-solid)] p-6 sm:p-7 space-y-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono-num text-[11px] font-bold uppercase tracking-wider text-[var(--accent)]">
                  Confirmação, PDF &amp; Pix Automático
                </p>
                <h3 className="mt-1 text-lg font-bold text-[var(--text-primary)]">
                  Aprovar Proposta e Reservar Data
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowApprovalModal(false)}
                className="btn-ghost flex h-8 w-8 items-center justify-center rounded-xl cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-2xl bg-[var(--bg-subtle)]/75 p-4 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">
                  {selectedPackage.name}
                  {selectedAddons.length > 0
                    ? ` + ${selectedAddons.length} adicional(is)`
                    : ""}
                </span>
                <span className="font-mono-num font-bold text-[var(--text-primary)]">
                  {formatCurrencyExact(totalValue)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[var(--accent)] font-semibold">
                <span>Sinal de reserva (50% via Pix)</span>
                <span className="font-mono-num">
                  {formatCurrencyExact(depositValue)}
                </span>
              </div>
            </div>

            {/* PJ / PF Switch */}
            <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-[var(--bg-subtle)] p-1 text-xs">
              <button
                type="button"
                onClick={() => setDocMode("cnpj")}
                className={cn(
                  "rounded-xl py-2 font-bold transition-all cursor-pointer",
                  docMode === "cnpj"
                    ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                    : "text-[var(--text-secondary)]"
                )}
              >
                Empresa (CNPJ · Contrato)
              </button>
              <button
                type="button"
                onClick={() => setDocMode("cpf")}
                className={cn(
                  "rounded-xl py-2 font-bold transition-all cursor-pointer",
                  docMode === "cpf"
                    ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                    : "text-[var(--text-secondary)]"
                )}
              >
                Pessoa Física (CPF · Termo)
              </button>
            </div>

            <div className="space-y-3.5">
              {docMode === "cpf" ? (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      required
                      value={razaoSocial}
                      onChange={(e) => setRazaoSocial(e.target.value)}
                      placeholder="Seu nome completo"
                      className="input-field w-full rounded-xl px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                      CPF (p/ Termo de Uso de Imagem) *
                    </label>
                    <input
                      type="text"
                      required
                      value={cpf}
                      onChange={(e) => setCpf(formatCpf(e.target.value))}
                      placeholder="000.000.000-00"
                      className="input-field w-full rounded-xl px-3.5 py-2.5 font-mono-num text-sm"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                      CNPJ da Empresa *
                    </label>
                    <input
                      type="text"
                      required
                      value={cnpj}
                      onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                      placeholder="00.000.000/0001-00"
                      className="input-field w-full rounded-xl px-3.5 py-2.5 font-mono-num text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                      Razão Social *
                    </label>
                    <input
                      type="text"
                      required
                      value={razaoSocial}
                      onChange={(e) => setRazaoSocial(e.target.value)}
                      placeholder="Razão Social Completa Ltda"
                      className="input-field w-full rounded-xl px-3.5 py-2.5 text-sm"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                  Data da Produção / Evento *
                </label>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="input-field w-full rounded-xl py-2.5 pl-10 pr-3.5 font-mono-num text-sm"
                  />
                </div>
              </div>
            </div>

            {errorMsg && (
              <p className="rounded-xl bg-rose-500/15 px-3.5 py-2 text-xs font-medium text-rose-400">
                {errorMsg}
              </p>
            )}

            <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowApprovalModal(false)}
                className="btn-ghost rounded-xl px-4 py-2.5 text-xs font-semibold cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-accent inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-extrabold disabled:opacity-60 cursor-pointer"
              >
                <QrCode className="h-4 w-4" />
                {submitting
                  ? "Gerando PDF & Pix..."
                  : "Confirmar, Gerar PDF & Pix"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
