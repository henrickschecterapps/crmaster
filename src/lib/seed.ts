import {
  BRAND_DEFAULTS,
  CrmStoreData,
  PlaceCandidate,
  ScriptTemplate,
} from "@/types/crm";
import { buildPostSaleChecklist } from "@/lib/utils";

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

export function createPhase2FollowupTemplates(): ScriptTemplate[] {
  return [
    {
      id: "tpl-followup-dia2",
      name: "Follow-up Dia 2: Proposta Aberta (Consultivo)",
      funnel: "geral",
      channel: "ambos",
      subject: "Sobre o projeto da {{nome_empresa}} | ÚLTIMO QUADRO",
      body: `Olá {{nome_contato}}, tudo bem?

Aqui é da equipe da ÚLTIMO QUADRO. Passando para saber se conseguiu dar uma olhada no material que montamos para a {{nome_empresa}}.

Se fizer sentido ajustar o formato, quantidade de entregas ou encaixar em uma data específica, adaptamos o escopo sem burocracia.

Deixo o acesso direto ao portal do projeto aqui:
{{link_proposta}}

Fico por aqui se quiser alinhar algum ponto.`,
      createdAt: hoursAgo(280),
      updatedAt: hoursAgo(280),
    },
    {
      id: "tpl-followup-dia2-contato",
      name: "Follow-up Dia 2: Primeiro Contato (Sem Proposta Enviada)",
      funnel: "geral",
      channel: "ambos",
      subject: "Produção audiovisual para a {{nome_empresa}} | ÚLTIMO QUADRO",
      body: `Olá {{nome_contato}}, tudo bem?

Sei que a rotina aí na {{nome_empresa}} costuma ser corrida. Aqui é da ÚLTIMO QUADRO e deixei reunidos neste link alguns exemplos de como organizamos nossas produções de fotografia e vídeo aqui em BH e Nova Lima:
{{link_proposta}}

Se estiver nos planos para as próximas semanas, podemos conversar brevemente para entender a necessidade de vocês.`,
      createdAt: hoursAgo(280),
      updatedAt: hoursAgo(280),
    },
    {
      id: "tpl-followup-dia5",
      name: "Follow-up Dia 5: Encerramento Elegante de Agenda",
      funnel: "geral",
      channel: "ambos",
      subject: "Agenda perto de {{proxima_data_livre}} | {{nome_empresa}} | ÚLTIMO QUADRO",
      body: `Olá {{nome_contato}}, tudo bem?

Estamos finalizando o cronograma de produções da ÚLTIMO QUADRO em BH e Nova Lima para a janela de {{proxima_data_livre}} e queria confirmar se ainda faz sentido manter a {{nome_empresa}} no nosso radar para esse período.

Caso queira revisar os valores ou reservar a data, o portal continua disponível aqui:
{{link_proposta}}

Se preferir retomar em um próximo momento, sem problema algum. Seguimos à disposição.`,
      createdAt: hoursAgo(280),
      updatedAt: hoursAgo(280),
    },
  ];
}

