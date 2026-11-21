import { promises as fs } from "fs";
import path from "path";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import {
  BRAND_DEFAULTS,
  ContractDocumentRef,
  CronExecutionLog,
  CrmStoreData,
  FunnelId,
  InteractionType,
  Lead,
  LeadInteraction,
  normalizeFunnelId,
  normalizeTemplateFunnelId,
  Partner,
  PostSaleChecklistItem,
  ScriptTemplate,
  StudioSettings,
  WhatsappQueueJob,
} from "@/types/crm";
import {
  createInitialSeedData,
  createPhase2FollowupTemplates,
} from "@/lib/seed";
import {
  FIRESTORE_COLLECTIONS,
  getFirestoreDb,
  isFirebaseConfigured,
  stripUndefined,
} from "@/lib/firebase";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import {
  buildPostSaleChecklist,
  generateId,
  normalizeName,
  normalizePhone,
} from "@/lib/utils";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "crm-store.json");

let memoryFallback: CrmStoreData | null = null;

function hydrateStoreData(raw: CrmStoreData): CrmStoreData {
  const defaults = createInitialSeedData();

  const settings: StudioSettings = {
    ...defaults.settings,
    ...raw.settings,
    studioName:
      !raw.settings?.studioName ||
      raw.settings.studioName === "Henrique Matos Studio"
        ? BRAND_DEFAULTS.name
        : raw.settings.studioName,
    whatsappProvider: raw.settings?.whatsappProvider ?? "evolution",
    whatsappApiUrl:
      raw.settings?.whatsappApiUrl ?? process.env.WHATSAPP_API_URL ?? "",
    whatsappApiKey:
      raw.settings?.whatsappApiKey ?? process.env.WHATSAPP_API_KEY ?? "",
    whatsappInstance:
      raw.settings?.whatsappInstance ?? process.env.WHATSAPP_INSTANCE ?? "",
    adminEmail:
      raw.settings?.adminEmail ||
      process.env.ADMIN_EMAIL ||
      BRAND_DEFAULTS.email,
    pixKey:
      raw.settings?.pixKey ||
      process.env.NEXT_PUBLIC_PIX_KEY ||
      BRAND_DEFAULTS.email,
    pixRecipientName:
      !raw.settings?.pixRecipientName ||
      raw.settings.pixRecipientName === "Henrique Matos"
        ? BRAND_DEFAULTS.pixRecipientName
        : raw.settings.pixRecipientName,
    pixCity: raw.settings?.pixCity || BRAND_DEFAULTS.pixCity,
  };

  const leads: Lead[] = (raw.leads ?? []).map((lead) => {
    const normalizedFunnel = normalizeFunnelId(lead.funnel);
    const isClosedOrPaid =
      lead.stage === "sinal_pago" || lead.stage === "fechado";
    return {
      ...lead,
      funnel: normalizedFunnel,
      automacaoAtiva:
        typeof lead.automacaoAtiva === "boolean"
          ? lead.automacaoAtiva
          : !isClosedOrPaid,
      respondeu:
        typeof lead.respondeu === "boolean" ? lead.respondeu : isClosedOrPaid,
      followupStep: (lead.followupStep ?? 0) as 0 | 1 | 2,
      tags: Array.isArray(lead.tags) ? lead.tags : [],
      lastRadarAlertAt: lead.lastRadarAlertAt ?? null,
      contractDocument: lead.contractDocument ?? null,
      postSaleChecklist: Array.isArray(lead.postSaleChecklist)
        ? lead.postSaleChecklist
        : lead.stage === "fechado"
        ? buildPostSaleChecklist(normalizedFunnel, lead.updatedAt)
        : [],
      interactions: Array.isArray(lead.interactions) ? lead.interactions : [],
    };
  });

  // Backfill Phase 2 follow-up templates and normalize legacy funnel tags
  const existingTemplates = (Array.isArray(raw.templates) ? raw.templates : []).map(
    (tpl) => ({
      ...tpl,
      funnel: normalizeTemplateFunnelId(tpl.funnel),
    })
  );
  const p2Templates = createPhase2FollowupTemplates();
  const templates = [...existingTemplates];
  for (const tpl of p2Templates) {
    if (!templates.some((t) => t.id === tpl.id)) {
      templates.push(tpl);
    }
  }

  return {
    settings,
    partners: Array.isArray(raw.partners) ? raw.partners : defaults.partners,
    leads,
    templates,
  };
}

async function readLocalStore(): Promise<CrmStoreData> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const parsed = hydrateStoreData(JSON.parse(raw) as CrmStoreData);
    memoryFallback = parsed;
    return parsed;
  } catch {
    if (memoryFallback) return memoryFallback;
    const seeded = createInitialSeedData();
    await writeLocalStore(seeded);
    return seeded;
  }
}

async function writeLocalStore(data: CrmStoreData): Promise<void> {
  memoryFallback = data;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // Graceful in-memory fallback if filesystem is read-only
  }
}

// Firebase Firestore adapter

