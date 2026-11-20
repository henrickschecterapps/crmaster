import { CrmStoreData, PlaceCandidate, ScriptTemplate } from "@/types/crm";
import { buildPostSaleChecklist } from "@/lib/utils";

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

export function createPhase2FollowupTemplates(): ScriptTemplate[] {
  return [
    {
      id: "tpl-followup-dia2",
      name: "Follow-up Automático — Dia 2 (Retomada Suave)",
      funnel: "geral",
      channel: "ambos",
      subject:
        "Re: Proposta Fotografia & Audiovisual — {{nome_empresa}} | Henrique Matos",
      body: `Olá {{nome_contato}}, tudo bem?

Passando rapidamente para saber se você conseguiu abrir a proposta personalizada que preparei para a {{nome_empresa}}.

Caso queira ajustar a carga horária ou incluir o aftermovie vertical (Reels), consigo adaptar o formato para atender exatamente o orçamento do time.

Deixo novamente o link interativo aqui para facilitar:
{{link_proposta}}

Me avise se fizer sentido alinharmos essa semana!`,
      createdAt: hoursAgo(280),
      updatedAt: hoursAgo(280),
    },
    {
      id: "tpl-followup-dia5",
      name: "Follow-up Automático — Dia 5 (Último Toque / Escassez)",
      funnel: "geral",
      channel: "ambos",
      subject:
        "Última verificação de agenda ({{proxima_data_livre}}) — {{nome_empresa}}",
      body: `Olá {{nome_contato}}, tudo bem?

Estou fechando as últimas datas da nossa agenda em Belo Horizonte perto de {{proxima_data_livre}} e não queria deixar a {{nome_empresa}} sem resposta antes de liberar o espaço para outras solicitações.

Se o evento ainda estiver nos planos, você pode selecionar o pacote e reservar diretamente pelo link abaixo:
{{link_proposta}}

Se decidir deixar para um próximo momento, sem problemas — fico à disposição!`,
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
      studioName: "Henrique Matos Studio",
      nextAvailableDate: "05/12/2026",
      whatsappProvider: "evolution",
      whatsappApiUrl: process.env.WHATSAPP_API_URL || "",
      whatsappApiKey: process.env.WHATSAPP_API_KEY || "",
      whatsappInstance: process.env.WHATSAPP_INSTANCE || "",
      adminEmail: process.env.ADMIN_EMAIL || "henrickschecter@gmail.com",
      pixKey: process.env.NEXT_PUBLIC_PIX_KEY || "henrickschecter@gmail.com",
      pixRecipientName: "Henrique Matos",
      pixCity: "BELO HORIZONTE",
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
        address: "Av. Getúlio Vargas, 1420 — Funcionários, Belo Horizonte",
        website: "https://verticeeng.com.br",
        funnel: "festas_corporativas",
        stage: "contatado",
        estimatedValue: 1950,
        origin: "Indicação — Espaço de Eventos",
        partnerId: "partner-01",
        commissionPaid: false,
        paymentStatus: "pendente",
        notes:
          "Confraternização anual para 120 colaboradores na Pampulha. Interessada no pacote Prime com aftermovie vertical para LinkedIn.",
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
        ultimaInteracaoEm: hoursAgo(56), // > 48h -> Elegível para Follow-up Dia 2 + Alerta Amarelo
        createdAt: hoursAgo(96),
        updatedAt: hoursAgo(56),
        interactions: [
          {
            id: "int-01a",
            leadId: "lead-bh-01",
            type: "sistema",
            title: "Lead cadastrado no funil Festas Corporativas",
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
              "Enviada apresentação do estúdio e portfólio corporativo. Mariana pediu proposta para alinhar com a diretoria.",
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
        address: "Rua Pernambuco, 1080 — Savassi, Belo Horizonte",
        website: "https://casasavassi.adv.br",
        funnel: "festas_corporativas",
        stage: "sinal_pago",
        estimatedValue: 2550,
        origin: "Indicação — Espaço de Eventos",
        partnerId: "partner-01",
        commissionPaid: false,
        paymentStatus: "sinal_pago",
        notes:
          "Jantar de encerramento e premiação de sócios. Pacote Corporate Prime + Hora Extra + Real-Time. Sinal de 50% (R$ 1.275) confirmado via PIX.",
        eventDate: "2026-12-04",
        cnpj: "34.819.204/0001-62",
        razaoSocial: "Mascarenhas & Associados Sociedade de Advogados",
        proposalPackage: "Corporate Prime",
        proposalAddons: ["Hora Extra de Cobertura", "Entrega Real-Time"],
        visualizadaEm: hoursAgo(38),
        visualizacoesProposta: 3,
        propostaAprovadaEm: hoursAgo(20),
        automacaoAtiva: false, // Trava de segurança ativa (Sinal Pago)
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
              "Pacote Corporate Prime + Hora Extra + Entrega Real-Time (R$ 2.550). Data reservada: 04/12/2026.",
            createdAt: hoursAgo(20),
          },
          {
            id: "int-02c",
            leadId: "lead-bh-02",
            type: "pagamento",
            title: "Sinal de 50% confirmado",
            description:
              "PIX de R$ 1.275,00 recebido. NF-e de entrada emitida.",
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
        address: "Rua Mato Grosso, 539 — Barro Preto, Belo Horizonte",
        website: "https://atelieserena.com.br",
        funnel: "lojas_barro_preto",
        stage: "proposta_aberta",
        estimatedValue: 2800,
        origin: "Parceria — Modelo de Provador",
        partnerId: "partner-02",
        commissionPaid: false,
        paymentStatus: "pendente",
        notes:
          "Catálogo Express coleção Alto Verão (35 looks + 4 reels verticais). Aguardando confirmação da grade com a confecção.",
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
        ultimaInteracaoEm: hoursAgo(148), // > 5 dias -> Elegível para Follow-up Dia 5 (Último Toque) + Alerta Vermelho
        createdAt: hoursAgo(210),
        updatedAt: hoursAgo(148),
        interactions: [
          {
            id: "int-03a",
            leadId: "lead-bh-03",
            type: "sistema",
            title: "Indicação via Isabela Ferraz",
            description:
              "Modelo de provador indicou a marca para campanha de alto verão.",
            createdAt: hoursAgo(210),
          },
          {
            id: "int-03b",
            leadId: "lead-bh-03",
            type: "proposta_vista",
            title: "Proposta web visualizada",
            description: "Camila visualizou a proposta comercial.",
            createdAt: hoursAgo(152),
          },
          {
            id: "int-03c",
            leadId: "lead-bh-03",
            type: "nota",
            title: "Follow-up pendente de resposta",
            description:
              "Pediu para retornar após fechamento da grade de tecidos.",
            createdAt: hoursAgo(148),
          },
        ],
      },
      {
        id: "lead-bh-04",
        companyName: "Bela Trama Atacado & Confecções",
        contactName: "Thiago Bittencourt",
        contactRole: "Gerente Comercial",
        phone: "(31) 99208-6341",
        email: "thiago@belatrama.com.br",
        instagram: "@belatramabh",
        neighborhood: "Barro Preto",
        address: "Rua Araguari, 358 — Barro Preto, Belo Horizonte",
        website: "https://belatrama.com.br",
        funnel: "lojas_barro_preto",
        stage: "fechado",
        estimatedValue: 3600,
        origin: "Parceria — Modelo de Provador",
        partnerId: "partner-02",
        commissionPaid: false,
        paymentStatus: "quitado",
        notes:
          "Diária completa Catálogo Express + Reels de provador no estúdio. Entrega final concluída e pagamento 100% quitado.",
        eventDate: "2026-11-12",
        cnpj: "19.442.780/0001-11",
        razaoSocial: "Bela Trama Confecções Ltda",
        visualizadaEm: hoursAgo(190),
        visualizacoesProposta: 4,
        propostaAprovadaEm: hoursAgo(170),
        automacaoAtiva: false,
        respondeu: true,
        followupStep: 0,
        tags: [],
        lastRadarAlertAt: hoursAgo(190),
        contractDocument: null,
        postSaleChecklist: buildPostSaleChecklist("lojas_barro_preto"),
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
              "Parcela final de R$ 1.800,00 liquidada. Galeria e reels entregues via link.",
            createdAt: hoursAgo(18),
          },
        ],
      },
      {
        id: "lead-bh-05",
        companyName: "Dra. Letícia Vasconcelos — Dermatologia",
        contactName: "Letícia Vasconcelos",
        contactRole: "Médica Dermatologista",
        phone: "(31) 99473-5029",
        email: "contato@draleticiavasconcelos.com.br",
        instagram: "@draleticiavasconcelos",
        neighborhood: "Lourdes",
        address: "Rua São Paulo, 2110 — Lourdes, Belo Horizonte",
        website: "https://draleticiavasconcelos.com.br",
        funnel: "retratos_lifestyle",
        stage: "captado",
        estimatedValue: 1650,
        origin: "Google Places BH",
        partnerId: null,
        commissionPaid: false,
        paymentStatus: "pendente",
        notes:
          "Clínica recém-reformada no Lourdes. Oportunidade de ensaio de posicionamento executivo, retratos editoriais e vídeo manifesto.",
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
        ultimaInteracaoEm: hoursAgo(74), // > 48h -> Alerta Amarelo
        createdAt: hoursAgo(74),
        updatedAt: hoursAgo(74),
        interactions: [
          {
            id: "int-05a",
            leadId: "lead-bh-05",
            type: "sistema",
            title: "Lead captado via Prospecção BH",
            description:
              "Clínica identificada na região do Lourdes com forte presença digital.",
            createdAt: hoursAgo(74),
          },
        ],
      },
    ],
    templates: [
      {
        id: "tpl-rh-endomarketing",
        name: "Abordagem RH / Endomarketing (Festas de Fim de Ano)",
        funnel: "festas_corporativas",
        channel: "ambos",
        subject:
          "Cobertura Fotográfica & Vídeo Corporativo — {{nome_empresa}} | Henrique Matos Studio",
        body: `Olá {{nome_contato}}, tudo bem?

Aqui é o Henrique Matos, fotógrafo e diretor audiovisual em Belo Horizonte especializado em eventos corporativos e Employer Branding.

Acompanhei o momento da {{nome_empresa}} e sei o quanto a confraternização de fim de ano fortalece a cultura interna e o posicionamento da marca no LinkedIn.

Trabalhamos com equipamento full-frame com backup duplo, emissão de Nota Fiscal e entrega de 15 fotos selecionadas já no dia seguinte (24h) para o time de RH e Comunicação usar imediatamente.

Ainda tenho agenda aberta para {{proxima_data_livre}} e preparei uma proposta interativa exclusiva para a {{nome_empresa}} aqui:
{{link_proposta}}

Podemos reservar essa data ou alinhar os detalhes em 5 minutos?`,
        createdAt: hoursAgo(300),
        updatedAt: hoursAgo(300),
      },
      {
        id: "tpl-parceria-espacos",
        name: "Parceria com Espaços de Eventos (15% comissão)",
        funnel: "festas_corporativas",
        channel: "ambos",
        subject:
          "Parceria Audiovisual Corporativa (15% de comissão) — {{nome_empresa}}",
        body: `Olá {{nome_contato}}, tudo bem?

Sou o Henrique Matos, do estúdio Henrique Matos Fotografia & Audiovisual aqui em BH.

Atendemos empresas de médio e grande porte com cobertura corporativa ágil (prévia em 24h, aftermovie vertical e emissão de NF) e estamos selecionando gerentes de espaços de eventos estratégicos em Belo Horizonte para parceria recorrente.

Como funciona na prática para a {{nome_empresa}}:
- Repasse de 15% de comissão direta por indicação fechada (pago assim que o evento confirma).
- Entrega de fotos em alta resolução do espaço montado para o seu portfólio comercial sem custo adicional.
- Atendimento impecável que valoriza a experiência do seu cliente corporativo.

Deixo aqui um modelo real da nossa proposta interativa para você conhecer o padrão de apresentação:
{{link_proposta}}

Tem disponibilidade em {{proxima_data_livre}} para um café rápido aí no espaço ou uma chamada de 10 minutos?`,
        createdAt: hoursAgo(300),
        updatedAt: hoursAgo(300),
      },
      {
        id: "tpl-parceria-modelos",
        name: "Parceria com Modelos de Provador (Barro Preto)",
        funnel: "lojas_barro_preto",
        channel: "whatsapp",
        subject:
          "Parceria Catálogo Express Barro Preto (15% comissão) — {{nome_contato}}",
        body: `Oi {{nome_contato}}, tudo bem? Aqui é o Henrique Matos (fotógrafo e filmmaker aqui de BH).

Vi seu trabalho como modelo de provador no Barro Preto e curti muito a naturalidade diante das câmeras!

Estou expandindo nossa operação de Catálogo Express + Reels de alta conversão para confecções e marcas atacadistas da região e montando um grupo fechado de modelos parceiras.

Na nossa parceria:
- Você recebe 15% de comissão em toda loja ou marca da {{nome_empresa}} ou da sua rede que fechar produção comigo.
- Além disso, você sempre recebe cortes verticais e retratos em alta resolução para atualizar seu book e redes.

Montei um link rápido com nosso formato de atendimento para você enviar ou consultar quando surgir oportunidade:
{{link_proposta}}

Podemos conversar perto de {{proxima_data_livre}} para te incluir na nossa lista de casting do mês?`,
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
    address: "Rua Curitiba, 2244 — Lourdes, Belo Horizonte - MG",
    neighborhood: "Lourdes",
    website: "https://osterialourdes.com.br",
    category: "Restaurante para Eventos",
    rating: 4.8,
    suggestedFunnel: "festas_corporativas",
  },
  {
    placeId: "bh-place-02",
    name: "Casa Marília Rooftop & Lounge",
    phone: "(31) 99318-7740",
    address: "Rua Marília de Dirceu, 189 — Lourdes, Belo Horizonte - MG",
    neighborhood: "Lourdes",
    website: "https://casamariliaeventos.com.br",
    category: "Espaço Corporativo & Restaurante",
    rating: 4.9,
    suggestedFunnel: "festas_corporativas",
  },
  {
    placeId: "bh-place-03",
    name: "Fio Nobre Confecções Atacado",
    phone: "(31) 3295-6110",
    address: "Rua Guajajaras, 1520 — Barro Preto, Belo Horizonte - MG",
    neighborhood: "Barro Preto",
    website: "https://fionobremoda.com.br",
    category: "Confecção & Atacado",
    rating: 4.7,
    suggestedFunnel: "lojas_barro_preto",
  },
  {
    placeId: "bh-place-04",
    name: "Maison Verbena Tricot & Alfaiataria",
    phone: "(31) 98412-3095",
    address: "Rua Uberaba, 412 — Barro Preto, Belo Horizonte - MG",
    neighborhood: "Barro Preto",
    website: "https://maisonverbena.com.br",
    category: "Moda Feminina Atacado",
    rating: 4.8,
    suggestedFunnel: "lojas_barro_preto",
  },
  {
    placeId: "bh-place-05",
    name: "Bela Trama Atacado & Confecções",
    phone: "(31) 99208-6341",
    address: "Rua Araguari, 358 — Barro Preto, Belo Horizonte - MG",
    neighborhood: "Barro Preto",
    website: "https://belatrama.com.br",
    category: "Confecção & Moda",
    rating: 4.9,
    suggestedFunnel: "lojas_barro_preto",
  },
  {
    placeId: "bh-place-06",
    name: "Villa Pampulha Centro de Convenções",
    phone: "(31) 3491-9050",
    address: "Av. Otacílio Negrão de Lima, 4120 — Pampulha, Belo Horizonte - MG",
    neighborhood: "Pampulha",
    website: "https://villapampulhaeventos.com.br",
    category: "Espaço de Eventos Corporativos",
    rating: 4.8,
    suggestedFunnel: "festas_corporativas",
  },
  {
    placeId: "bh-place-07",
    name: "Savassi Executive Hotel & Auditório",
    phone: "(31) 3261-8800",
    address: "Rua Antônio de Albuquerque, 790 — Savassi, Belo Horizonte - MG",
    neighborhood: "Savassi",
    website: "https://savassiexecutive.com.br",
    category: "Hotel Corporativo",
    rating: 4.6,
    suggestedFunnel: "festas_corporativas",
  },
  {
    placeId: "bh-place-08",
    name: "Instituto Aura Estética Avançada",
    phone: "(31) 99514-6280",
    address: "Av. do Contorno, 6594 — Funcionários, Belo Horizonte - MG",
    neighborhood: "Funcionários",
    website: "https://institutoaurabh.com.br",
    category: "Clínica & Lifestyle",
    rating: 4.9,
    suggestedFunnel: "retratos_lifestyle",
  },
  {
    placeId: "bh-place-09",
    name: "Studio Horizonte Arquitetura & Interiores",
    phone: "(31) 99180-2344",
    address: "Rua Cláudio Manoel, 620 — Funcionários, Belo Horizonte - MG",
    neighborhood: "Funcionários",
    website: "https://studiohorizontearq.com.br",
    category: "Escritório de Arquitetura",
    rating: 4.9,
    suggestedFunnel: "retratos_lifestyle",
  },
  {
    placeId: "bh-place-10",
    name: "Mirante Belvedere Espaço Corporativo",
    phone: "(31) 3286-7410",
    address: "Av. Luiz Paulo Franco, 950 — Belvedere, Belo Horizonte - MG",
    neighborhood: "Belvedere",
    website: "https://mirantebelvedere.com.br",
    category: "Espaço de Eventos",
    rating: 4.7,
    suggestedFunnel: "festas_corporativas",
  },
];