export function createInitialSeedData(): CrmStoreData {
  return {
    settings: {
      id: "default",
      monthlyGoal: 16000,
      studioName: BRAND_DEFAULTS.name,
      nextAvailableDate: "05/12/2026",
      whatsappProvider: "evolution",
      whatsappApiUrl: process.env.WHATSAPP_API_URL || "",
      whatsappApiKey: process.env.WHATSAPP_API_KEY || "",
      whatsappInstance: process.env.WHATSAPP_INSTANCE || "",
      adminEmail: process.env.ADMIN_EMAIL || BRAND_DEFAULTS.email,
      pixKey: process.env.NEXT_PUBLIC_PIX_KEY || BRAND_DEFAULTS.email,
      pixRecipientName: BRAND_DEFAULTS.pixRecipientName,
      pixCity: BRAND_DEFAULTS.pixCity,
      updatedAt: hoursAgo(2),
    },
    partners: [
      {
        id: "partner-01",
        name: "Rafael Drummond",
        role: "gerente_espaco",
        company: "Pampulha Lake House Eventos",
        phone: "(31) 99124-8830",
        commissionRate: 15,
        createdAt: hoursAgo(720),
      },
      {
        id: "partner-02",
        name: "Isabela Ferraz",
        role: "modelo_provador",
        company: "Casting Barro Preto BH",
        phone: "(31) 98847-2190",
        commissionRate: 15,
        createdAt: hoursAgo(640),
      },
      {
        id: "partner-03",
        name: "Fernanda Costa",
        role: "gerente_espaco",
        company: "Espaço Belvedere Rooftop",
        phone: "(31) 99710-4452",
        commissionRate: 15,
        createdAt: hoursAgo(400),
      },
    ],
    leads: [
      {
        id: "lead-bh-01",
        companyName: "Vértice Engenharia & Infraestrutura",
        contactName: "Mariana Alvarenga",
        contactRole: "Head de Gente & Cultura",
        phone: "(31) 99812-4410",
        email: "mariana.alvarenga@verticeeng.com.br",
        instagram: "@verticeengenharia",
        neighborhood: "Funcionários",
        address: "Av. Getúlio Vargas, 1420, Funcionários, Belo Horizonte",
        website: "https://verticeeng.com.br",
        funnel: "corporativo",
        stage: "contatado",
        estimatedValue: 1950,
        origin: "Indicação: Espaço de Eventos",
        partnerId: "partner-01",
        commissionPaid: false,
        paymentStatus: "pendente",
        notes:
          "Confraternização anual para 120 colaboradores na Pampulha. Interessada no pacote Corporate Prime com aftermovie vertical para LinkedIn.",
        eventDate: "2026-12-11",
        visualizadaEm: null,
        visualizacoesProposta: 0,
        propostaAprovadaEm: null,
        automacaoAtiva: true,
        respondeu: false,
        followupStep: 0,
        tags: [],
        lastRadarAlertAt: null,
        contractDocument: null,
        postSaleChecklist: [],
        ultimaInteracaoEm: hoursAgo(56),
        createdAt: hoursAgo(96),
        updatedAt: hoursAgo(56),
        interactions: [
          {
            id: "int-01a",
            leadId: "lead-bh-01",
            type: "sistema",
            title: "Lead cadastrado na vertical Corporativo",
            description:
              "Indicação recebida via Rafael Drummond (Pampulha Lake House).",
            createdAt: hoursAgo(96),
          },
          {
            id: "int-01b",
            leadId: "lead-bh-01",
            type: "whatsapp",
            title: "Primeiro contato via WhatsApp",
            description:
              "Enviada apresentação da Último Quadro. Mariana pediu proposta Corporate Prime para alinhar com a diretoria.",
            createdAt: hoursAgo(56),
          },
        ],
      },
      {
        id: "lead-bh-02",
        companyName: "Casa Savassi Consultoria Jurídica",
        contactName: "Eduardo Mascarenhas",
        contactRole: "Sócio-Diretor",
        phone: "(31) 99641-7728",
        email: "eduardo@casasavassi.adv.br",
        instagram: "@casasavassi.adv",
        neighborhood: "Savassi",
        address: "Rua Pernambuco, 1080, Savassi, Belo Horizonte",
        website: "https://casasavassi.adv.br",
        funnel: "corporativo",
        stage: "sinal_pago",
        estimatedValue: 2550,
        origin: "Indicação: Espaço de Eventos",
        partnerId: "partner-01",
        commissionPaid: false,
        paymentStatus: "sinal_pago",
        notes:
          "Jantar de encerramento e premiação de sócios. Pacote Corporate Prime + Hora Extra + Real-Time. Sinal de 50% (R$ 1.275) confirmado via PIX.",
        eventDate: "2026-12-04",
        cnpj: "34.819.204/0001-62",
        razaoSocial: "Mascarenhas & Associados Sociedade de Advogados",
        proposalPackage: "Corporate Prime",
        proposalAddons: ["Hora Extra", "Cobertura Real-Time"],
        visualizadaEm: hoursAgo(38),
        visualizacoesProposta: 3,
        propostaAprovadaEm: hoursAgo(20),
        automacaoAtiva: false,
        respondeu: true,
        followupStep: 0,
        tags: [],
        lastRadarAlertAt: hoursAgo(38),
        contractDocument: {
          type: "corporativo",
          fileName: "Contrato-Casa-Savassi-Consultoria-Juridica.pdf",
          generatedAt: hoursAgo(20),
          url: "/api/proposals/lead-bh-02/pdf",
        },
        postSaleChecklist: [],
        ultimaInteracaoEm: hoursAgo(14),
        createdAt: hoursAgo(140),
        updatedAt: hoursAgo(14),
        interactions: [
          {
            id: "int-02a",
            leadId: "lead-bh-02",
            type: "proposta_vista",
            title: "Proposta web visualizada pelo cliente",
            description: "Proposta aberta 3 vezes pelo decisor.",
            createdAt: hoursAgo(38),
          },
          {
            id: "int-02b",
            leadId: "lead-bh-02",
            type: "proposta_aprovada",
            title: "Proposta aprovada online",
            description:
              "Pacote Corporate Prime + Hora Extra + Cobertura Real-Time (R$ 2.550). Data reservada: 04/12/2026.",
            createdAt: hoursAgo(20),
          },
          {
            id: "int-02c",
            leadId: "lead-bh-02",
            type: "pagamento",
            title: "Sinal de 50% confirmado",
            description: "PIX de R$ 1.275,00 recebido. NFS-e emitida.",
            createdAt: hoursAgo(14),
          },
        ],
      },
      {
        id: "lead-bh-03",
        companyName: "Ateliê Serena Moda Feminina",
        contactName: "Camila Nogueira",
        contactRole: "Diretora Criativa",
        phone: "(31) 98753-1194",
        email: "camila@atelieserena.com.br",
        instagram: "@atelieserenabh",
        neighborhood: "Barro Preto",
        address: "Rua Mato Grosso, 539, Barro Preto, Belo Horizonte",
        website: "https://atelieserena.com.br",
        funnel: "moda",
        stage: "proposta_aberta",
        estimatedValue: 1290,
        origin: "Parceria VIP: Modelo de Provador",
        partnerId: "partner-02",
        commissionPaid: false,
        paymentStatus: "pendente",
        notes:
          "Campanha & Lookbook Prime coleção Alto Verão (25 looks + 3 Fashion Reels 4K). Aguardando confirmação da grade com a confecção.",
        eventDate: "2026-11-28",
        visualizadaEm: hoursAgo(152),
        visualizacoesProposta: 2,
        propostaAprovadaEm: null,
        automacaoAtiva: true,
        respondeu: false,
        followupStep: 1,
        tags: [],
        lastRadarAlertAt: hoursAgo(152),
        contractDocument: null,
        postSaleChecklist: [],
        ultimaInteracaoEm: hoursAgo(148),
        createdAt: hoursAgo(210),
        updatedAt: hoursAgo(148),
        interactions: [
          {
            id: "int-03a",
            leadId: "lead-bh-03",
            type: "sistema",
            title: "Indicação VIP via Isabela Ferraz",
            description:
              "Modelo de provador indicou a marca para campanha de alto verão.",
            createdAt: hoursAgo(210),
          },
          {
            id: "int-03b",
            leadId: "lead-bh-03",
            type: "proposta_vista",
            title: "Proposta web visualizada",
            description: "Camila visualizou a proposta de Moda & Provador.",
            createdAt: hoursAgo(152),
          },
        ],
      },
      {
        id: "lead-bh-04",
        companyName: "Osteria Brasa & Vinho Lourdes",
        contactName: "Thiago Bittencourt",
        contactRole: "Sócio-Proprietário",
        phone: "(31) 99208-6341",
        email: "thiago@osteriabrasabh.com.br",
        instagram: "@osteriabrasalourdes",
        neighborhood: "Lourdes",
        address: "Rua Curitiba, 2244, Lourdes, Belo Horizonte",
        website: "https://osteriabrasabh.com.br",
        funnel: "gastronomia",
        stage: "fechado",
        estimatedValue: 1490,
        origin: "OpenStreetMap BH",
        partnerId: null,
        commissionPaid: false,
        paymentStatus: "quitado",
        notes:
          "Pacote Chef's Table & Reels Prime (25 pratos assinatura + 3 Food Reels 4K/ASMR + otimização iFood). 100% quitado.",
        eventDate: "2026-11-12",
        cnpj: "19.442.780/0001-11",
        razaoSocial: "Osteria Brasa Gastronomia Ltda",
        proposalPackage: "Chef's Table & Reels Prime",
        visualizadaEm: hoursAgo(190),
        visualizacoesProposta: 4,
        propostaAprovadaEm: hoursAgo(170),
        automacaoAtiva: false,
        respondeu: true,
        followupStep: 0,
        tags: [],
        lastRadarAlertAt: hoursAgo(190),
        contractDocument: null,
        postSaleChecklist: buildPostSaleChecklist("gastronomia"),
        ultimaInteracaoEm: hoursAgo(18),
        createdAt: hoursAgo(260),
        updatedAt: hoursAgo(18),
        interactions: [
          {
            id: "int-04a",
            leadId: "lead-bh-04",
            type: "pagamento",
            title: "Quitação final (100%) recebida",
            description:
              "Parcela final liquidada. Galeria Alta Res + iFood e 3 Food Reels 4K entregues.",
            createdAt: hoursAgo(18),
          },
        ],
      },
      {
        id: "lead-bh-05",
        companyName: "Dra. Letícia Vasconcelos | Dermatologia & Estética",
        contactName: "Letícia Vasconcelos",
        contactRole: "Médica Dermatologista",
        phone: "(31) 99473-5029",
        email: "contato@draleticiavasconcelos.com.br",
        instagram: "@draleticiavasconcelos",
        neighborhood: "Lourdes",
        address: "Rua São Paulo, 2110, Lourdes, Belo Horizonte",
        website: "https://draleticiavasconcelos.com.br",
        funnel: "estetica",
        stage: "captado",
        estimatedValue: 1890,
        origin: "OpenStreetMap BH",
        partnerId: null,
        commissionPaid: false,
        paymentStatus: "pendente",
        notes:
          "Clínica recém-reformada no Lourdes. Interesse potencial em Performance & Ads Prime (70 fotos Clean Skin + 3 criativos Meta Ads 4K com lapela).",
        visualizadaEm: null,
        visualizacoesProposta: 0,
        propostaAprovadaEm: null,
        automacaoAtiva: true,
        respondeu: false,
        followupStep: 0,
        tags: [],
        lastRadarAlertAt: null,
        contractDocument: null,
        postSaleChecklist: [],
        ultimaInteracaoEm: hoursAgo(74),
        createdAt: hoursAgo(74),
        updatedAt: hoursAgo(74),
        interactions: [
          {
            id: "int-05a",
            leadId: "lead-bh-05",
            type: "sistema",
            title: "Lead captado na vertical Estética & Wellness",
            description:
              "Clínica identificada no Lourdes com forte investimento em tráfego pago.",
            createdAt: hoursAgo(74),
          },
        ],
      },
    ],
    templates: [
      {
        id: "tpl-rh-endomarketing",
        name: "Corporativo: Eventos B2B, RH & Marca",
        funnel: "corporativo",
        channel: "ambos",
        subject: "Cobertura fotográfica e audiovisual | {{nome_empresa}} | ÚLTIMO QUADRO",
        body: `Olá {{nome_contato}}, tudo bem?

Aqui é da ÚLTIMO QUADRO, produtora de fotografia autoral e vídeo em Belo Horizonte e Nova Lima.

Trabalhamos com empresas em encontros de liderança, confraternizações e eventos de marca com uma cobertura discreta e foco editorial, entregando uma prévia selecionada já na manhã seguinte para o time de RH e comunicação usar no LinkedIn e canais internos.

Temos disponibilidade próxima de {{proxima_data_livre}} e organizamos os detalhes pensados para a {{nome_empresa}} neste portal:
{{link_proposta}}

Se fizer sentido, podemos alinhar o formato em uma conversa breve esta semana.`,
        createdAt: hoursAgo(300),
        updatedAt: hoursAgo(300),
      },
      {
        id: "tpl-estetica-ads",
        name: "Estética & Wellness: Retratos & Vídeos de Posicionamento",
        funnel: "estetica",
        channel: "ambos",
        subject: "Direção de imagem e vídeos para {{nome_empresa}} | ÚLTIMO QUADRO",
        body: `Olá {{nome_contato}}, tudo bem?

Aqui é da ÚLTIMO QUADRO (BH e Nova Lima). Acompanhamos o posicionamento da {{nome_empresa}} e atuamos justamente ajudando clínicas de estética e wellness a construírem um acervo fotográfico de pele limpa e vídeos curtos que transmitem confiança real, sem aquela cara engessada de anúncio pronto.

Montamos um portal com opções de formato e investimento pensadas para o perfil da clínica:
{{link_proposta}}

Temos janela aberta perto de {{proxima_data_livre}}. Caso faça sentido para o próximo ciclo de campanhas de vocês, fico à disposição por aqui.`,
        createdAt: hoursAgo(300),
        updatedAt: hoursAgo(300),
      },
      {
        id: "tpl-moda-lojistas",
        name: "Moda & Confecção: Lookbook, Provador & Lançamento",
        funnel: "moda",
        channel: "ambos",
        subject: "Produção de campanha e provador | {{nome_empresa}} | ÚLTIMO QUADRO",
        body: `Olá {{nome_contato}}, tudo bem?

Aqui é da ÚLTIMO QUADRO aqui em BH. Produzimos lookbooks, provadores e vídeos verticais para marcas e confecções com foco em caimento, textura de tecido e entrega ágil, com prévias no mesmo dia para você já subir os lançamentos no Instagram e no WhatsApp de vendas.

Organizamos os formatos de diária e pacotes para a {{nome_empresa}} neste link:
{{link_proposta}}

Se estiver preparando o próximo drop perto de {{proxima_data_livre}}, podemos montar um roteiro sob medida para a coleção.`,
        createdAt: hoursAgo(300),
        updatedAt: hoursAgo(300),
      },
      {
        id: "tpl-parceria-modelos",
        name: "Parceiros (Somente Modelos): Parceria VIP 15% Pix",
        funnel: "geral",
        channel: "whatsapp",
        subject: "Parceria VIP para Modelos de Provador BH | ÚLTIMO QUADRO",
        body: `Oi {{nome_contato}}, tudo bem? Aqui é da ÚLTIMO QUADRO aqui em BH.

Acompanhamos seu trabalho como modelo de provador e queremos te convidar para nossa Parceria VIP com marcas de moda em BH e Barro Preto:
- 15% de comissão direta via Pix em cada produção fechada por indicação sua;
- Prévias no mesmo dia e vídeos verticais em alta definição que também fortalecem o seu portfólio.

Aqui estão nossos formatos de Moda para você conhecer nosso padrão de entrega:
{{link_proposta}}

Se fizer sentido, podemos conversar perto de {{proxima_data_livre}} para te incluir no nosso grupo de parceiras.`,
        createdAt: hoursAgo(300),
        updatedAt: hoursAgo(300),
      },
      {
        id: "tpl-gastronomia-ifood",
        name: "Gastronomia: Fotografia de Pratos & Vídeos de Salão",
        funnel: "gastronomia",
        channel: "ambos",
        subject: "Fotografia gastronômica e vídeos | {{nome_empresa}} | ÚLTIMO QUADRO",
        body: `Olá {{nome_contato}}, tudo bem?

Aqui é da ÚLTIMO QUADRO (BH e Nova Lima). Levamos nosso estúdio portátil direto para o salão da {{nome_empresa}}, fora do horário de pico, para fotografar os pratos com luz natural controlada (tanto para Instagram quanto otimizados para cardápio e iFood) junto com vídeos curtos que valorizam preparo e textura.

Deixamos os formatos e valores organizados para vocês avaliarem com calma:
{{link_proposta}}

Temos janela disponível perto de {{proxima_data_livre}}. Se quiserem atualizar o visual do cardápio ou lançar novos pratos, fico à disposição.`,
        createdAt: hoursAgo(300),
        updatedAt: hoursAgo(300),
      },
      {
        id: "tpl-nightlife-promoters",
        name: "Nightlife & Bares: Cobertura Noturna & Aftermovie",
        funnel: "nightlife",
        channel: "whatsapp",
        subject: "Cobertura noturna e aftermovie | {{nome_empresa}} | ÚLTIMO QUADRO",
        body: `Olá {{nome_contato}}, tudo bem? Aqui é da ÚLTIMO QUADRO em BH.

Trabalhamos na cobertura de bares, rooftops e noites autorais com foco em atmosfera real de baixa luz e vídeos verticais editados no ritmo da casa, entregando prévias já no início da tarde seguinte, enquanto o público ainda está repercutindo a noite nos stories.

Montamos o portal com as opções avulsas e de residência mensal para a {{nome_empresa}}:
{{link_proposta}}

Temos agenda aberta perto de {{proxima_data_livre}}. Se fizer sentido para as próximas datas da casa, podemos alinhar por aqui.`,
        createdAt: hoursAgo(300),
        updatedAt: hoursAgo(300),
      },
      ...createPhase2FollowupTemplates(),
    ],
  };
}