async function seedFirestoreIfEmpty(): Promise<CrmStoreData | null> {
  const db = getFirestoreDb();
  if (!db) return null;

  const settingsSnap = await getDoc(
    doc(db, FIRESTORE_COLLECTIONS.settings, "default")
  );
  if (settingsSnap.exists()) return null;

  const seed = createInitialSeedData();
  const batch = writeBatch(db);

  batch.set(
    doc(db, FIRESTORE_COLLECTIONS.settings, "default"),
    stripUndefined(seed.settings)
  );
  for (const partner of seed.partners) {
    batch.set(
      doc(db, FIRESTORE_COLLECTIONS.partners, partner.id),
      stripUndefined(partner)
    );
  }
  for (const lead of seed.leads) {
    batch.set(
      doc(db, FIRESTORE_COLLECTIONS.leads, lead.id),
      stripUndefined(lead)
    );
  }
  for (const tpl of seed.templates) {
    batch.set(
      doc(db, FIRESTORE_COLLECTIONS.templates, tpl.id),
      stripUndefined(tpl)
    );
  }

  await batch.commit();
  return seed;
}

async function readFirestoreStore(): Promise<CrmStoreData | null> {
  const db = getFirestoreDb();
  if (!db) return null;

  const seeded = await seedFirestoreIfEmpty();
  if (seeded) return hydrateStoreData(seeded);

  const [settingsSnap, partnersSnap, leadsSnap, templatesSnap] =
    await Promise.all([
      getDoc(doc(db, FIRESTORE_COLLECTIONS.settings, "default")),
      getDocs(collection(db, FIRESTORE_COLLECTIONS.partners)),
      getDocs(collection(db, FIRESTORE_COLLECTIONS.leads)),
      getDocs(collection(db, FIRESTORE_COLLECTIONS.templates)),
    ]);

  const defaults = createInitialSeedData();
  const settings = settingsSnap.exists()
    ? (settingsSnap.data() as StudioSettings)
    : defaults.settings;

  const partners = partnersSnap.docs
    .map((d) => d.data() as Partner)
    .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));

  const leads = leadsSnap.docs
    .map((d) => d.data() as Lead)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  const templates = templatesSnap.docs
    .map((d) => d.data() as ScriptTemplate)
    .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));

  return hydrateStoreData({
    settings,
    partners: partners.length > 0 ? partners : defaults.partners,
    leads,
    templates: templates.length > 0 ? templates : defaults.templates,
  });
}

// Supabase adapter (optional alternative)

function mapSupabaseLeadRow(
  row: Record<string, unknown>,
  interactions: LeadInteraction[]
): Lead {
  const stage = row.stage as Lead["stage"];
  const isClosedOrPaid = stage === "sinal_pago" || stage === "fechado";
  return {
    id: String(row.id),
    companyName: String(row.company_name),
    contactName: String(row.contact_name),
    contactRole: row.contact_role ? String(row.contact_role) : undefined,
    phone: String(row.phone),
    email: row.email ? String(row.email) : "",
    instagram: row.instagram ? String(row.instagram) : undefined,
    neighborhood: row.neighborhood ? String(row.neighborhood) : undefined,
    address: row.address ? String(row.address) : undefined,
    website: row.website ? String(row.website) : undefined,
    funnel: row.funnel as Lead["funnel"],
    stage,
    estimatedValue: Number(row.estimated_value ?? 0),
    origin: String(row.origin ?? "Cadastro Manual"),
    partnerId: row.partner_id ? String(row.partner_id) : null,
    commissionPaid: Boolean(row.commission_paid),
    paymentStatus: (row.payment_status as Lead["paymentStatus"]) ?? "pendente",
    notes: String(row.notes ?? ""),
    eventDate: row.event_date ? String(row.event_date) : undefined,
    cnpj: row.cnpj ? String(row.cnpj) : undefined,
    cpf: row.cpf ? String(row.cpf) : undefined,
    razaoSocial: row.razao_social ? String(row.razao_social) : undefined,
    proposalPackage: row.proposal_package
      ? String(row.proposal_package)
      : undefined,
    proposalAddons: Array.isArray(row.proposal_addons)
      ? (row.proposal_addons as string[])
      : [],
    visualizadaEm: row.visualizada_em ? String(row.visualizada_em) : null,
    visualizacoesProposta: Number(row.visualizacoes_proposta ?? 0),
    propostaAprovadaEm: row.proposta_aprovada_em
      ? String(row.proposta_aprovada_em)
      : null,
    automacaoAtiva:
      typeof row.automacao_ativa === "boolean"
        ? row.automacao_ativa
        : !isClosedOrPaid,
    respondeu:
      typeof row.respondeu === "boolean" ? row.respondeu : isClosedOrPaid,
    followupStep: Number(row.followup_step ?? 0) as 0 | 1 | 2,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    lastRadarAlertAt: row.last_radar_alert_at
      ? String(row.last_radar_alert_at)
      : null,
    contractDocument:
      (row.contract_document as ContractDocumentRef | null) ?? null,
    postSaleChecklist: Array.isArray(row.post_sale_checklist)
      ? (row.post_sale_checklist as PostSaleChecklistItem[])
      : [],
    ultimaInteracaoEm: String(row.ultima_interacao_em),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    interactions,
  };
}

