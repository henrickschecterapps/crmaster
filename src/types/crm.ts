export type FunnelId =
  | "corporativo"
  | "estetica"
  | "nightlife"
  | "moda"
  | "gastronomia";

export type TemplateFunnelId = FunnelId | "geral";

export type StageId =
  | "captado"
  | "contatado"
  | "proposta_aberta"
  | "follow_up"
  | "sinal_pago"
  | "fechado";

export type PaymentStatus = "pendente" | "sinal_pago" | "quitado";

export type PartnerRole = "modelo_provador" | "gerente_espaco" | "outro";

export type InteractionType =
  | "nota"
  | "whatsapp"
  | "email"
  | "proposta_vista"
  | "proposta_aprovada"
  | "etapa"
  | "pagamento"
  | "sistema"
  | "radar"
  | "followup_auto"
  | "contrato"
  | "enriquecimento"
  | "pos_venda";

export const BRAND_DEFAULTS = {
  name: "ÚLTIMO QUADRO",
  subtitle: "Fotografia Autoral & Produção Audiovisual",
  tagline: "A história termina. A imagem fica.",
  location: "Belo Horizonte e Nova Lima, MG",
  whatsappNumber: "5531983997195",
  whatsappDisplay: "(31) 98399-7195",
  email: "ultimoquadrofilmes@gmail.com",
  website: "https://ultimo-quadro.vercel.app",
  pixRecipientName: "Ultimo Quadro",
  pixCity: "BELO HORIZONTE",
} as const;

/**
 * Backwards-compatible mapper for legacy Phase 1/2 funnel IDs already stored in Firestore.
 */
export function normalizeFunnelId(raw?: string | null): FunnelId {
  switch (raw) {
    case "corporativo":
    case "festas_corporativas":
      return "corporativo";
    case "estetica":
    case "retratos_lifestyle":
      return "estetica";
    case "nightlife":
      return "nightlife";
    case "moda":
    case "lojas_barro_preto":
      return "moda";
    case "gastronomia":
      return "gastronomia";
    default:
      return "corporativo";
  }
}

export function normalizeTemplateFunnelId(
  raw?: string | null
): TemplateFunnelId {
  if (raw === "geral") return "geral";
  return normalizeFunnelId(raw);
}

export interface Partner {
  id: string;
  name: string;
  role: PartnerRole;
  company: string;
  phone: string;
  commissionRate: number; // default 15 (%)
  createdAt: string;
}

export interface LeadInteraction {
  id: string;
  leadId: string;
  type: InteractionType;
  title: string;
  description: string;
  createdAt: string;
}

export interface ContractDocumentRef {
  type: "corporativo" | "retratos";
  fileName: string;
  generatedAt: string;
  url: string;
}

export interface PostSaleChecklistItem {
  id: string;
  title: string;
  dueDate: string; // YYYY-MM-DD
  completed: boolean;
  category: "entrega" | "financeiro" | "prova_social" | "recorrencia";
}

export interface Lead {
  id: string;
  companyName: string;
  contactName: string;
  contactRole?: string;
  phone: string;
  email: string;
  instagram?: string;
  neighborhood?: string;
  address?: string;
  website?: string;
  funnel: FunnelId;
  stage: StageId;
  estimatedValue: number;
  origin: string;
  partnerId?: string | null;
  commissionPaid: boolean;
  paymentStatus: PaymentStatus;
  notes: string;
  eventDate?: string;
  cnpj?: string;
  cpf?: string;
  razaoSocial?: string;
  proposalPackage?: string;
  proposalAddons?: string[];
  visualizadaEm?: string | null;
  visualizacoesProposta: number;
  propostaAprovadaEm?: string | null;
  automacaoAtiva: boolean;
  respondeu: boolean;
  followupStep: 0 | 1 | 2;
  tags: string[];
  lastRadarAlertAt?: string | null;
  contractDocument?: ContractDocumentRef | null;
  postSaleChecklist: PostSaleChecklistItem[];
  ultimaInteracaoEm: string;
  createdAt: string;
  updatedAt: string;
  interactions: LeadInteraction[];
}

