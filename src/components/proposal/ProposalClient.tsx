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
  Film,
  MessageCircle,
  Moon,
  QrCode,
  ShieldCheck,
  Sun,
  Tag,
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
  embedded?: boolean;
  onApproved?: (updatedLead: Lead) => void;
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

const VERTICAL_STORYBOARD: Record<
  FunnelId,
  {
    lens: string;
    colorProfile: string;
    frames: Array<{ tc: string; title: string; detail: string }>;
  }
> = {
  corporativo: {
    lens: "35mm & 85mm f/1.4 · Dual Slot RAW",
    colorProfile: "4K 24FPS · Rec.709 Editorial + Áudio Lapela",
    frames: [
      {
        tc: "00:00:14:08",
        title: "Keynotes & Liderança",
        detail: "Enquadramento de autoridade no palco e reação da plateia.",
      },
      {
        tc: "00:01:42:19",
        title: "Networking & Cultura",
        detail: "Momentos espontâneos para Employer Branding e LinkedIn.",
      },
      {
        tc: "00:02:58:23",
        title: "Aftermovie Institucional 4K",
        detail: "Corte dinâmico com depoimentos e identidade da empresa.",
      },
    ],
  },
  estetica: {
    lens: "50mm & 85mm Prime · Luz Difusa Clean Skin",
    colorProfile: "4K Vertical · Fidelidade de Pele + Lapela Wireless",
    frames: [
      {
        tc: "00:00:03:00",
        title: "Hook de Retenção (3s)",
        detail: "Abertura magnética pensada para performance em Meta Ads.",
      },
      {
        tc: "00:00:28:12",
        title: "Procedimento & Detalhe",
        detail: "Close-ups limpos que transmitem biossegurança e alto padrão.",
      },
      {
        tc: "00:01:15:04",
        title: "Retrato de Autoridade",
        detail: "Direção de postura no consultório para feed e anúncios.",
      },
    ],
  },
  nightlife: {
    lens: "24mm & 35mm f/1.4 Low-Light + Flash Shutter Drag",
    colorProfile: "4K 60/24FPS · High-Contrast Cinema Club",
    frames: [
      {
        tc: "00:00:09:16",
        title: "Energia de Pista & DJ",
        detail: "Movimento de luz, atmosfera noturna e pista cheia.",
      },
      {
        tc: "00:01:19:02",
        title: "Coquetelaria & Público",
        detail: "Lifestyle espontâneo em alta nitidez sem estourar o ambiente.",
      },
      {
        tc: "00:02:11:22",
        title: "Aftermovie no Beat",
        detail: "Edição rítmica entregue em até 48h para impulsionar o próximo evento.",
      },
    ],
  },
  moda: {
    lens: "50mm & 85mm f/1.4 · Fidelidade de Cor & Textura",
    colorProfile: "4K Vertical · Color Checker Calibrado",
    frames: [
      {
        tc: "00:00:11:05",
        title: "Caimento em Movimento",
        detail: "Fashion Reels 4K destacando fluidez e corte de cada peça.",
      },
      {
        tc: "00:00:48:17",
        title: "Macro de Tecido & Acabamento",
        detail: "Detalhes de costura e aviamentos que valorizam o ticket da coleção.",
      },
      {
        tc: "00:01:36:20",
        title: "Spoiler no Mesmo Dia (6h)",
        detail: "10 a 15 fotos prontas no mesmo dia para lançamento imediato.",
      },
    ],
  },
  gastronomia: {
    lens: "50mm & 90mm Macro · Estúdio Portátil Dedicado",
    colorProfile: "4K Food Reels / ASMR · Otimização iFood + Alta Res",
    frames: [
      {
        tc: "00:00:06:14",
        title: "Hero Shot de Apetite",
        detail: "Iluminação lateral ressaltando brilho, vapor e frescor dos ingredientes.",
      },
      {
        tc: "00:00:34:09",
        title: "Preparo & Finalização (ASMR)",
        detail: "Corte, calda, brasa e coquetelaria em 4K para Reels de alta fome visual.",
      },
      {
        tc: "00:01:22:18",
        title: "Cardápio iFood & Ambiente",
        detail: "Arquivos calibrados para conversão no delivery e posicionamento da casa.",
      },
    ],
  },
};

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
  embedded = false,
  onApproved,
}: ProposalClientProps) {
  const { theme, toggleTheme } = useTheme();
  const trackedRef = useRef(false);

  const selectedVerticalId: FunnelId = lead.funnel;
  const [useSocialModa, setUseSocialModa] = useState(false);

  const currentVertical = useMemo(
    () => getServiceVertical(selectedVerticalId),
    [selectedVerticalId]
  );

  const storyboard = VERTICAL_STORYBOARD[selectedVerticalId];

  const activePackages = useMemo(() => {
    const basePackages =
      selectedVerticalId === "moda" && useSocialModa
        ? SOCIAL_MODA_PACKAGES
        : currentVertical.packages;

    if (lead.customProposal?.enabled && lead.customProposal.title) {
      const customPkg = {
        id: "custom_bespoke_scope",
        tier: "PROPOSTA SOB MEDIDA",
        name: lead.customProposal.title,
        format:
          lead.customProposal.subtitle ||
          `Escopo exclusivo desenhado para ${lead.companyName}`,
        price: Number(lead.customProposal.price) || lead.estimatedValue || 0,
        originalPrice: undefined as number | undefined,
        badge: "EXCLUSIVO",
        featured: true,
        features:
          lead.customProposal.deliverables.length > 0
            ? lead.customProposal.deliverables
            : ["Escopo customizado conforme briefing comercial"],
      };
      return [
        customPkg,
        ...basePackages.map((p) => ({ ...p, featured: false })),
      ];
    }

    return basePackages;
  }, [
    selectedVerticalId,
    useSocialModa,
    currentVertical,
    lead.customProposal,
    lead.companyName,
    lead.estimatedValue,
  ]);

  const [selectedPackageId, setSelectedPackageId] = useState<string>(
    activePackages[1]?.id ?? activePackages[0].id
  );
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);

  useEffect(() => {
    const featured = activePackages.find((p) => p.featured) ?? activePackages[0];
    setSelectedPackageId(featured.id);
    setSelectedAddonIds([]);
  }, [activePackages]);

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

  useEffect(() => {
    if (!showApprovalModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowApprovalModal(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showApprovalModal]);

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

  const quickQuestionWhatsappUrl = useMemo(() => {
    const addonNames = selectedAddons.map((a) => a.name);
    const addonsText =
      addonNames.length > 0 ? ` + ${addonNames.join(", ")}` : "";
    const msg = `Olá, equipe da ÚLTIMO QUADRO! Estou olhando a proposta da *${lead.companyName}* (${currentVertical.title}: *${selectedPackage.name}*${addonsText} · ${formatCurrencyExact(totalValue)}) e gostaria de alinhar um detalhe.`;
    return buildWhatsappUrl(studioWhatsapp, msg);
  }, [
    lead.companyName,
    currentVertical.title,
    selectedPackage.name,
    selectedAddons,
    totalValue,
    studioWhatsapp,
  ]);

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
          funnel: selectedVerticalId,
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
      if (json.lead && onApproved) {
        onApproved(json.lead as Lead);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setErrorMsg("Erro de conexão ao registrar aprovação. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={cn(embedded ? "pb-24 lg:pb-10" : "min-h-[100dvh] pb-28 lg:pb-20")}>
      {!embedded && <div className="cinema-grain" aria-hidden="true" />}

      {!embedded && (
        <header className="glass-bar sticky top-0 z-30 border-b border-[var(--border-hairline)]">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
            <BrandMark showTagline />

            <div className="flex items-center gap-2">
              <a
                href={quickQuestionWhatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="badge-success hidden sm:inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold hover:opacity-85"
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Falar no WhatsApp
              </a>
              <span className="badge-accent hidden md:inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-mono-num text-[11px] font-semibold">
                <Camera className="h-3 w-3" aria-hidden="true" />
                24FPS · PROPOSTA INTERATIVA
              </span>
              <button
                type="button"
                onClick={toggleTheme}
                className="btn-ghost flex h-10 w-10 items-center justify-center rounded-lg"
                aria-label={
                  theme === "dark"
                    ? "Mudar para modo claro"
                    : "Mudar para modo escuro"
                }
              >
                {theme === "dark" ? (
                  <Sun
                    className="h-4 w-4 text-[var(--accent-text)]"
                    aria-hidden="true"
                  />
                ) : (
                  <Moon
                    className="h-4 w-4 text-[var(--text-primary)]"
                    aria-hidden="true"
                  />
                )}
              </button>
            </div>
          </div>
        </header>
      )}

      <main className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 lg:px-8 space-y-10">
        {approvedInfo ? (
          <section className="space-y-6">
            <div className="surface-card viewfinder-frame rounded-xl border border-[var(--status-success-border)] p-6 sm:p-8 space-y-3">
              <div className="badge-success inline-flex items-center gap-2 rounded-md px-3 py-1 text-xs font-bold uppercase tracking-wider">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
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
              <div className="surface-card rounded-xl p-6 sm:p-8 lg:col-span-7 space-y-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-text)]">
                      <QrCode className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <h2 className="text-base font-bold text-[var(--text-primary)]">
                        Pix Copia e Cola (Sinal de 50%)
                      </h2>
                      <p className="text-xs text-[var(--text-muted)]">
                        Padrão BR Code / EMV · {approvedInfo.pix.recipientName} ·{" "}
                        {approvedInfo.pix.city}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono-num text-xl font-extrabold text-[var(--status-success)]">
                    {formatCurrencyExact(approvedInfo.pix.depositAmount)}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-12 sm:items-center">
                  <div className="sm:col-span-5 flex justify-center">
                    <div className="rounded-xl bg-white p-3.5 shadow-lg border border-zinc-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={approvedInfo.pix.qrDataUrl}
                        alt="QR Code Pix para pagamento do sinal de 50%"
                        width={192}
                        height={192}
                        className="h-48 w-48 object-contain"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-7 space-y-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                        Código Pix Copia e Cola
                      </p>
                      <div className="rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-hairline)] p-3 font-mono-num text-[11px] leading-relaxed text-[var(--text-secondary)] break-all max-h-28 overflow-y-auto select-all">
                        {approvedInfo.pix.copyPaste}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2.5 sm:flex-row">
                      <button
                        type="button"
                        onClick={handleCopyPix}
                        className="btn-accent flex-1 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 py-3 text-xs font-extrabold"
                      >
                        {copiedPix ? (
                          <>
                            <Check className="h-4 w-4" aria-hidden="true" />
                            Código Pix Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" aria-hidden="true" />
                            Copiar Código Pix
                          </>
                        )}
                      </button>

                      <a
                        href={approvedInfo.whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-xs font-extrabold text-white hover:bg-emerald-500 transition-colors"
                      >
                        <MessageCircle className="h-4 w-4" aria-hidden="true" />
                        Enviar Comprovante no WhatsApp
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <div className="surface-card rounded-xl p-6 space-y-5 lg:col-span-5">
                <div>
                  <p className="font-mono-num text-[11px] font-bold uppercase tracking-wider text-[var(--accent-text)]">
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
                    <span className="font-mono-num font-bold text-[var(--status-success)]">
                      {formatCurrencyExact(approvedInfo.deposit)}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <FileText
                      className="h-5 w-5 text-[var(--accent-text)] shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
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
                    className="btn-accent w-full inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-extrabold"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Baixar Documento em PDF
                  </a>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <>
            {/* Editorial Hero */}
            <section className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-end">
              <div className="lg:col-span-8 space-y-4">
                <div className="inline-flex items-center gap-2 rounded-md border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3.5 py-1.5 font-mono-num text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
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
                <div className="surface-card viewfinder-frame rounded-xl p-5 space-y-2.5 text-xs">
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
                      BH &amp; Nova Lima (MG)
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-[var(--border-hairline)] pt-2.5">
                    <span className="text-[var(--text-muted)]">Condição</span>
                    <span className="font-semibold text-[var(--accent-text)]">
                      50% reserva · 50% entrega
                    </span>
                  </div>
                  {lead.proposalValidUntil && (
                    <div className="flex items-center justify-between border-t border-[var(--border-hairline)] pt-2.5">
                      <span className="text-[var(--text-muted)]">
                        Validade da Proposta
                      </span>
                      <span className="badge-warning rounded-md px-2 py-0.5 font-mono-num text-[11px] font-bold">
                        Até {formatDateBr(lead.proposalValidUntil)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Exclusive Cinema 24FPS Storyboard Showcase (Locked to Client Vertical) */}
            <section className="space-y-4">
              {/* Cinema Storyboard & Technical Direction Strip */}
              <div className="surface-card rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-3">
                  <div className="flex items-center gap-2 text-xs">
                    <Aperture
                      className="h-4 w-4 text-[var(--accent-text)]"
                      aria-hidden="true"
                    />
                    <span className="font-bold text-[var(--text-primary)]">
                      Direção de Fotografia &amp; Storyboard 24FPS
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 font-mono-num text-[11px] text-[var(--text-secondary)]">
                    <span className="rounded-md bg-[var(--bg-subtle)] px-2.5 py-1">
                      {storyboard.lens}
                    </span>
                    <span className="rounded-md bg-[var(--bg-subtle)] px-2.5 py-1 text-[var(--accent-text)]">
                      {storyboard.colorProfile}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {storyboard.frames.map((frame, fIdx) => (
                    <div
                      key={frame.tc}
                      className="viewfinder-frame rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-4 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between font-mono-num text-[10px] text-[var(--text-muted)]">
                          <span>FRAME 0{fIdx + 1}</span>
                          <span className="text-[var(--accent-text)]">
                            TC {frame.tc}
                          </span>
                        </div>
                        <p className="mt-2 text-xs font-bold text-[var(--text-primary)]">
                          {frame.title}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                          {frame.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 pt-1">
                  {currentVertical.pillars.map((p) => (
                    <div
                      key={p.num}
                      className="rounded-lg bg-[var(--bg-subtle)] px-3.5 py-2.5 border border-[var(--border-hairline)]"
                    >
                      <p className="font-mono-num text-[10px] font-bold text-[var(--accent-text)]">
                        {p.num}
                      </p>
                      <p className="mt-0.5 text-xs font-bold text-[var(--text-primary)]">
                        {p.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Interactive Packages + Addons + Sticky Dynamic Summary */}
            <section className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
              <div className="lg:col-span-8 space-y-8">
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="font-mono-num text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-text)]">
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
                        aria-pressed={useSocialModa}
                        className={cn(
                          "inline-flex min-h-[42px] items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-bold transition-colors self-start",
                          useSocialModa
                            ? "badge-accent"
                            : "btn-ghost text-[var(--text-secondary)]"
                        )}
                      >
                        <Tag className="h-3.5 w-3.5" aria-hidden="true" />
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
                          aria-pressed={isSelected}
                          className={cn(
                            "relative flex flex-col justify-between rounded-xl p-6 text-left transition-colors border",
                            isSelected
                              ? "viewfinder-frame bg-[var(--accent-soft)] border-[var(--accent-border)]"
                              : "surface-card hover:border-[var(--border-strong)]"
                          )}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono-num text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                                {pkg.tier}
                              </span>
                              {pkg.badge && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-btn)] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[var(--accent-fg)]">
                                  <Award
                                    className="h-3 w-3"
                                    aria-hidden="true"
                                  />
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
                                        ? "bg-[var(--accent-btn)] text-[var(--accent-fg)]"
                                        : "bg-[var(--bg-subtle)] text-[var(--accent-text)]"
                                    )}
                                  >
                                    <Check
                                      className="h-2.5 w-2.5"
                                      strokeWidth={3}
                                      aria-hidden="true"
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
                                  ? "text-[var(--accent-text)]"
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
                                  ? "border-[var(--accent-btn)] bg-[var(--accent-btn)] text-[var(--accent-fg)]"
                                  : "border-[var(--border-strong)]"
                              )}
                            >
                              {isSelected && (
                                <Check
                                  className="h-3 w-3"
                                  strokeWidth={3}
                                  aria-hidden="true"
                                />
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
                    <p className="font-mono-num text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-text)]">
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
                            "flex cursor-pointer items-start gap-3.5 rounded-xl border p-5 transition-colors",
                            checked
                              ? "border-[var(--accent-border)] bg-[var(--accent-soft)]"
                              : "surface-card hover:border-[var(--border-strong)]"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAddon(addon.id)}
                            className="mt-1 h-4 w-4 rounded accent-[var(--accent)]"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-bold text-[var(--text-primary)]">
                                {addon.name}
                              </span>
                              <span className="font-mono-num text-xs font-bold text-[var(--accent-text)] shrink-0">
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

                {/* Differentials */}
                <div className="space-y-4 pt-2">
                  <div>
                    <p className="font-mono-num text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-text)]">
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
                          className="surface-card rounded-xl p-5 flex items-start gap-3.5"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-text)]">
                            <Icon
                              className="h-5 w-5"
                              strokeWidth={1.9}
                              aria-hidden="true"
                            />
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

              {/* Right: Sticky Dynamic Pricing Summary */}
              <aside className="lg:col-span-4 lg:sticky lg:top-24">
                <div className="surface-card viewfinder-frame rounded-xl p-6 space-y-5">
                  <div>
                    <p className="font-mono-num text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--accent-text)]">
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
                      <div className="rounded-lg bg-[var(--accent-soft)] border border-[var(--accent-border)] p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-text)]">
                          Sinal (50% Reserva)
                        </p>
                        <p className="mt-1 font-mono-num text-sm font-extrabold text-[var(--text-primary)]">
                          {formatCurrencyExact(depositValue)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-hairline)] p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                          50% na Entrega
                        </p>
                        <p className="mt-1 font-mono-num text-sm font-bold text-[var(--text-secondary)]">
                          {formatCurrencyExact(depositValue)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <button
                      type="button"
                      onClick={() => setShowApprovalModal(true)}
                      className="btn-accent w-full inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg px-5 py-3.5 text-sm font-extrabold"
                    >
                      <CheckCircle2 className="h-4.5 w-4.5" aria-hidden="true" />
                      Aprovar Proposta e Reservar Data
                    </button>

                    <a
                      href={quickQuestionWhatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ghost w-full inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold text-[var(--status-success)]"
                    >
                      <MessageCircle className="h-4 w-4" aria-hidden="true" />
                      Tirar dúvida rápida no WhatsApp
                    </a>
                  </div>

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

      {/* Fixed Mobile Conversion Bottom Bar */}
      {!approvedInfo && (
        <div className="glass-bar safe-bottom fixed bottom-0 inset-x-0 z-30 border-t border-[var(--border-hairline)] px-4 pt-2.5 lg:hidden">
          <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-[var(--text-primary)]">
                {selectedPackage.name}
              </p>
              <p className="font-mono-num text-[11px] text-[var(--text-secondary)]">
                Total:{" "}
                <strong className="text-[var(--text-primary)]">
                  {formatCurrency(totalValue)}
                </strong>{" "}
                · Sinal:{" "}
                <span className="text-[var(--accent-text)] font-bold">
                  {formatCurrency(depositValue)}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a
                href={quickQuestionWhatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="badge-success flex h-11 w-11 items-center justify-center rounded-lg"
                aria-label="Tirar dúvida no WhatsApp"
                title="Tirar dúvida no WhatsApp"
              >
                <MessageCircle className="h-4.5 w-4.5" aria-hidden="true" />
              </a>
              <button
                type="button"
                onClick={() => setShowApprovalModal(true)}
                className="btn-accent inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-extrabold"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Reservar Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Approval & Reservation Modal */}
      {showApprovalModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setShowApprovalModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="approval-modal-title"
        >
          <form
            onSubmit={handleApproveSubmit}
            onClick={(e) => e.stopPropagation()}
            className="modal-surface w-full max-w-lg rounded-xl p-6 sm:p-7 space-y-5 max-h-[92dvh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono-num text-[11px] font-bold uppercase tracking-wider text-[var(--accent-text)]">
                  Confirmação, PDF &amp; Pix Automático
                </p>
                <h3
                  id="approval-modal-title"
                  className="mt-1 text-lg font-bold text-[var(--text-primary)]"
                >
                  Aprovar Proposta e Reservar Data
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowApprovalModal(false)}
                className="btn-ghost flex h-10 w-10 items-center justify-center rounded-lg"
                aria-label="Fechar modal de aprovação"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="rounded-lg bg-[var(--bg-subtle)] p-4 text-xs space-y-1">
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
              <div className="flex items-center justify-between text-[var(--accent-text)] font-semibold">
                <span>Sinal de reserva (50% via Pix)</span>
                <span className="font-mono-num">
                  {formatCurrencyExact(depositValue)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-[var(--bg-subtle)] p-1 text-xs">
              <button
                type="button"
                onClick={() => setDocMode("cnpj")}
                aria-pressed={docMode === "cnpj"}
                className={cn(
                  "min-h-[40px] rounded-md py-2 font-bold transition-colors",
                  docMode === "cnpj"
                    ? "bg-[var(--accent-btn)] text-[var(--accent-fg)]"
                    : "text-[var(--text-secondary)]"
                )}
              >
                Empresa (CNPJ · Contrato)
              </button>
              <button
                type="button"
                onClick={() => setDocMode("cpf")}
                aria-pressed={docMode === "cpf"}
                className={cn(
                  "min-h-[40px] rounded-md py-2 font-bold transition-colors",
                  docMode === "cpf"
                    ? "bg-[var(--accent-btn)] text-[var(--accent-fg)]"
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
                    <label
                      htmlFor="approve-pf-name"
                      className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5"
                    >
                      Nome Completo *
                    </label>
                    <input
                      id="approve-pf-name"
                      type="text"
                      required
                      value={razaoSocial}
                      onChange={(e) => setRazaoSocial(e.target.value)}
                      placeholder="Seu nome completo"
                      className="input-field min-h-[44px] w-full rounded-lg px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="approve-pf-cpf"
                      className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5"
                    >
                      CPF (p/ Termo de Uso de Imagem) *
                    </label>
                    <input
                      id="approve-pf-cpf"
                      type="text"
                      required
                      value={cpf}
                      onChange={(e) => setCpf(formatCpf(e.target.value))}
                      placeholder="000.000.000-00"
                      className="input-field min-h-[44px] w-full rounded-lg px-3.5 py-2.5 font-mono-num text-sm"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label
                      htmlFor="approve-pj-cnpj"
                      className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5"
                    >
                      CNPJ da Empresa *
                    </label>
                    <input
                      id="approve-pj-cnpj"
                      type="text"
                      required
                      value={cnpj}
                      onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                      placeholder="00.000.000/0001-00"
                      className="input-field min-h-[44px] w-full rounded-lg px-3.5 py-2.5 font-mono-num text-sm"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="approve-pj-razao"
                      className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5"
                    >
                      Razão Social *
                    </label>
                    <input
                      id="approve-pj-razao"
                      type="text"
                      required
                      value={razaoSocial}
                      onChange={(e) => setRazaoSocial(e.target.value)}
                      placeholder="Razão Social Completa Ltda"
                      className="input-field min-h-[44px] w-full rounded-lg px-3.5 py-2.5 text-sm"
                    />
                  </div>
                </>
              )}

              <div>
                <label
                  htmlFor="approve-event-date"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5"
                >
                  Data da Produção / Evento *
                </label>
                <div className="relative">
                  <Calendar
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
                    aria-hidden="true"
                  />
                  <input
                    id="approve-event-date"
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="input-field min-h-[44px] w-full rounded-lg py-2.5 pl-10 pr-3.5 font-mono-num text-sm"
                  />
                </div>
              </div>
            </div>

            {errorMsg && (
              <p
                role="alert"
                className="badge-danger rounded-lg px-3.5 py-2.5 text-xs font-medium"
              >
                {errorMsg}
              </p>
            )}

            <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowApprovalModal(false)}
                className="btn-ghost min-h-[44px] rounded-lg px-4 py-2.5 text-xs font-semibold"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-accent inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-xs font-extrabold disabled:opacity-60"
              >
                <QrCode className="h-4 w-4" aria-hidden="true" />
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