function toSupabaseLeadPayload(lead: Lead): Record<string, unknown> {
  return {
    id: lead.id,
    company_name: lead.companyName,
    contact_name: lead.contactName,
    contact_role: lead.contactRole ?? null,
    phone: lead.phone,
    email: lead.email || null,
    instagram: lead.instagram ?? null,
    neighborhood: lead.neighborhood ?? null,
    address: lead.address ?? null,
    website: lead.website ?? null,
    funnel: lead.funnel,
    stage: lead.stage,
    estimated_value: lead.estimatedValue,
    origin: lead.origin,
    partner_id: lead.partnerId ?? null,
    commission_paid: lead.commissionPaid,
    payment_status: lead.paymentStatus,
    notes: lead.notes,
    event_date: lead.eventDate ?? null,
    cnpj: lead.cnpj ?? null,
    cpf: lead.cpf ?? null,
    razao_social: lead.razaoSocial ?? null,
    proposal_package: lead.proposalPackage ?? null,
    proposal_addons: lead.proposalAddons ?? [],
    visualizada_em: lead.visualizadaEm ?? null,
    visualizacoes_proposta: lead.visualizacoesProposta,
    proposta_aprovada_em: lead.propostaAprovadaEm ?? null,
    automacao_ativa: lead.automacaoAtiva,
    respondeu: lead.respondeu,
    followup_step: lead.followupStep,
    tags: lead.tags ?? [],
    last_radar_alert_at: lead.lastRadarAlertAt ?? null,
    contract_document: lead.contractDocument ?? null,
    post_sale_checklist: lead.postSaleChecklist ?? [],
    ultima_interacao_em: lead.ultimaInteracaoEm,
    created_at: lead.createdAt,
    updated_at: lead.updatedAt,
  };
}

async function seedSupabaseIfEmpty(): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { count } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true });

  if ((count ?? 0) > 0) return;

  const seed = createInitialSeedData();

  await supabase.from("studio_settings").upsert({
    id: seed.settings.id,
    monthly_goal: seed.settings.monthlyGoal,
    studio_name: seed.settings.studioName,
    next_available_date: seed.settings.nextAvailableDate,
    whatsapp_provider: seed.settings.whatsappProvider,
    whatsapp_api_url: seed.settings.whatsappApiUrl,
    whatsapp_api_key: seed.settings.whatsappApiKey,
    whatsapp_instance: seed.settings.whatsappInstance,
    admin_email: seed.settings.adminEmail,
    pix_key: seed.settings.pixKey,
    pix_recipient_name: seed.settings.pixRecipientName,
    pix_city: seed.settings.pixCity,
    updated_at: seed.settings.updatedAt,
  });

  if (seed.partners.length > 0) {
    await supabase.from("partners").upsert(
      seed.partners.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        company: p.company,
        phone: p.phone,
        commission_rate: p.commissionRate,
        created_at: p.createdAt,
      }))
    );
  }

  if (seed.templates.length > 0) {
    await supabase.from("script_templates").upsert(
      seed.templates.map((t) => ({
        id: t.id,
        name: t.name,
        funnel: t.funnel,
        channel: t.channel,
        subject: t.subject,
        body: t.body,
        created_at: t.createdAt,
        updated_at: t.updatedAt,
      }))
    );
  }

  for (const lead of seed.leads) {
    await supabase.from("leads").upsert(toSupabaseLeadPayload(lead));
    if (lead.interactions.length > 0) {
      await supabase.from("lead_interactions").upsert(
        lead.interactions.map((i) => ({
          id: i.id,
          lead_id: i.leadId,
          type: i.type,
          title: i.title,
          description: i.description,
          created_at: i.createdAt,
        }))
      );
    }
  }
}

// Public repository API (Firebase -> Supabase -> local JSON)