export interface ScriptTemplate {
  id: string;
  name: string;
  funnel: TemplateFunnelId;
  channel: "whatsapp" | "email" | "ambos";
  subject: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudioSettings {
  id: string;
  monthlyGoal: number;
  studioName: string;
  nextAvailableDate: string;
  whatsappProvider: "evolution" | "zapi";
  whatsappApiUrl: string;
  whatsappApiKey: string;
  whatsappInstance: string;
  adminEmail: string;
  pixKey: string;
  pixRecipientName: string;
  pixCity: string;
  updatedAt: string;
}

export interface CrmStoreData {
  settings: StudioSettings;
  partners: Partner[];
  leads: Lead[];
  templates: ScriptTemplate[];
}

export interface PlaceCandidate {
  placeId: string;
  name: string;
  phone: string;
  address: string;
  neighborhood: string;
  website: string;
  category: string;
  rating?: number;
  confidence?: number;
  source?: "overture" | "osm" | "google" | "demo";
  suggestedFunnel: FunnelId;
  enrichedEmail?: string;
  enrichedInstagram?: string;
}

export interface IntegrationStatus {
  databaseMode: "firebase" | "supabase" | "local";
  firebaseProjectId?: string;
  googlePlacesLive: boolean;
  resendLive: boolean;
  gmailLive: boolean;
  adminAuthEnabled: boolean;
  whatsappApiLive: boolean;
  whatsappProvider: "evolution" | "zapi";
  whatsappNumber: string;
  adminEmail: string;
  pixKey: string;
}

export interface CronExecutionAction {
  leadId: string;
  companyName: string;
  contactName: string;
  step: "dia_2" | "dia_5";
  hoursSinceInteraction: number;
  emailStatus: string;
  whatsappStatus: string;
  tagAdded?: string;
}

export interface CronExecutionLog {
  id: string;
  executedAt: string;
  dryRun: boolean;
  scannedEligible: number;
  triggeredCount: number;
  whatsappQueueScheduled: number;
  queueProcessed?: number;
  actions: CronExecutionAction[];
}

export interface WhatsappQueueJob {
  id: string;
  leadId: string;
  companyName: string;
  phone: string;
  message: string;
  status: "pendente" | "enviando" | "enviado" | "simulado" | "erro";
  scheduledFor: string;
  delaySeconds: number;
  createdAt: string;
  sentAt?: string;
  error?: string;
}

export interface ServicePackageOption {
  id: string;
  tier: string;
  name: string;
  format: string;
  price: number;
  originalPrice?: number;
  badge: string | null;
  featured: boolean;
  features: string[];
}

export interface ServiceAddonOption {
  id: string;
  name: string;
  price: number;
  description: string;
}

export interface ServiceVerticalSpec {
  id: FunnelId;
  index: string;
  label: string;
  shortLabel: string;
  subtitle: string;
  kicker: string;
  title: string;
  subheadline: string;
  defaultValue: number;
  deliverySummary: string;
  pillars: Array<{ num: string; label: string }>;
  packages: ServicePackageOption[];
  addons: ServiceAddonOption[];
}

export const SERVICES_CATALOG: ServiceVerticalSpec[] = [
  {
    id: "corporativo",
    index: "01",
    label: "Corporativo",
    shortLabel: "Corporativo",
    subtitle: "Eventos B2B & RH",
    kicker: "EVENTOS CORPORATIVOS · B2B",
    title: "Cobertura Corporativa 360°",
    subheadline:
      "Confraternizações de Fim de Ano, Encontros de Liderança e Eventos de Marca. Cobertura pensada para RH, Endomarketing e posicionamento institucional no LinkedIn e imprensa.",
    defaultValue: 1950,
    deliverySummary: "Prévia de 15 fotos até as 10h do dia seguinte · Galeria em 3 dias úteis",
    pillars: [
      { num: "01", label: "Cenografia & Identidade de Marca" },
      { num: "02", label: "Liderança, Palco & Protocolo" },
      { num: "03", label: "Conexão & Espontaneidade" },
      { num: "04", label: "Conteúdo Vertical Reels" },
    ],
    packages: [
      {
        id: "corporate_essencial",
        tier: "FOTOGRAFIA",
        name: "Corporate Essencial",
        format: "Cobertura fotográfica completa de até 4h",
        price: 1350,
        badge: null,
        featured: false,
        features: [
          "Até 4h consecutivas de cobertura no local",
          "Prévia Expressa: 15 fotos editadas até as 10h da manhã seguinte",
          "Galeria completa: 250 a 350 fotos tratadas em até 3 dias úteis",
          "Arquivos em alta resolução + versão web para LinkedIn e imprensa",
          "Equipamento Full-Frame 4K com backup duplo + emissão de NFS-e",
        ],
      },
      {
        id: "corporate_prime",
        tier: "FOTOGRAFIA + VÍDEO REELS",
        name: "Corporate Prime",
        format: "Cobertura completa + Aftermovie Vertical",
        price: 1950,
        badge: "MAIS ESCOLHIDO",
        featured: true,
        features: [
          "Tudo incluso no Essencial (4h + Prévia às 10h + Galeria em 3 dias úteis)",
          "1 Vídeo Aftermovie Vertical (Reels) de 30–45s em alta definição",
          "Edição dinâmica com color grading autoral e trilha licenciada",
          "Entrega do vídeo final em até 48h após o evento",
          "Atendimento PJ formalizado, contrato digital e emissão de NFS-e",
        ],
      },
    ],
    addons: [
      {
        id: "corp_hora_extra",
        name: "Hora Extra",
        price: 350,
        description:
          "Amplie a cobertura do evento para premiações, shows ou confraternizações estendidas.",
      },
      {
        id: "corp_realtime",
        name: "Cobertura Real-Time",
        price: 250,
        description:
          "Envio de 10 fotos editadas via WhatsApp durante o evento para publicação ao vivo.",
      },
    ],
  },
  {
    id: "estetica",
    index: "02",
    label: "Estética & Wellness",
    shortLabel: "Estética & Wellness",
    subtitle: "Clínicas, Spas & Fitness",
    kicker: "CLÍNICAS, SPAS & STUDIOS FITNESS",
    title: "Estética, Spas & Wellness",
    subheadline:
      "Produção fotográfica, retratos de autoridade e criativos em vídeo (Reels & Ads 4K) com iluminação Clean Skin, áudio lapela sem fio cristalino e roteirização focada em Hook (3s) para Meta Ads.",
    defaultValue: 1890,
    deliverySummary: "Prévia de 12 fotos no dia seguinte · 70 fotos e criativos 4K em até 3 dias úteis",
    pillars: [
      { num: "01", label: "Iluminação Clean Skin" },
      { num: "02", label: "Retratos de Autoridade" },
      { num: "03", label: "Áudio Lapela Sem Fio" },
      { num: "04", label: "Hooks (3s) para Meta Ads" },
    ],
    packages: [
      {
        id: "estetica_glow",
        tier: "FOTOGRAFIA COMPLETA",
        name: "Glow & Posicionamento",
        format: "Produção fotográfica editorial de até 3h",
        price: 1190,
        badge: null,
        featured: false,
        features: [
          "Até 3h de produção no local (arquitetura, detalhes, equipe e procedimentos)",
          "Direção de postura e expressão para retratos de autoridade",
          "Iluminação dedicada Clean Skin com fidelidade de tom de pele",
          "Prévia Expressa: 12 fotos editadas no dia seguinte",
          "Entrega Final: 70 fotos tratadas em até 3 dias úteis",
        ],
      },
      {
        id: "estetica_prime",
        tier: "FOTO + VÍDEOS 4K & ADS",
        name: "Performance & Ads Prime",
        format: "Ideal para Tráfego Pago, Reels & Posicionamento",
        price: 1890,
        badge: "MAIS ESCOLHIDO",
        featured: true,
        features: [
          "Até 4h de produção completa (Foto + Vídeo 4K + Áudio Lapela Sem Fio)",
          "Acervo Fotográfico Completo: 70 fotos + prévia de 12 fotos no dia seguinte",
          "1 Vídeo Institucional / Experiência Vertical (Reels 30–45s)",
          "3 Vídeos Criativos para Anúncios / Reels Falados (até 45s cada, cortes e legendas)",
          "Roteirização focada em Hook (3s) de alta retenção para Meta Ads",
        ],
      },
    ],
    addons: [
      {
        id: "est_reel_extra",
        name: "Criativo / Reel Extra",
        price: 240,
        description:
          "1 vídeo vertical adicional gravado com áudio lapela, cortes dinâmicos e legendas.",
      },
      {
        id: "est_hora_extra",
        name: "Hora Adicional",
        price: 300,
        description:
          "Tempo extra de set para incluir novos procedimentos, especialistas ou ambientes.",
      },
    ],
  },
  {
    id: "nightlife",
    index: "03",
    label: "Festas & Nightlife",
    shortLabel: "Nightlife",
    subtitle: "Bares, Clubs & Labels",
    kicker: "PROMOTERS, BARES, CASAS DE SHOW & LABELS",
    title: "Festas, Bares & Nightlife",
    subheadline:
      "Fotografia noturna Full-Frame Low-Light e Aftermovies 4K desenhados para gerar desejo, efeito FOMO e valorizar ativações de marcas e patrocinadores.",
    defaultValue: 1390,
    deliverySummary: "Prévia de 15 fotos até 14h do dia seguinte · Galeria & Aftermovie 4K em até 48h",
    pillars: [
      { num: "01", label: "Pista & Efeito FOMO" },
      { num: "02", label: "Palco, DJs & Luz" },
      { num: "03", label: "Coquetelaria & Ativações" },
      { num: "04", label: "Aftermovie de Hype 4K" },
    ],
    packages: [
      {
        id: "nightlife_lounge",
        tier: "FOTOGRAFIA NOTURNA",
        name: "Lounge & Bar",
        format: "Cobertura noturna Low-Light de até 4h",
        price: 790,
        badge: null,
        featured: false,
        features: [
          "Até 4h consecutivas de cobertura (ambiente, drinks, público e atrações)",
          "Técnica mista: luz ambiente + flash criativo (shutter drag)",
          "Prévia Expressa: 15 fotos editadas até as 14h do dia seguinte",
          "Galeria completa: 180 a 280 fotos tratadas em até 48h",
        ],
      },
      {
        id: "nightlife_club_prime",
        tier: "FOTO + AFTERMOVIE REELS 4K",
        name: "Club & Festival Prime",
        format: "Cobertura integrada Foto Full-Frame + Vídeo 4K",
        price: 1390,
        badge: "MAIS ESCOLHIDO",
        featured: true,
        features: [
          "Até 5h de cobertura integrada (Foto Full-Frame + Vídeo 4K)",
          "Cobertura Fotográfica Completa (Prévia 15 fotos no dia seguinte + Galeria em 48h)",
          "1 Vídeo Aftermovie Vertical (30–45s) com edição no beat, sound design e color grading em até 48h",
          "Registro dedicado de ativações de marcas e patrocinadores",
        ],
      },
    ],
    addons: [
      {
        id: "night_realtime",
        name: "Drop Real-Time",
        price: 250,
        description:
          "12 fotos tratadas enviadas no WhatsApp durante o pico da festa para Stories imediatos.",
      },
      {
        id: "night_hora_extra",
        name: "Hora Extra",
        price: 250,
        description:
          "Estenda a cobertura até o encerramento ou atração principal da madrugada.",
      },
    ],
  },
  {
    id: "moda",
    index: "04",
    label: "Moda & Provador",
    shortLabel: "Moda & Provador",
    subtitle: "Lojas, Barro Preto & Atacado",
    kicker: "LOJAS, MARCAS AUTORAIS, ATACADO & MODELOS",
    title: "Fotografia de Moda & Provador",
    subheadline:
      "Produção fotográfica e Fashion Reels 4K com fidelidade absoluta de cor e tecido, ótica Full-Frame 35/50/85mm e spoilers entregues no mesmo dia.",
    defaultValue: 1290,
    deliverySummary: "Spoiler Express no mesmo dia (até 6h) · Galeria completa em até 2 dias úteis",
    pillars: [
      { num: "01", label: "Provador Premium" },
      { num: "02", label: "Editorial & Street Style" },
      { num: "03", label: "Lookbook & Catálogo" },
      { num: "04", label: "Fashion Reels em Movimento" },
    ],
    packages: [
      {
        id: "moda_express",
        tier: "FOTOGRAFIA",
        name: "Drop & Provador Express",
        format: "Sessão ágil de até 2h (10 a 15 looks)",
        price: 690,
        badge: null,
        featured: false,
        features: [
          "Até 2h de sessão (loja, showroom ou externa) para 10 a 15 looks",
          "Direção completa de poses, caimento e detalhes de tecido",
          "Spoiler Express: 10 fotos editadas no mesmo dia (até 6h após a sessão)",
          "Entrega Final: 45 fotos tratadas em até 2 dias úteis",
        ],
      },
      {
        id: "moda_prime",
        tier: "FOTO + FASHION REELS 4K",
        name: "Campanha & Lookbook Prime",
        format: "Produção completa de até 4h (20 a 30 looks)",
        price: 1290,
        badge: "MAIS ESCOLHIDO",
        featured: true,
        features: [
          "Até 4h de produção para 20 a 30 looks (permite combinar loja + externa)",
          "90 fotos tratadas + 15 prévias entregues no mesmo dia",
          "3 Fashion Reels Verticais (15 a 30s) em 4K entregues em até 48h",
          "Galeria online privada de luxo em alta resolução",
        ],
      },
    ],
    addons: [
      {
        id: "moda_reel_extra",
        name: "Fashion Reel Adicional",
        price: 220,
        description:
          "1 Fashion Reel vertical extra em 4K editado no ritmo da coleção.",
      },
      {
        id: "moda_hora_extra",
        name: "Hora Extra",
        price: 250,
        description:
          "Amplie a diária para fotografar mais looks, grades ou locações externas.",
      },
    ],
  },
  {
    id: "gastronomia",
    index: "05",
    label: "Gastronomia & iFood",
    shortLabel: "Gastronomia",
    subtitle: "Restaurantes, Bares & Delivery",
    kicker: "RESTAURANTES, BARES, HAMBURGUERIAS & CAFETERIAS",
    title: "Gastronomia, Bares & Delivery",
    subheadline:
      "Fotografia de apetite e Food Reels 4K/ASMR com estúdio de iluminação portátil no local, pronto para cardápios de alta conversão no iFood e redes sociais.",
    defaultValue: 1490,
    deliverySummary: "Prévia de 10 fotos no dia seguinte · Galeria Alta Res + iFood em 3 dias úteis",
    pillars: [
      { num: "01", label: "Pratos Assinatura" },
      { num: "02", label: "Cardápio iFood & Delivery" },
      { num: "03", label: "Coquetelaria & Cafés" },
      { num: "04", label: "Food Reels & Bastidores" },
    ],
    packages: [
      {
        id: "gastro_essencial",
        tier: "FOTOGRAFIA GASTRONÔMICA",
        name: "Menu & Delivery Essencial",
        format: "Sessão de até 3h com estúdio portátil (15 a 20 itens)",
        price: 890,
        badge: null,
        featured: false,
        features: [
          "Até 3h de sessão no local com estúdio de iluminação portátil",
          "15 a 20 itens (pratos, lanches, sobremesas, bebidas) + fotos do ambiente",
          "Prévia Expressa: 10 fotos editadas no dia seguinte",
          "60 fotos tratadas (Alta Resolução + versão otimizada iFood) em até 3 dias úteis",
        ],
      },
      {
        id: "gastro_prime",
        tier: "FOTO + FOOD REELS 4K",
        name: "Chef's Table & Reels Prime",
        format: "Produção integrada de até 4h (20 a 25 itens)",
        price: 1490,
        badge: "MAIS ESCOLHIDO",
        featured: true,
        features: [
          "Até 4h de produção integrada (Foto Full-Frame + Vídeo 4K)",
          "20 a 25 itens + ambiente, fachada e retratos do Chef/Equipe (80 fotos + prévia dia seguinte)",
          "3 Food Reels Verticais (15 a 30s em 4K/ASMR) entregues em até 48h",
          "Direção de cena dedicada junto ao chef ou bartender",
        ],
      },
    ],
    addons: [
      {
        id: "gastro_reel_extra",
        name: "Food Reel Extra",
        price: 220,
        description:
          "1 Food Reel 4K adicional com foco em textura, preparo e apetite visual.",
      },
      {
        id: "gastro_hora_extra",
        name: "Hora Extra",
        price: 250,
        description:
          "Tempo extra de estúdio portátil no local para fotografar mais pratos ou drinks.",
      },
    ],
  },
];

/**
 * Projeto Impulso Moda BH: Cota Social 65% Subsidiada (3 vagas/mês)
 */
export const SOCIAL_MODA_PACKAGES: ServicePackageOption[] = [
  {
    id: "social_moda_start",
    tier: "PROJETO IMPULSO MODA BH · 65% OFF",
    name: "Social Start (Pocket)",
    format: "Sessão focada de até 1h (5 a 8 looks)",
    price: 240,
    originalPrice: 690,
    badge: "3 VAGAS/MÊS",
    featured: false,
    features: [
      "Sessão focada de até 1h (5 a 8 looks) para pequenas marcas de BH",
      "Direção completa de poses e caimento",
      "20 fotos tratadas em alta resolução com fidelidade de cor",
      "Entrega expressa em até 2 dias úteis",
    ],
  },
  {
    id: "social_moda_prime",
    tier: "PROJETO IMPULSO MODA BH · 65% OFF",
    name: "Social Impulso Prime",
    format: "Foto + 2 Fashion Reels 4K (até 12 looks)",
    price: 450,
    originalPrice: 1290,
    badge: "COTA SOCIAL",
    featured: true,
    features: [
      "Até 2h de produção (8 a 12 looks) com 65% de subsídio",
      "35 fotos tratadas + spoiler express no mesmo dia",
      "2 Fashion Reels Verticais 4K para Instagram e anúncios",
      "Galeria online profissional em alta resolução",
    ],
  },
];

export const FUNNELS = SERVICES_CATALOG.map((s) => ({
  id: s.id,
  index: s.index,
  label: s.label,
  shortLabel: s.shortLabel,
  subtitle: s.subtitle,
  defaultValue: s.defaultValue,
}));

export function getServiceVertical(funnelId: FunnelId): ServiceVerticalSpec {
  return (
    SERVICES_CATALOG.find((s) => s.id === funnelId) ?? SERVICES_CATALOG[0]
  );
}

export const STAGES: Array<{
  id: StageId;
  label: string;
  shortLabel: string;
  accentClass: string;
}> = [
  {
    id: "captado",
    label: "Captado",
    shortLabel: "Captado",
    accentClass: "bg-zinc-400",
  },
  {
    id: "contatado",
    label: "Contatado",
    shortLabel: "Contatado",
    accentClass: "bg-sky-400",
  },
  {
    id: "proposta_aberta",
    label: "Proposta Aberta",
    shortLabel: "Proposta Aberta",
    accentClass: "bg-[#CC551E]",
  },
  {
    id: "follow_up",
    label: "Follow-up",
    shortLabel: "Follow-up",
    accentClass: "bg-amber-400",
  },
  {
    id: "sinal_pago",
    label: "Sinal Pago (50%)",
    shortLabel: "Sinal (50%)",
    accentClass: "bg-emerald-400",
  },
  {
    id: "fechado",
    label: "Fechado",
    shortLabel: "Fechado",
    accentClass: "bg-emerald-500",
  },
];

export const PARTNER_ROLES: Record<PartnerRole, string> = {
  modelo_provador: "Modelo de Provador VIP",
  gerente_espaco: "Gerente de Espaço / Promoter",
  outro: "Parceiro Comercial",
};
