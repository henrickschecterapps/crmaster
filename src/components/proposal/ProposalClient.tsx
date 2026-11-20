"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Aperture,
  Award,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileCheck2,
  FileText,
  MessageCircle,
  Moon,
  QrCode,
  ShieldCheck,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import { Lead, PROPOSAL_ADDONS, PROPOSAL_PACKAGES } from "@/types/crm";
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

interface ProposalClientProps {
  lead: Lead;
  studioWhatsapp: string;
}

interface ApprovedConfirmationData {
  whatsappUrl: string;
  total: number;
  deposit: number;
  packageName: string;
  addons: string[];
  eventDate: string;
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
    icon: Award,
    title: "Foco em Employer Branding",
    description:
      "Direção documental e retratos estratégicos pensados para fortalecer sua marca empregadora no LinkedIn, imprensa e endomarketing.",
  },
  {
    icon: ShieldCheck,
    title: "Equipamento Full-Frame com Backup Duplo",
    description:
      "Câmeras profissionais full-frame com gravação simultânea em dois cartões de memória e backup em nuvem logo após o evento.",
  },
  {
    icon: Clock,
    title: "Prévia Express em 24h",
    description:
      "15 fotos curadas e tratadas entregues no dia seguinte para o time de RH e Comunicação publicar enquanto o evento ainda repercute.",
  },
  {
    icon: FileCheck2,
    title: "Emissão de Nota Fiscal (NF-e)",
    description:
      "Atendimento 100% formalizado para empresas de BH com contrato digital, NF-e de serviços e pagamento facilitado (PIX ou boleto).",
  },
];