export async function getStoreData(): Promise<CrmStoreData> {
  if (isFirebaseConfigured()) {
    try {
      const firestoreData = await readFirestoreStore();
      if (firestoreData) {
        memoryFallback = firestoreData;
        return firestoreData;
      }
    } catch {
      // Fall through cleanly if Firestore rules/network temporarily fail
    }
  }

  if (isSupabaseConfigured()) {
    try {
      await seedSupabaseIfEmpty();
      const supabase = getSupabaseClient()!;

      const [settingsRes, partnersRes, leadsRes, interactionsRes, templatesRes] =
        await Promise.all([
          supabase
            .from("studio_settings")
            .select("*")
            .eq("id", "default")
            .maybeSingle(),
          supabase
            .from("partners")
            .select("*")
            .order("created_at", { ascending: true }),
          supabase
            .from("leads")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase
            .from("lead_interactions")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase
            .from("script_templates")
            .select("*")
            .order("created_at", { ascending: true }),
        ]);

      if (!leadsRes.error) {
        const interactionsByLead = new Map<string, LeadInteraction[]>();
        for (const row of interactionsRes.data ?? []) {
          const item: LeadInteraction = {
            id: String(row.id),
            leadId: String(row.lead_id),
            type: row.type as InteractionType,
            title: String(row.title),
            description: String(row.description ?? ""),
            createdAt: String(row.created_at),
          };
          const arr = interactionsByLead.get(item.leadId) ?? [];
          arr.push(item);
          interactionsByLead.set(item.leadId, arr);
        }

        const seed = createInitialSeedData();
        const sRow = settingsRes.data;
        const settings: StudioSettings = sRow
          ? {
              id: String(sRow.id),
              monthlyGoal: Number(sRow.monthly_goal),
              studioName: String(sRow.studio_name),
              nextAvailableDate: String(sRow.next_available_date),
              whatsappProvider:
                sRow.whatsapp_provider === "zapi" ? "zapi" : "evolution",
              whatsappApiUrl: String(sRow.whatsapp_api_url ?? ""),
              whatsappApiKey: String(sRow.whatsapp_api_key ?? ""),
              whatsappInstance: String(sRow.whatsapp_instance ?? ""),
              adminEmail: String(
                sRow.admin_email ||
                  process.env.ADMIN_EMAIL ||
                  "henrickschecter@gmail.com"
              ),
              pixKey: String(
                sRow.pix_key ||
                  process.env.NEXT_PUBLIC_PIX_KEY ||
                  "henrickschecter@gmail.com"
              ),
              pixRecipientName: String(
                sRow.pix_recipient_name || "Henrique Matos"
              ),
              pixCity: String(sRow.pix_city || "BELO HORIZONTE"),
              updatedAt: String(sRow.updated_at),
            }
          : seed.settings;

        const partners: Partner[] = (partnersRes.data ?? []).map((p) => ({
          id: String(p.id),
          name: String(p.name),
          role: p.role as Partner["role"],
          company: String(p.company ?? ""),
          phone: String(p.phone ?? ""),
          commissionRate: Number(p.commission_rate ?? 15),
          createdAt: String(p.created_at),
        }));

        const leads: Lead[] = (leadsRes.data ?? []).map((l) =>
          mapSupabaseLeadRow(l, interactionsByLead.get(String(l.id)) ?? [])
        );

        const templates: ScriptTemplate[] = (templatesRes.data ?? []).map(
          (t) => ({
            id: String(t.id),
            name: String(t.name),
            funnel: t.funnel as ScriptTemplate["funnel"],
            channel: t.channel as ScriptTemplate["channel"],
            subject: String(t.subject ?? ""),
            body: String(t.body),
            createdAt: String(t.created_at),
            updatedAt: String(t.updated_at),
          })
        );

        return hydrateStoreData({ settings, partners, leads, templates });
      }
    } catch {
      // Fall through to local store
    }
  }

  return readLocalStore();
}

export async function getLeadById(leadId: string): Promise<Lead | null> {
  if (isFirebaseConfigured()) {
    try {
      const db = getFirestoreDb();
      if (db) {
        const snap = await getDoc(doc(db, FIRESTORE_COLLECTIONS.leads, leadId));
        if (snap.exists()) {
          const lead = snap.data() as Lead;
          const hydrated = hydrateStoreData({
            settings: createInitialSeedData().settings,
            partners: [],
            leads: [lead],
            templates: [],
          });
          return hydrated.leads[0] ?? null;
        }
      }
    } catch {
      // Fall through to full store lookup
    }
  }

  const store = await getStoreData();
  return store.leads.find((l) => l.id === leadId) ?? null;
}

export interface CreateLeadInput {
  companyName: string;
  contactName: string;
  contactRole?: string;
  phone: string;
  email?: string;
  instagram?: string;
  neighborhood?: string;
  address?: string;
  website?: string;
  funnel: Lead["funnel"];
  stage?: Lead["stage"];
  estimatedValue: number;
  origin?: string;
  partnerId?: string | null;
  notes?: string;
  eventDate?: string;
}

