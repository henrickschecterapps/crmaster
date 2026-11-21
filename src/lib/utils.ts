import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  FunnelId,
  FUNNELS,
  Lead,
  normalizeFunnelId,
  Partner,
  PostSaleChecklistItem,
  StageId,
  STAGES,
} from "@/types/crm";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

export function formatCurrencyExact(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function formatWhatsappNumber(phone: string): string {
  const digits = normalizePhone(phone);
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  return `55${digits}`;
}

export function buildWhatsappUrl(phone: string, message: string): string {
  const number = formatWhatsappNumber(phone);
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${number}?text=${encoded}`;
}

export function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export function formatPhoneBr(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function exportLeadsToCsv(leads: Lead[], partners: Partner[]): string {
  const partnerMap = new Map(partners.map((p) => [p.id, p]));
  const escape = (val: string | number | boolean | null | undefined) => {
    const str = String(val ?? "").replaceAll('"', '""');
    return `"${str}"`;
  };

  const headers = [
    "ID",
    "Empresa",
    "Contato",
    "Telefone",
    "Email",
    "Instagram",
    "Vertical",
    "Etapa",
    "Valor Estimado (R$)",
    "Faturamento Confirmado (R$)",
    "Status Pagamento",
    "Parceiro",
    "Comissao 15% (R$)",
    "Comissao Paga",
    "Data Evento",
    "Criado Em",
  ];

  const rows = leads.map((lead) => {
    const partner = lead.partnerId ? partnerMap.get(lead.partnerId) : undefined;
    const confirmed = getConfirmedRevenue(lead);
    const commission = getPartnerCommission(lead, partners);
    return [
      lead.id,
      lead.companyName,
      lead.contactName,
      lead.phone,
      lead.email,
      lead.instagram || "",
      getFunnelLabel(lead.funnel),
      getStageLabel(lead.stage),
      lead.estimatedValue.toFixed(2).replace(".", ","),
      confirmed.toFixed(2).replace(".", ","),
      lead.paymentStatus,
      partner ? partner.name : "",
      commission.toFixed(2).replace(".", ","),
      lead.commissionPaid ? "Sim" : "Nao",
      lead.eventDate || "",
      formatDateBr(lead.createdAt),
    ]
      .map(escape)
      .join(";");
  });

  return `\uFEFF${[headers.map(escape).join(";"), ...rows].join("\n")}`;
}

export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export type StagnationLevel = "none" | "warning" | "critical";

export interface StagnationInfo {
  level: StagnationLevel;
  hoursSince: number;
  label: string;
}

export function getLeadStagnation(
  lead: Pick<Lead, "stage" | "ultimaInteracaoEm">,
  nowMs: number = Date.now()
): StagnationInfo {
  const lastMs = new Date(lead.ultimaInteracaoEm).getTime();
  const hoursSince = Math.max(0, (nowMs - lastMs) / (1000 * 60 * 60));

  if (lead.stage === "fechado") {
    return { level: "none", hoursSince, label: "Concluído" };
  }

  if (hoursSince >= 120) {
    const days = Math.floor(hoursSince / 24);
    return {
      level: "critical",
      hoursSince,
      label: `${days}d sem contato`,
    };
  }

  if (hoursSince >= 48) {
    const hours = Math.floor(hoursSince);
    const days = Math.floor(hours / 24);
    return {
      level: "warning",
      hoursSince,
      label: days >= 2 ? `${days}d sem contato` : `${hours}h sem contato`,
    };
  }

  return { level: "none", hoursSince, label: "Em dia" };
}

export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;
  if (diffHours < 24) return `há ${diffHours}h`;
  if (diffDays === 1) return "há 1 dia";
  return `há ${diffDays} dias`;
}

export function formatDateTimeBr(isoDate: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoDate));
}

export function formatDateBr(isoOrYmd: string): string {
  if (!isoOrYmd) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrYmd)) {
    const [y, m, d] = isoOrYmd.split("-");
    return `${d}/${m}/${y}`;
  }
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(isoOrYmd));
}

export function getConfirmedRevenue(lead: Lead): number {
  if (lead.paymentStatus === "quitado" || lead.stage === "fechado") {
    return lead.estimatedValue;
  }
  if (lead.paymentStatus === "sinal_pago" || lead.stage === "sinal_pago") {
    return lead.estimatedValue * 0.5;
  }
  return 0;
}

export function getPartnerCommission(lead: Lead, partners: Partner[]): number {
  if (!lead.partnerId) return 0;
  const partner = partners.find((p) => p.id === lead.partnerId);
  const rate = partner ? partner.commissionRate : 15;
  return lead.estimatedValue * (rate / 100);
}

export function interpolateTemplate(
  template: string,
  variables: {
    nome_contato: string;
    nome_empresa: string;
    link_proposta: string;
    proxima_data_livre: string;
  }
): string {
  return template
    .replaceAll("{{nome_contato}}", variables.nome_contato)
    .replaceAll("{{nome_empresa}}", variables.nome_empresa)
    .replaceAll("{{link_proposta}}", variables.link_proposta)
    .replaceAll("{{proxima_data_livre}}", variables.proxima_data_livre);
}

export function getFunnelLabel(funnelId: FunnelId | string): string {
  const normalized = normalizeFunnelId(funnelId);
  return FUNNELS.find((f) => f.id === normalized)?.label ?? normalized;
}

export function getStageLabel(stageId: StageId): string {
  return STAGES.find((s) => s.id === stageId)?.label ?? stageId;
}

export function generateId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const ts = Date.now().toString(36).slice(-4);
  return `${prefix}-${ts}${rand}`;
}

function addDaysYmd(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function addBusinessDaysYmd(base: Date, businessDays: number): string {
  const d = new Date(base);
  let added = 0;
  while (added < businessDays) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return d.toISOString().slice(0, 10);
}

function addMonthsYmd(base: Date, months: number): string {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function buildPostSaleChecklist(
  rawFunnel: FunnelId | string,
  referenceDateIso?: string
): PostSaleChecklistItem[] {
  const funnel = normalizeFunnelId(rawFunnel);
  const base = referenceDateIso ? new Date(referenceDateIso) : new Date();
  if (Number.isNaN(base.getTime())) {
    base.setTime(Date.now());
  }

  if (funnel === "moda") {
    return [
      {
        id: generateId("chk"),
        title: "Entregar Spoiler Express (10–15 fotos no mesmo dia)",
        dueDate: addDaysYmd(base, 0),
        completed: false,
        category: "entrega",
      },
      {
        id: generateId("chk"),
        title: "Entregar galeria completa e Fashion Reels 4K (+2 dias úteis)",
        dueDate: addBusinessDaysYmd(base, 2),
        completed: false,
        category: "entrega",
      },
      {
        id: generateId("chk"),
        title: "Alerta de Recompra / Novo Drop de Coleção (+15 dias)",
        dueDate: addDaysYmd(base, 15),
        completed: false,
        category: "recorrencia",
      },
    ];
  }

  if (funnel === "estetica") {
    return [
      {
        id: generateId("chk"),
        title: "Enviar Prévia Expressa de 12 fotos Clean Skin (+1 dia)",
        dueDate: addDaysYmd(base, 1),
        completed: false,
        category: "entrega",
      },
      {
        id: generateId("chk"),
        title: "Entregar 70 fotos + Reels & Criativos 4K Meta Ads (+3 dias úteis)",
        dueDate: addBusinessDaysYmd(base, 3),
        completed: false,
        category: "entrega",
      },
      {
        id: generateId("chk"),
        title: "Pedir depoimento no Google (+5 dias)",
        dueDate: addDaysYmd(base, 5),
        completed: false,
        category: "prova_social",
      },
      {
        id: generateId("chk"),
        title: "Ofertar Plano Trimestral de Criativos Ads (+75 dias)",
        dueDate: addDaysYmd(base, 75),
        completed: false,
        category: "recorrencia",
      },
    ];
  }

  if (funnel === "nightlife") {
    return [
      {
        id: generateId("chk"),
        title: "Enviar Prévia Expressa de 15 fotos até 14h (+1 dia)",
        dueDate: addDaysYmd(base, 1),
        completed: false,
        category: "entrega",
      },
      {
        id: generateId("chk"),
        title: "Entregar Galeria Completa + Aftermovie 4K no beat (+48h)",
        dueDate: addDaysYmd(base, 2),
        completed: false,
        category: "entrega",
      },
      {
        id: generateId("chk"),
        title: "Propor Plano Residente Mensal (4 ou 8 noites/mês) (+20 dias)",
        dueDate: addDaysYmd(base, 20),
        completed: false,
        category: "recorrencia",
      },
    ];
  }

  if (funnel === "gastronomia") {
    return [
      {
        id: generateId("chk"),
        title: "Enviar Prévia Expressa de 10 fotos (+1 dia)",
        dueDate: addDaysYmd(base, 1),
        completed: false,
        category: "entrega",
      },
      {
        id: generateId("chk"),
        title: "Entregar Galeria Alta Res + otimizada iFood & Food Reels (+3 dias úteis)",
        dueDate: addBusinessDaysYmd(base, 3),
        completed: false,
        category: "entrega",
      },
      {
        id: generateId("chk"),
        title: "Pedir avaliação no Google (+5 dias)",
        dueDate: addDaysYmd(base, 5),
        completed: false,
        category: "prova_social",
      },
      {
        id: generateId("chk"),
        title: "Alerta de Recorrência: Novo Cardápio / Assinatura Mensal (+60 dias)",
        dueDate: addDaysYmd(base, 60),
        completed: false,
        category: "recorrencia",
      },
    ];
  }

  // Corporativo 360° (default)
  return [
    {
      id: generateId("chk"),
      title: "Enviar Prévia Expressa de 15 fotos até as 10h (+1 dia)",
      dueDate: addDaysYmd(base, 1),
      completed: false,
      category: "entrega",
    },
    {
      id: generateId("chk"),
      title: "Emitir NFS-e e cobrar 50% finais (+1 dia útil)",
      dueDate: addBusinessDaysYmd(base, 1),
      completed: false,
      category: "financeiro",
    },
    {
      id: generateId("chk"),
      title: "Entregar galeria completa + Aftermovie Vertical 48h (+3 dias úteis)",
      dueDate: addBusinessDaysYmd(base, 3),
      completed: false,
      category: "entrega",
    },
    {
      id: generateId("chk"),
      title: "Pedir depoimento no Google (+5 dias)",
      dueDate: addDaysYmd(base, 5),
      completed: false,
      category: "prova_social",
    },
    {
      id: generateId("chk"),
      title: "Alerta de Recorrência para o próximo ano (+10 meses)",
      dueDate: addMonthsYmd(base, 10),
      completed: false,
      category: "recorrencia",
    },
  ];
}
