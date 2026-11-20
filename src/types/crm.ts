export type FunnelId =
  | "festas_corporativas"
  | "lojas_barro_preto"
  | "retratos_lifestyle";

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
  // Fase 2: Automação de Follow-up, Radar, Contrato PDF e Pós-venda
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
  // Fase 2: Evolution API / Z-API, Radar Admin Email, Pix BR Code
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
  suggestedFunnel: FunnelId;
  enrichedEmail?: string;
  enrichedInstagram?: string;
}

export interface IntegrationStatus {
  databaseMode: "firebase" | "supabase" | "local";
  firebaseProjectId?: string;
  googlePlacesLive: boolean;
  resendLive: boolean;
  whatsappApiLive: boolean;
  whatsappProvider: "evolution" | "zapi";
  whatsappNumber: string;
  adminEmail: string;
  pixKey: string;
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

export const FUNNELS: Array<{
  id: FunnelId;
  label: string;
  shortLabel: string;
  subtitle: string;
  defaultValue: number;
}> = [
  {
    id: "festas_corporativas",
    label: "Festas Corporativas",
    shortLabel: "Festas Corporativas",
    subtitle: "Empresas & RH",
    defaultValue: 1950,
  },
  {
    id: "lojas_barro_preto",
    label: "Lojas Barro Preto",
    shortLabel: "Barro Preto",
    subtitle: "Catálogo Express",
    defaultValue: 2400,
  },
  {
    id: "retratos_lifestyle",
    label: "Retratos & Lifestyle",
    shortLabel: "Retratos & Casting",
    subtitle: "Casting & Posicionamento",
    defaultValue: 1650,
  },
];

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
    accentClass: "bg-amber-400",
  },
  {
    id: "follow_up",
    label: "Follow-up",
    shortLabel: "Follow-up",
    accentClass: "bg-orange-400",
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
  modelo_provador: "Modelo de Provador",
  gerente_espaco: "Gerente de Espaço de Eventos",
  outro: "Parceiro Comercial",
};

export const PROPOSAL_PACKAGES = [
  {
    id: "corporate_essencial",
    name: "Corporate Essencial",
    price: 1350,
    badge: null as string | null,
    summary:
      "Cobertura fotográfica editorial completa com foco em marca empregadora e entrega ágil.",
    features: [
      "4 horas de cobertura fotográfica corporativa",
      "15 fotos selecionadas e tratadas já no dia seguinte (24h)",
      "Galeria digital completa em alta resolução em até 3 dias úteis",
      "Equipamento full-frame com gravação dupla em tempo real",
      "Licença comercial de uso para LinkedIn, imprensa e endomarketing",
    ],
  },
  {
    id: "corporate_prime",
    name: "Corporate Prime",
    price: 1950,
    badge: "Recomendado" as string | null,
    summary:
      "O pacote escolhido por times de RH e Marketing que buscam impacto fotográfico e audiovisual vertical.",
    features: [
      "Tudo incluso no pacote Corporate Essencial",
      "1 Vídeo Aftermovie Vertical (Reels / LinkedIn / Shorts) editado e finalizado",
      "Captação de depoimentos rápidos e atmosfera do evento",
      "Color grading cinematográfico e trilha licenciada",
      "Prioridade de entrega e emissão de Nota Fiscal (NF-e)",
    ],
  },
] as const;

export const PROPOSAL_ADDONS = [
  {
    id: "hora_extra",
    name: "Hora Extra de Cobertura",
    price: 350,
    description:
      "Amplie a cobertura do evento com flexibilidade para premiações, shows ou confraternizações estendidas.",
  },
  {
    id: "entrega_realtime",
    name: "Entrega Real-Time",
    price: 250,
    description:
      "Envio de seleção curada de fotos tratadas durante o evento via WhatsApp para publicação ao vivo.",
  },
] as const;