export async function createLead(
  input: CreateLeadInput
): Promise<{ lead: Lead; duplicate: boolean }> {
  const store = await getStoreData();
  const normPhone = normalizePhone(input.phone);
  const normCompany = normalizeName(input.companyName);

  const existing = store.leads.find(
    (l) =>
      (normPhone && normalizePhone(l.phone) === normPhone) ||
      (normCompany && normalizeName(l.companyName) === normCompany)
  );

  if (existing) {
    return { lead: existing, duplicate: true };
  }

  const now = new Date().toISOString();
  const id = generateId("lead");
  const stage = input.stage ?? "captado";
  const initialInteraction: LeadInteraction = {
    id: generateId("int"),
    leadId: id,
    type: "sistema",
    title: "Lead adicionado ao CRM",
    description: `Origem: ${input.origin || "Cadastro Manual"}.`,
    createdAt: now,
  };

  const lead: Lead = {
    id,
    companyName: input.companyName.trim(),
    contactName: input.contactName.trim() || "Decisor Comercial",
    contactRole: input.contactRole?.trim(),
    phone: input.phone.trim(),
    email: input.email?.trim() || "",
    instagram: input.instagram?.trim(),
    neighborhood: input.neighborhood?.trim(),
    address: input.address?.trim(),
    website: input.website?.trim(),
    funnel: input.funnel,
    stage,
    estimatedValue: Number(input.estimatedValue) || 0,
    origin: input.origin?.trim() || "Cadastro Manual",
    partnerId: input.partnerId || null,
    commissionPaid: false,
    paymentStatus: "pendente",
    notes: input.notes?.trim() || "",
    eventDate: input.eventDate?.trim(),
    visualizadaEm: null,
    visualizacoesProposta: 0,
    propostaAprovadaEm: null,
    automacaoAtiva: stage !== "sinal_pago" && stage !== "fechado",
    respondeu: false,
    followupStep: 0,
    tags: [],
    lastRadarAlertAt: null,
    contractDocument: null,
    postSaleChecklist:
      stage === "fechado" ? buildPostSaleChecklist(input.funnel, now) : [],
    ultimaInteracaoEm: now,
    createdAt: now,
    updatedAt: now,
    interactions: [initialInteraction],
  };

  if (isFirebaseConfigured()) {
    try {
      const db = getFirestoreDb();
      if (db) {
        await setDoc(
          doc(db, FIRESTORE_COLLECTIONS.leads, lead.id),
          stripUndefined(lead)
        );
        return { lead, duplicate: false };
      }
    } catch {
      // Fallback below
    }
  }

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!;
    const { error } = await supabase
      .from("leads")
      .insert(toSupabaseLeadPayload(lead));
    if (!error) {
      await supabase.from("lead_interactions").insert({
        id: initialInteraction.id,
        lead_id: lead.id,
        type: initialInteraction.type,
        title: initialInteraction.title,
        description: initialInteraction.description,
        created_at: initialInteraction.createdAt,
      });
      return { lead, duplicate: false };
    }
  }

  store.leads.unshift(lead);
  await writeLocalStore(store);
  return { lead, duplicate: false };
}

export async function createLeadsBulk(
  inputs: CreateLeadInput[]
): Promise<{ imported: Lead[]; skippedDuplicates: number }> {
  const imported: Lead[] = [];
  let skippedDuplicates = 0;

  for (const item of inputs) {
    if (!item.companyName?.trim()) continue;
    const res = await createLead(item);
    if (res.duplicate) {
      skippedDuplicates += 1;
    } else {
      imported.push(res.lead);
    }
  }

  return { imported, skippedDuplicates };
}

export async function updateLead(
  leadId: string,
  patch: Partial<Lead>,
  logInteraction?: { type: InteractionType; title: string; description: string },
  touchLastInteraction: boolean = true
): Promise<Lead | null> {
  const store = await getStoreData();
  const idx = store.leads.findIndex((l) => l.id === leadId);
  if (idx === -1) return null;

  const now = new Date().toISOString();
  const current = store.leads[idx];
  const nextStage = patch.stage ?? current.stage;
  const nextFunnel = patch.funnel ?? current.funnel;

  let automacaoAtiva =
    patch.automacaoAtiva !== undefined
      ? patch.automacaoAtiva
      : current.automacaoAtiva;
  const respondeu =
    patch.respondeu !== undefined ? patch.respondeu : current.respondeu;

  const movedToClosedOrPaid =
    nextStage === "sinal_pago" || nextStage === "fechado";
  if (movedToClosedOrPaid || respondeu) {
    automacaoAtiva = false;
  }

  let postSaleChecklist =
    patch.postSaleChecklist ?? current.postSaleChecklist ?? [];
  const extraInteractions: LeadInteraction[] = [];

  if (
    nextStage === "fechado" &&
    current.stage !== "fechado" &&
    postSaleChecklist.length === 0
  ) {
    postSaleChecklist = buildPostSaleChecklist(nextFunnel, now);
    extraInteractions.push({
      id: generateId("int"),
      leadId,
      type: "pos_venda",
      title: "Checklist automático de Pós-Venda criado",
      description: `${postSaleChecklist.length} tarefas com prazos e alerta de recorrência adicionadas ao card.`,
      createdAt: now,
    });
  }

  const newInteraction: LeadInteraction | null = logInteraction
    ? {
        id: generateId("int"),
        leadId,
        type: logInteraction.type,
        title: logInteraction.title,
        description: logInteraction.description,
        createdAt: now,
      }
    : null;

  const updated: Lead = {
    ...current,
    ...patch,
    id: current.id,
    automacaoAtiva,
    respondeu,
    postSaleChecklist,
    updatedAt: now,
    ultimaInteracaoEm: touchLastInteraction
      ? patch.ultimaInteracaoEm ?? now
      : current.ultimaInteracaoEm,
    interactions: [
      ...extraInteractions,
      ...(newInteraction ? [newInteraction] : []),
      ...current.interactions,
    ],
  };

  if (isFirebaseConfigured()) {
    try {
      const db = getFirestoreDb();
      if (db) {
        await setDoc(
          doc(db, FIRESTORE_COLLECTIONS.leads, updated.id),
          stripUndefined(updated)
        );
        return updated;
      }
    } catch {
      // Fallback below
    }
  }

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!;
    const { error } = await supabase
      .from("leads")
      .update(toSupabaseLeadPayload(updated))
      .eq("id", leadId);
    if (!error) {
      const toInsert = [
        ...extraInteractions,
        ...(newInteraction ? [newInteraction] : []),
      ];
      if (toInsert.length > 0) {
        await supabase.from("lead_interactions").insert(
          toInsert.map((item) => ({
            id: item.id,
            lead_id: leadId,
            type: item.type,
            title: item.title,
            description: item.description,
            created_at: item.createdAt,
          }))
        );
      }
      return updated;
    }
  }

  store.leads[idx] = updated;
  await writeLocalStore(store);
  return updated;
}