export const DEMO_BH_PLACES: PlaceCandidate[] = [
  {
    placeId: "bh-place-01",
    name: "Osteria Lourdes Eventos & Gastronomia",
    phone: "(31) 3291-4820",
    address: "Rua Curitiba, 2244, Lourdes, Belo Horizonte - MG",
    neighborhood: "Lourdes",
    website: "https://osterialourdes.com.br",
    category: "Restaurante & Gastronomia",
    rating: 4.8,
    suggestedFunnel: "gastronomia",
  },
  {
    placeId: "bh-place-02",
    name: "Casa Marília Rooftop & Lounge",
    phone: "(31) 99318-7740",
    address: "Rua Marília de Dirceu, 189, Lourdes, Belo Horizonte - MG",
    neighborhood: "Lourdes",
    website: "https://casamariliaeventos.com.br",
    category: "Lounge & Nightlife",
    rating: 4.9,
    suggestedFunnel: "nightlife",
  },
  {
    placeId: "bh-place-03",
    name: "Fio Nobre Confecções Atacado",
    phone: "(31) 3295-6110",
    address: "Rua Guajajaras, 1520, Barro Preto, Belo Horizonte - MG",
    neighborhood: "Barro Preto",
    website: "https://fionobremoda.com.br",
    category: "Moda & Confecção",
    rating: 4.7,
    suggestedFunnel: "moda",
  },
  {
    placeId: "bh-place-04",
    name: "Maison Verbena Tricot & Alfaiataria",
    phone: "(31) 98412-3095",
    address: "Rua Uberaba, 412, Barro Preto, Belo Horizonte - MG",
    neighborhood: "Barro Preto",
    website: "https://maisonverbena.com.br",
    category: "Moda Feminina Atacado",
    rating: 4.8,
    suggestedFunnel: "moda",
  },
  {
    placeId: "bh-place-05",
    name: "Villa Pampulha Centro de Convenções",
    phone: "(31) 3491-9050",
    address: "Av. Otacílio Negrão de Lima, 4120, Pampulha, Belo Horizonte - MG",
    neighborhood: "Pampulha",
    website: "https://villapampulhaeventos.com.br",
    category: "Espaço de Eventos Corporativos",
    rating: 4.8,
    suggestedFunnel: "corporativo",
  },
  {
    placeId: "bh-place-06",
    name: "Savassi Executive Hotel & Auditório",
    phone: "(31) 3261-8800",
    address: "Rua Antônio de Albuquerque, 790, Savassi, Belo Horizonte - MG",
    neighborhood: "Savassi",
    website: "https://savassiexecutive.com.br",
    category: "Hotel Corporativo",
    rating: 4.6,
    suggestedFunnel: "corporativo",
  },
  {
    placeId: "bh-place-07",
    name: "Instituto Aura Estética Avançada",
    phone: "(31) 99514-6280",
    address: "Av. do Contorno, 6594, Funcionários, Belo Horizonte - MG",
    neighborhood: "Funcionários",
    website: "https://institutoaurabh.com.br",
    category: "Clínica de Estética & Wellness",
    rating: 4.9,
    suggestedFunnel: "estetica",
  },
  {
    placeId: "bh-place-08",
    name: "Mirante Vila da Serra Corporativo",
    phone: "(31) 3286-7410",
    address: "Alameda Oscar Niemeyer, 950, Vila da Serra, Nova Lima - MG",
    neighborhood: "Vila da Serra",
    website: "https://miranteviladaserra.com.br",
    category: "Espaço Corporativo",
    rating: 4.7,
    suggestedFunnel: "corporativo",
  },
];