export function ProposalClient({
  lead,
  studioWhatsapp,
}: ProposalClientProps) {
  const { theme, toggleTheme } = useTheme();
  const trackedRef = useRef(false);
  const isPortrait = lead.funnel === "retratos_lifestyle";

  const [selectedPackageId, setSelectedPackageId] = useState<string>(
    "corporate_prime"
  );
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);

  // Approval modal state
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [cnpj, setCnpj] = useState(lead.cnpj || "");
  const [cpf, setCpf] = useState(lead.cpf || "");
  const [razaoSocial, setRazaoSocial] = useState(
    isPortrait
      ? lead.contactName || lead.companyName
      : lead.razaoSocial || lead.companyName
  );
  const [eventDate, setEventDate] = useState(lead.eventDate || "");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [approvedInfo, setApprovedInfo] =
    useState<ApprovedConfirmationData | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);

  // Automatic open tracking + Real-time Radar alert (with 10-min debounce on server)
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
      PROPOSAL_PACKAGES.find((p) => p.id === selectedPackageId) ??
      PROPOSAL_PACKAGES[1],
    [selectedPackageId]
  );

  const selectedAddons = useMemo(
    () => PROPOSAL_ADDONS.filter((a) => selectedAddonIds.includes(a.id)),
    [selectedAddonIds]
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

      const confirmationMessage = `Olá Henrique! Acabamos de aprovar a proposta online para *${lead.companyName}* e segue o comprovante do sinal de 50% via Pix.

*Resumo da Reserva:*
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
        packageName: selectedPackage.name,
        addons: addonNames,
        eventDate,
        pdfUrl: json.pdfUrl || `/api/proposals/${lead.id}/pdf`,
        pdfFileName: json.pdfFileName || "Contrato-Henrique-Matos.pdf",
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
      {/* Minimal Studio Header */}
      <header className="sticky top-0 z-30 border-b border-[var(--border-hairline)] bg-[var(--bg-canvas)]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--accent-fg)]">
              <Aperture className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-sm font-extrabold tracking-tight text-[var(--text-primary)]">
                Henrique Matos
              </p>
              <p className="text-[11px] font-medium text-[var(--text-muted)]">
                Fotografia &amp; Audiovisual Corporativo · Belo Horizonte
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--accent)]">
              <Camera className="h-3 w-3" />
              Proposta Interativa
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
        {/* PHASE 2: Dedicated Confirmation Screen with Static Pix BR Code + Contract PDF Download */}
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
                Seu {isPortrait ? "Termo de Uso de Imagem" : "Contrato de Prestação de Serviços"}{" "}
                já foi gerado em PDF. Para efetivar o bloqueio exclusivo da data{" "}
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

              {/* Right: Summary & Instant PDF Contract Download (5 cols) */}
              <div className="glass-panel rounded-3xl p-6 space-y-5 lg:col-span-5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent)]">
                    Resumo &amp; Documentação
                  </p>
                  <h3 className="mt-1 text-base font-bold text-[var(--text-primary)]">
                    Detalhes da Reserva
                  </h3>
                </div>

                <div className="space-y-2.5 border-y border-[var(--border-hairline)] py-4 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-muted)]">Pacote</span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {approvedInfo.packageName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
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

                {/* Instant PDF Download Card */}
                <div className="rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)]/50 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-[var(--accent)] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[var(--text-primary)]">
                        {isPortrait
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
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                  Preparada especialmente para {lead.contactName}
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-5xl leading-[1.08]">
                  Proposta Exclusiva para {lead.companyName}
                </h1>
                <p className="max-w-2xl text-base leading-relaxed text-[var(--text-secondary)]">
                  Cobertura fotográfica e audiovisual de alto padrão em Belo
                  Horizonte desenhada para transformar seu projeto em ativos
                  reais de marca, Employer Branding e comunicação institucional.
                </p>
              </div>

              <div className="lg:col-span-4">
                <div className="glass-panel rounded-3xl p-5 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-muted)]">Cliente</span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {lead.companyName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-muted)]">Contato</span>
                    <span className="font-medium text-[var(--text-secondary)]">
                      {lead.contactName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-muted)]">Praça</span>
                    <span className="font-medium text-[var(--text-secondary)]">
                      Belo Horizonte, MG
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

            {/* Differentials Bento Grid */}
            <section className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                  Padrão de Entrega Corporativa
                </p>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-[var(--text-primary)] sm:text-2xl">
                  Por que empresas de BH escolhem o Estúdio Henrique Matos
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {DIFFERENTIALS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.title}
                      className="glass-panel rounded-3xl p-6 flex items-start gap-4"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                        <Icon className="h-5 w-5" strokeWidth={1.9} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[var(--text-primary)]">
                          {item.title}
                        </h3>
                        <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Interactive Packages + Addons + Sticky Dynamic Summary */}
            <section className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
              <div className="lg:col-span-8 space-y-8">
                {/* Packages */}
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                      Passo 1 · Escolha seu Pacote
                    </p>
                    <h2 className="mt-1 text-xl font-bold tracking-tight text-[var(--text-primary)]">
                      Selecione o formato ideal para o seu evento
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {PROPOSAL_PACKAGES.map((pkg) => {
                      const isSelected = selectedPackageId === pkg.id;
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
                              <span className="text-base font-extrabold text-[var(--text-primary)]">
                                {pkg.name}
                              </span>
                              {pkg.badge && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[var(--accent-fg)]">
                                  <Sparkles className="h-3 w-3" />
                                  {pkg.badge}
                                </span>
                              )}
                            </div>

                            <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                              {pkg.summary}
                            </p>

                            <div className="mt-5 flex items-baseline gap-1.5">
                              <span className="font-mono-num text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
                                {formatCurrency(pkg.price)}
                              </span>
                              <span className="text-xs text-[var(--text-muted)]">
                                / evento
                              </span>
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
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                      Passo 2 · Personalize com Adicionais
                    </p>
                    <h2 className="mt-1 text-xl font-bold tracking-tight text-[var(--text-primary)]">
                      Turbine a cobertura do seu evento (opcional)
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    {PROPOSAL_ADDONS.map((addon) => {
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
              </div>

              {/* Right: Sticky Dynamic Pricing Summary (4 cols) */}
              <aside className="lg:col-span-4 lg:sticky lg:top-24">
                <div className="glass-panel rounded-3xl p-6 space-y-5">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--accent)]">
                      Investimento Personalizado
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
                    Gera automaticamente o{" "}
                    {isPortrait
                      ? "Termo de Uso de Imagem em PDF"
                      : "Contrato em PDF"}{" "}
                    e o QR Code Pix do sinal de 50% na hora.
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setShowApprovalModal(false)}
        >
          <form
            onSubmit={handleApproveSubmit}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel w-full max-w-lg rounded-3xl bg-[var(--bg-surface-solid)] p-6 sm:p-7 space-y-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent)]">
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

            <div className="space-y-3.5">
              {isPortrait ? (
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
                  {isPortrait ? "Data do Ensaio *" : "Data do Evento *"}
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
                  : "Confirmar, Gerar Contrato & Pix"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