export async function deleteLead(leadId: string): Promise<boolean> {
  if (isFirebaseConfigured()) {
    try {
      const db = getFirestoreDb();
      if (db) {
        await deleteDoc(doc(db, FIRESTORE_COLLECTIONS.leads, leadId));
        return true;
      }
    } catch {
      // Fallback below
    }
  }

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!;
    const { error } = await supabase.from("leads").delete().eq("id", leadId);
    if (!error) return true;
  }

  const store = await getStoreData();
  const before = store.leads.length;
  store.leads = store.leads.filter((l) => l.id !== leadId);
  if (store.leads.length === before) return false;
  await writeLocalStore(store);
  return true;
}

export async function trackProposalView(leadId: string): Promise<Lead | null> {
  const lead = await getLeadById(leadId);
  if (!lead) return null;

  const now = new Date().toISOString();
  const shouldMoveToOpen =
    lead.stage === "captado" || lead.stage === "contatado";
  const nextCount = (lead.visualizacoesProposta ?? 0) + 1;

  return updateLead(
    leadId,
    {
      visualizadaEm: lead.visualizadaEm ?? now,
      visualizacoesProposta: nextCount,
      stage: shouldMoveToOpen ? "proposta_aberta" : lead.stage,
    },
    {
      type: "proposta_vista",
      title: "Proposta web visualizada pelo cliente",
      description: shouldMoveToOpen
        ? `Abertura #${nextCount} registrada. Card movido automaticamente para Proposta Aberta.`
        : `Abertura #${nextCount} registrada na proposta exclusiva.`,
    },
    true
  );
}

export interface ProposalApprovalPayload {
  funnel?: FunnelId;
  packageName: string;
  addons: string[];
  totalValue: number;
  cnpj?: string;
  cpf?: string;
  razaoSocial: string;
  eventDate: string;
}

export async function approveProposal(
  leadId: string,
  payload: ProposalApprovalPayload
): Promise<Lead | null> {
  const lead = await getLeadById(leadId);
  if (!lead) return null;

  const now = new Date().toISOString();
  const nextStage =
    lead.stage === "sinal_pago" || lead.stage === "fechado"
      ? lead.stage
      : "follow_up";
  const nextFunnel = payload.funnel
    ? normalizeFunnelId(payload.funnel)
    : lead.funnel;

  const isPortrait = Boolean(payload.cpf) && !payload.cnpj;
  const slug = (lead.companyName || lead.id)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  const contractDocument: ContractDocumentRef = {
    type: isPortrait ? "retratos" : "corporativo",
    fileName: isPortrait
      ? `Termo-Uso-Imagem-Ultimo-Quadro-${slug}.pdf`
      : `Contrato-Ultimo-Quadro-${slug}.pdf`,
    generatedAt: now,
    url: `/api/proposals/${lead.id}/pdf`,
  };

  const addonsLabel =
    payload.addons.length > 0 ? ` + ${payload.addons.join(" + ")}` : "";

  const docSummary = isPortrait
    ? `CPF: ${payload.cpf || "Informado"}`
    : `CNPJ: ${payload.cnpj || "Informado"} (${payload.razaoSocial})`;

  return updateLead(
    leadId,
    {
      funnel: nextFunnel,
      cnpj: payload.cnpj || lead.cnpj,
      cpf: payload.cpf || lead.cpf,
      razaoSocial: payload.razaoSocial,
      eventDate: payload.eventDate,
      proposalPackage: payload.packageName,
      proposalAddons: payload.addons,
      estimatedValue: payload.totalValue,
      propostaAprovadaEm: now,
      automacaoAtiva: false,
      respondeu: true,
      contractDocument,
      stage: nextStage,
    },
    {
      type: "proposta_aprovada",
      title: "Proposta aprovada + Contrato PDF & Pix gerados",
      description: `Pacote ${payload.packageName}${addonsLabel} | Total R$ ${payload.totalValue.toLocaleString("pt-BR")} | Data: ${payload.eventDate} | ${docSummary}.`,
    },
    true
  );
}

export async function updateSettings(
  patch: Partial<StudioSettings>
): Promise<StudioSettings> {
  const store = await getStoreData();
  const now = new Date().toISOString();
  const updated: StudioSettings = {
    ...store.settings,
    ...patch,
    id: "default",
    updatedAt: now,
  };

  if (isFirebaseConfigured()) {
    try {
      const db = getFirestoreDb();
      if (db) {
        await setDoc(
          doc(db, FIRESTORE_COLLECTIONS.settings, "default"),
          stripUndefined(updated)
        );
        return updated;
      }
    } catch {
      // Fallback below
    }
  }

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!;
    const { error } = await supabase.from("studio_settings").upsert({
      id: "default",
      monthly_goal: updated.monthlyGoal,
      studio_name: updated.studioName,
      next_available_date: updated.nextAvailableDate,
      whatsapp_provider: updated.whatsappProvider,
      whatsapp_api_url: updated.whatsappApiUrl,
      whatsapp_api_key: updated.whatsappApiKey,
      whatsapp_instance: updated.whatsappInstance,
      admin_email: updated.adminEmail,
      pix_key: updated.pixKey,
      pix_recipient_name: updated.pixRecipientName,
      pix_city: updated.pixCity,
      updated_at: updated.updatedAt,
    });
    if (!error) return updated;
  }

  store.settings = updated;
  await writeLocalStore(store);
  return updated;
}

export async function createPartner(
  input: Omit<Partner, "id" | "createdAt">
): Promise<Partner> {
  const now = new Date().toISOString();
  const partner: Partner = {
    id: generateId("partner"),
    name: input.name.trim(),
    role: input.role,
    company: input.company.trim(),
    phone: input.phone.trim(),
    commissionRate: Number(input.commissionRate) || 15,
    createdAt: now,
  };

  if (isFirebaseConfigured()) {
    try {
      const db = getFirestoreDb();
      if (db) {
        await setDoc(
          doc(db, FIRESTORE_COLLECTIONS.partners, partner.id),
          stripUndefined(partner)
        );
        return partner;
      }
    } catch {
      // Fallback below
    }
  }

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!;
    const { error } = await supabase.from("partners").insert({
      id: partner.id,
      name: partner.name,
      role: partner.role,
      company: partner.company,
      phone: partner.phone,
      commission_rate: partner.commissionRate,
      created_at: partner.createdAt,
    });
    if (!error) return partner;
  }

  const store = await getStoreData();
  store.partners.push(partner);
  await writeLocalStore(store);
  return partner;
}

export async function upsertTemplate(
  input: Omit<ScriptTemplate, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
  }
): Promise<ScriptTemplate> {
  const store = await getStoreData();
  const now = new Date().toISOString();
  const existing = input.id
    ? store.templates.find((t) => t.id === input.id)
    : undefined;

  const template: ScriptTemplate = {
    id: existing?.id ?? generateId("tpl"),
    name: input.name.trim(),
    funnel: input.funnel,
    channel: input.channel,
    subject: input.subject.trim(),
    body: input.body.trim(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  if (isFirebaseConfigured()) {
    try {
      const db = getFirestoreDb();
      if (db) {
        await setDoc(
          doc(db, FIRESTORE_COLLECTIONS.templates, template.id),
          stripUndefined(template)
        );
        return template;
      }
    } catch {
      // Fallback below
    }
  }

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!;
    const { error } = await supabase.from("script_templates").upsert({
      id: template.id,
      name: template.name,
      funnel: template.funnel,
      channel: template.channel,
      subject: template.subject,
      body: template.body,
      created_at: template.createdAt,
      updated_at: template.updatedAt,
    });
    if (!error) return template;
  }

  if (existing) {
    store.templates = store.templates.map((t) =>
      t.id === template.id ? template : t
    );
  } else {
    store.templates.push(template);
  }
  await writeLocalStore(store);
  return template;
}

export async function deleteTemplate(templateId: string): Promise<boolean> {
  if (isFirebaseConfigured()) {
    try {
      const db = getFirestoreDb();
      if (db) {
        await deleteDoc(doc(db, FIRESTORE_COLLECTIONS.templates, templateId));
        return true;
      }
    } catch {
      // Fallback below
    }
  }

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!;
    const { error } = await supabase
      .from("script_templates")
      .delete()
      .eq("id", templateId);
    if (!error) return true;
  }

  const store = await getStoreData();
  const before = store.templates.length;
  store.templates = store.templates.filter((t) => t.id !== templateId);
  if (store.templates.length === before) return false;
  await writeLocalStore(store);
  return true;
}

export async function resetDemoData(): Promise<CrmStoreData> {
  const seeded = createInitialSeedData();

  if (isFirebaseConfigured()) {
    try {
      const db = getFirestoreDb();
      if (db) {
        const batch = writeBatch(db);
        batch.set(
          doc(db, FIRESTORE_COLLECTIONS.settings, "default"),
          stripUndefined(seeded.settings)
        );
        for (const p of seeded.partners) {
          batch.set(
            doc(db, FIRESTORE_COLLECTIONS.partners, p.id),
            stripUndefined(p)
          );
        }
        for (const l of seeded.leads) {
          batch.set(
            doc(db, FIRESTORE_COLLECTIONS.leads, l.id),
            stripUndefined(l)
          );
        }
        for (const t of seeded.templates) {
          batch.set(
            doc(db, FIRESTORE_COLLECTIONS.templates, t.id),
            stripUndefined(t)
          );
        }
        await batch.commit();
        return seeded;
      }
    } catch {
      // Fallback to local
    }
  }

  await writeLocalStore(seeded);
  return seeded;
}

export async function updatePartner(
  partnerId: string,
  patch: Partial<Omit<Partner, "id" | "createdAt">>
): Promise<Partner | null> {
  const store = await getStoreData();
  const idx = store.partners.findIndex((p) => p.id === partnerId);
  if (idx === -1) return null;

  const updated: Partner = {
    ...store.partners[idx],
    ...patch,
    id: partnerId,
    commissionRate:
      patch.commissionRate !== undefined
        ? Number(patch.commissionRate) || 15
        : store.partners[idx].commissionRate,
  };

  if (isFirebaseConfigured()) {
    try {
      const db = getFirestoreDb();
      if (db) {
        await setDoc(
          doc(db, FIRESTORE_COLLECTIONS.partners, partnerId),
          stripUndefined(updated)
        );
        return updated;
      }
    } catch {
      // Fall through to local store
    }
  }

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!;
    const { error } = await supabase
      .from("partners")
      .update({
        name: updated.name,
        role: updated.role,
        company: updated.company,
        phone: updated.phone,
        commission_rate: updated.commissionRate,
      })
      .eq("id", partnerId);
    if (!error) return updated;
  }

  store.partners[idx] = updated;
  await writeLocalStore(store);
  return updated;
}

export async function deletePartner(partnerId: string): Promise<boolean> {
  if (isFirebaseConfigured()) {
    try {
      const db = getFirestoreDb();
      if (db) {
        await deleteDoc(doc(db, FIRESTORE_COLLECTIONS.partners, partnerId));
        return true;
      }
    } catch {
      // Fall through to local store
    }
  }

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!;
    const { error } = await supabase
      .from("partners")
      .delete()
      .eq("id", partnerId);
    if (!error) return true;
  }

  const store = await getStoreData();
  const before = store.partners.length;
  store.partners = store.partners.filter((p) => p.id !== partnerId);
  if (store.partners.length === before) return false;
  await writeLocalStore(store);
  return true;
}

const QUEUE_FILE = path.join(DATA_DIR, "whatsapp-queue.json");
const CRON_LOGS_FILE = path.join(DATA_DIR, "cron-logs.json");
let memoryQueueFallback: WhatsappQueueJob[] = [];
let memoryCronFallback: CronExecutionLog[] = [];

export async function getPersistedWhatsappQueue(): Promise<WhatsappQueueJob[]> {
  if (isFirebaseConfigured()) {
    try {
      const db = getFirestoreDb();
      if (db) {
        const snap = await getDocs(
          collection(db, FIRESTORE_COLLECTIONS.whatsappQueue)
        );
        return snap.docs
          .map((d) => d.data() as WhatsappQueueJob)
          .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
          .slice(0, 50);
      }
    } catch {
      // Fall through to local queue
    }
  }

  try {
    const raw = await fs.readFile(QUEUE_FILE, "utf-8");
    memoryQueueFallback = JSON.parse(raw) as WhatsappQueueJob[];
    return memoryQueueFallback;
  } catch {
    return memoryQueueFallback;
  }
}

export async function saveWhatsappQueueJob(
  job: WhatsappQueueJob
): Promise<void> {
  if (isFirebaseConfigured()) {
    try {
      const db = getFirestoreDb();
      if (db) {
        await setDoc(
          doc(db, FIRESTORE_COLLECTIONS.whatsappQueue, job.id),
          stripUndefined(job)
        );
        return;
      }
    } catch {
      // Fall through to local file
    }
  }

  const existing = await getPersistedWhatsappQueue();
  const idx = existing.findIndex((item) => item.id === job.id);
  const next =
    idx >= 0
      ? existing.map((item) => (item.id === job.id ? job : item))
      : [job, ...existing].slice(0, 50);

  memoryQueueFallback = next;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(QUEUE_FILE, JSON.stringify(next, null, 2), "utf-8");
  } catch {
    // Ignore read-only filesystem
  }
}

export async function getCronLogs(
  limitCount: number = 10
): Promise<CronExecutionLog[]> {
  if (isFirebaseConfigured()) {
    try {
      const db = getFirestoreDb();
      if (db) {
        const snap = await getDocs(
          collection(db, FIRESTORE_COLLECTIONS.cronLogs)
        );
        return snap.docs
          .map((d) => d.data() as CronExecutionLog)
          .sort((a, b) => (b.executedAt || "").localeCompare(a.executedAt || ""))
          .slice(0, limitCount);
      }
    } catch {
      // Fall through to local logs
    }
  }

  try {
    const raw = await fs.readFile(CRON_LOGS_FILE, "utf-8");
    memoryCronFallback = JSON.parse(raw) as CronExecutionLog[];
    return memoryCronFallback.slice(0, limitCount);
  } catch {
    return memoryCronFallback.slice(0, limitCount);
  }
}

export async function saveCronLog(log: CronExecutionLog): Promise<void> {
  if (isFirebaseConfigured()) {
    try {
      const db = getFirestoreDb();
      if (db) {
        await setDoc(
          doc(db, FIRESTORE_COLLECTIONS.cronLogs, log.id),
          stripUndefined(log)
        );
        return;
      }
    } catch {
      // Fall through to local file
    }
  }

  const existing = await getCronLogs(20);
  const next = [log, ...existing].slice(0, 20);
  memoryCronFallback = next;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(CRON_LOGS_FILE, JSON.stringify(next, null, 2), "utf-8");
  } catch {
    // Ignore read-only filesystem
  }
}
