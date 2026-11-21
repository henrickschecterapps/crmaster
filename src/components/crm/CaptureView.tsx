"use client";

import React, { useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Globe,
  Instagram,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Sparkles,
  Star,
  Upload,
  UserPlus,
} from "lucide-react";
import {
  FUNNELS,
  FunnelId,
  IntegrationStatus,
  Lead,
  Partner,
  PlaceCandidate,
} from "@/types/crm";
import { cn, normalizeName, normalizePhone } from "@/lib/utils";
import type { CreateLeadInput } from "@/lib/repository";

interface CaptureViewProps {
  leads: Lead[];
  partners: Partner[];
  integrationStatus: IntegrationStatus;
  initialSubTab?: "places" | "manual" | "csv";
  defaultFunnel?: FunnelId;
  onCreateLead: (
    input: CreateLeadInput
  ) => Promise<{ lead: Lead; duplicate: boolean }>;
  onCreateLeadsBulk: (
    inputs: CreateLeadInput[]
  ) => Promise<{ imported: Lead[]; skippedDuplicates: number }>;
  onNotify: (message: string, tone?: "success" | "info" | "error") => void;
}

const BH_PRESET_QUERIES = [
  "restaurante gastronomia Lourdes",
  "confecção moda Barro Preto",
  "clínica estética Savassi",
  "bar nightlife Savassi",
  "espaço eventos Pampulha",
  "hotel corporativo Vila da Serra",
];

interface ParsedCsvRow {
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  funnel: FunnelId;
  estimatedValue: number;
  origin: string;
  isDuplicate: boolean;
}

export function CaptureView({
  leads,
  partners,
  integrationStatus,
  initialSubTab = "places",
  defaultFunnel = "corporativo",
  onCreateLead,
  onCreateLeadsBulk,
  onNotify,
}: CaptureViewProps) {
  const [subTab, setSubTab] = useState<"places" | "manual" | "csv">(
    initialSubTab
  );

  React.useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  React.useEffect(() => {
    setMFunnel(defaultFunnel);
  }, [defaultFunnel]);

  // Google Places BH state
  const [placesQuery, setPlacesQuery] = useState("confecção Barro Preto");
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesMode, setPlacesMode] = useState<
    "google_live" | "osm_free" | "demo"
  >(integrationStatus.googlePlacesLive ? "google_live" : "osm_free");
  const [placeResults, setPlaceResults] = useState<PlaceCandidate[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [placeFunnels, setPlaceFunnels] = useState<Record<string, FunnelId>>(
    {}
  );
  const [sendingPlaceId, setSendingPlaceId] = useState<string | null>(null);
  const [enrichingPlaceId, setEnrichingPlaceId] = useState<string | null>(null);

  // Manual form state
  const [mCompany, setMCompany] = useState("");
  const [mContact, setMContact] = useState("");
  const [mRole, setMRole] = useState("");
  const [mPhone, setMPhone] = useState("");
  const [mEmail, setMEmail] = useState("");
  const [mNeighborhood, setMNeighborhood] = useState("");
  const [mFunnel, setMFunnel] = useState<FunnelId>(defaultFunnel);
  const [mValue, setMValue] = useState("1950");
  const [mOrigin, setMOrigin] = useState("Prospecção Direta");
  const [mPartnerId, setMPartnerId] = useState("");
  const [mNotes, setMNotes] = useState("");
  const [submittingManual, setSubmittingManual] = useState(false);

  // CSV importer state
  const [csvRows, setCsvRows] = useState<ParsedCsvRow[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvTargetFunnel, setCsvTargetFunnel] =
    useState<FunnelId>("corporativo");
  const [importingCsv, setImportingCsv] = useState(false);

  // Anti-duplicity lookup sets
  const existingSignatures = useMemo(() => {
    const phones = new Set<string>();
    const names = new Set<string>();
    for (const l of leads) {
      const p = normalizePhone(l.phone);
      const n = normalizeName(l.companyName);
      if (p) phones.add(p);
      if (n) names.add(n);
    }
    return { phones, names };
  }, [leads]);

  const isLeadDuplicate = (companyName: string, phone: string): boolean => {
    const p = normalizePhone(phone);
    const n = normalizeName(companyName);
    return (
      (Boolean(p) && existingSignatures.phones.has(p)) ||
      (Boolean(n) && existingSignatures.names.has(n))
    );
  };

  const handlePlacesSearch = async (queryOverride?: string) => {
    const q = (queryOverride ?? placesQuery).trim();
    if (!q) return;
    if (queryOverride) setPlacesQuery(queryOverride);

    setPlacesLoading(true);
    setHasSearched(true);
    try {
      const res = await fetch("/api/places/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const json = await res.json();
      if (!res.ok) {
        onNotify(json.error || "Erro ao consultar Places API", "error");
        return;
      }
      setPlacesMode(json.mode);
      setPlaceResults(json.results || []);
      const funnelDefaults: Record<string, FunnelId> = {};
      for (const item of (json.results || []) as PlaceCandidate[]) {
        funnelDefaults[item.placeId] = item.suggestedFunnel;
      }
      setPlaceFunnels(funnelDefaults);
    } catch {
      onNotify("Falha de rede ao consultar Google Places BH.", "error");
    } finally {
      setPlacesLoading(false);
    }
  };

  const handleEnrichPlace = async (candidate: PlaceCandidate) => {
    if (!candidate.website) {
      onNotify("Esta empresa não possui site listado para enriquecimento.", "info");
      return;
    }
    setEnrichingPlaceId(candidate.placeId);
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website: candidate.website,
          companyName: candidate.name,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        onNotify(json.error || "Não foi possível enriquecer o site.", "error");
        return;
      }

      setPlaceResults((prev) =>
        prev.map((p) =>
          p.placeId === candidate.placeId
            ? {
                ...p,
                enrichedEmail: json.bestEmail || p.enrichedEmail,
                enrichedInstagram: json.bestInstagram || p.enrichedInstagram,
              }
            : p
        )
      );

      onNotify(
        json.bestEmail || json.bestInstagram
          ? `Contatos encontrados para ${candidate.name}: ${
              json.bestEmail || "sem e-mail"
            } ${json.bestInstagram ? `· ${json.bestInstagram}` : ""}`
          : "Nenhum contato público encontrado na página inicial ou /contato.",
        "success"
      );
    } catch {
      onNotify("Erro de rede ao enriquecer site.", "error");
    } finally {
      setEnrichingPlaceId(null);
    }
  };

  const handleSendPlaceToCrm = async (candidate: PlaceCandidate) => {
    if (isLeadDuplicate(candidate.name, candidate.phone)) {
      onNotify("Este lead já está cadastrado no CRM.", "info");
      return;
    }

    const chosenFunnel =
      placeFunnels[candidate.placeId] || candidate.suggestedFunnel;
    const defaultVal =
      FUNNELS.find((f) => f.id === chosenFunnel)?.defaultValue ?? 1950;

    setSendingPlaceId(candidate.placeId);
    try {
      const res = await onCreateLead({
        companyName: candidate.name,
        contactName: "Responsável Comercial",
        phone: candidate.phone || "(31) 99000-0000",
        email: candidate.enrichedEmail || "",
        instagram: candidate.enrichedInstagram || undefined,
        neighborhood: candidate.neighborhood,
        address: candidate.address,
        website: candidate.website,
        funnel: chosenFunnel,
        estimatedValue: defaultVal,
        origin: "Google Places BH",
        notes: `Captado via Google Places BH (${candidate.category}). Endereço: ${candidate.address}.`,
      });
      if (res.duplicate) {
        onNotify("Duplicidade detectada — empresa já existe no CRM.", "info");
      } else {
        onNotify(`"${candidate.name}" enviado para o CRM (Captado).`, "success");
      }
    } finally {
      setSendingPlaceId(null);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mCompany.trim() || !mPhone.trim()) {
      onNotify("Preencha nome da empresa e WhatsApp/telefone.", "error");
      return;
    }

    setSubmittingManual(true);
    try {
      const res = await onCreateLead({
        companyName: mCompany.trim(),
        contactName: mContact.trim() || "Decisor Comercial",
        contactRole: mRole.trim() || undefined,
        phone: mPhone.trim(),
        email: mEmail.trim(),
        neighborhood: mNeighborhood.trim() || "Belo Horizonte",
        funnel: mFunnel,
        estimatedValue: Number(mValue) || 1950,
        origin: mOrigin.trim() || "Cadastro Manual",
        partnerId: mPartnerId || null,
        notes: mNotes.trim(),
      });
      if (res.duplicate) {
        onNotify(
          "Já existe um lead com este telefone ou nome de empresa no CRM.",
          "error"
        );
        return;
      }
      onNotify(`Lead "${res.lead.companyName}" cadastrado com sucesso!`, "success");
      setMCompany("");
      setMContact("");
      setMRole("");
      setMPhone("");
      setMEmail("");
      setMNeighborhood("");
      setMNotes("");
    } finally {
      setSubmittingManual(false);
    }
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "").replace(/^\uFEFF/, "");
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length < 2) {
        onNotify("O CSV precisa ter cabeçalho e ao menos 1 linha de lead.", "error");
        return;
      }

      const delimiter = lines[0].includes(";") ? ";" : ",";
      const headers = lines[0]
        .split(delimiter)
        .map((h) => normalizeName(h.replace(/^"|"$/g, "")));

      const findIdx = (candidates: string[]) =>
        headers.findIndex((h) => candidates.some((c) => h.includes(c)));

      const idxCompany = findIdx(["empresa", "company", "cliente", "loja", "nome"]);
      const idxContact = findIdx(["contato", "decisor", "responsavel", "contact"]);
      const idxPhone = findIdx(["telefone", "whatsapp", "celular", "phone", "fone"]);
      const idxEmail = findIdx(["email", "mail"]);
      const idxValue = findIdx(["valor", "ticket", "value", "estimado"]);
      const idxOrigin = findIdx(["origem", "origin", "canal"]);

      const parsed: ParsedCsvRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i]
          .split(delimiter)
          .map((c) => c.trim().replace(/^"|"$/g, ""));

        const companyName = cols[idxCompany >= 0 ? idxCompany : 0] || "";
        const contactName =
          cols[idxContact >= 0 ? idxContact : 1] || "Decisor Comercial";
        const phone = cols[idxPhone >= 0 ? idxPhone : 2] || "";
        const email = idxEmail >= 0 ? cols[idxEmail] || "" : "";
        const rawVal = idxValue >= 0 ? cols[idxValue] || "" : "";
        const estimatedValue =
          Number(rawVal.replace(/[^\d.,]/g, "").replace(",", ".")) ||
          (FUNNELS.find((f) => f.id === csvTargetFunnel)?.defaultValue ?? 1950);
        const origin =
          idxOrigin >= 0 && cols[idxOrigin] ? cols[idxOrigin] : "Importação CSV";

        if (!companyName) continue;

        parsed.push({
          companyName,
          contactName,
          phone,
          email,
          funnel: csvTargetFunnel,
          estimatedValue,
          origin,
          isDuplicate: isLeadDuplicate(companyName, phone),
        });
      }

      setCsvRows(parsed);
      onNotify(`${parsed.length} linhas lidas do arquivo CSV.`, "info");
    };
    reader.readAsText(file, "utf-8");
  };

  const handleDownloadSampleCsv = () => {
    const csvContent = [
      "empresa;contato;telefone;email;valor;origem",
      "Horizonte Tech Sistemas;Lucas Amaral;(31) 99102-3344;lucas@horizontetech.com.br;1950;Lista RH BH",
      "Espaço Serra Eventos;Patrícia Lemos;(31) 98821-9040;patricia@espacoserra.com.br;2500;Indicação Evento",
      "Atelier Linho & Corte;Renata Duarte;(31) 99450-1822;renata@linhoecorte.com.br;2400;Barro Preto Lista",
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-leads-crmaster-bh.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCsv = async () => {
    const validRows = csvRows.filter((r) => !r.isDuplicate);
    if (validRows.length === 0) {
      onNotify("Nenhum lead inédito para importar.", "info");
      return;
    }

    setImportingCsv(true);
    try {
      const res = await onCreateLeadsBulk(
        validRows.map((r) => ({
          companyName: r.companyName,
          contactName: r.contactName,
          phone: r.phone || "(31) 99000-0000",
          email: r.email,
          funnel: csvTargetFunnel,
          estimatedValue: r.estimatedValue,
          origin: r.origin,
        }))
      );
      onNotify(
        `${res.imported.length} leads importados! (${res.skippedDuplicates} duplicados ignorados)`,
        "success"
      );
      setCsvRows([]);
      setCsvFileName("");
    } finally {
      setImportingCsv(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header + Sub-tabs */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
            Máquina de Prospecção · Belo Horizonte
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            Captação de Leads
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl p-1.5 glass-panel">
          <button
            type="button"
            onClick={() => setSubTab("places")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer",
              subTab === "places"
                ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            <MapPin className="h-3.5 w-3.5" />
            Captar Leads (BH)
          </button>
          <button
            type="button"
            onClick={() => setSubTab("manual")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer",
              subTab === "manual"
                ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Cadastro Manual
          </button>
          <button
            type="button"
            onClick={() => setSubTab("csv")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer",
              subTab === "csv"
                ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Importar CSV
          </button>
        </div>
      </div>

      {/* TAB 1: GOOGLE PLACES BH */}
      {subTab === "places" && (
        <div className="space-y-5">
          <div className="glass-panel rounded-3xl p-6 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-[var(--text-primary)]">
                  Busca Inteligente por Nicho + Bairro (Google Places BH)
                </h2>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  Extrai nome, telefone, endereço e site com filtro automático
                  anti-duplicidade.
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1 text-[11px] font-semibold",
                  placesMode === "google_live" || placesMode === "osm_free"
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-[var(--accent-soft)] text-[var(--accent)]"
                )}
              >
                <Sparkles className="h-3 w-3" />
                {placesMode === "google_live"
                  ? "Google Places API Ativa"
                  : placesMode === "osm_free"
                  ? "OpenStreetMap BH Ativo (100% Gratuito)"
                  : "Modo Demonstração Offline"}
              </span>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handlePlacesSearch();
              }}
              className="flex flex-col gap-2.5 sm:flex-row"
            >
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={placesQuery}
                  onChange={(e) => setPlacesQuery(e.target.value)}
                  placeholder='Ex: "restaurante eventos Lourdes" ou "confecção Barro Preto"'
                  className="input-field w-full rounded-2xl py-3 pl-10 pr-4 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={placesLoading}
                className="btn-accent inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold disabled:opacity-60 cursor-pointer"
              >
                <Search className="h-4 w-4" />
                {placesLoading ? "Buscando em BH..." : "Buscar Leads BH"}
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium text-[var(--text-muted)]">
                Sugestões rápidas:
              </span>
              {BH_PRESET_QUERIES.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePlacesSearch(preset)}
                  className="rounded-full border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/70 px-3 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:border-[var(--accent-border)] hover:text-[var(--accent)] transition-colors cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Results Grid */}
          {!hasSearched ? (
            <div className="glass-panel rounded-3xl p-10 text-center">
              <MapPin className="mx-auto h-8 w-8 text-[var(--accent)]" />
              <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">
                Pronto para prospectar empresas em Belo Horizonte
              </p>
              <p className="mt-1 text-xs text-[var(--text-secondary)] max-w-md mx-auto">
                Digite um nicho e bairro acima ou clique em uma das sugestões
                rápidas para testar a extração com filtro anti-duplicidade.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {placeResults.map((place) => {
                const duplicate = isLeadDuplicate(place.name, place.phone);
                const selectedFunnel =
                  placeFunnels[place.placeId] || place.suggestedFunnel;

                return (
                  <div
                    key={place.placeId}
                    className={cn(
                      "glass-panel rounded-3xl p-5 flex flex-col justify-between gap-4",
                      duplicate && "opacity-75"
                    )}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="text-[11px] font-semibold text-[var(--accent)]">
                            {place.category}
                          </span>
                          <h3 className="mt-0.5 text-base font-bold text-[var(--text-primary)]">
                            {place.name}
                          </h3>
                        </div>

                        {place.rating && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 font-mono-num text-xs font-semibold text-[var(--text-primary)] shrink-0">
                            <Star className="h-3 w-3 fill-[var(--accent)] text-[var(--accent)]" />
                            {place.rating.toFixed(1)}
                          </span>
                        )}
                      </div>

                      <div className="mt-3 space-y-1.5 text-xs text-[var(--text-secondary)]">
                        <p className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
                          <span className="font-mono-num">
                            {place.phone || "Telefone não informado"}
                          </span>
                        </p>
                        <p className="flex items-start gap-2">
                          <MapPin className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0 mt-0.5" />
                          <span>{place.address}</span>
                        </p>
                        {place.website && (
                          <p className="flex items-center gap-2">
                            <Globe className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
                            <a
                              href={place.website}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate text-[var(--accent)] hover:underline"
                            >
                              {place.website.replace(/^https?:\/\//, "")}
                            </a>
                          </p>
                        )}
                        {(place.enrichedEmail || place.enrichedInstagram) && (
                          <div className="mt-2 flex flex-wrap gap-1.5 pt-1">
                            {place.enrichedEmail && (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-sky-500/12 px-2 py-1 text-[11px] font-medium text-sky-400">
                                <Mail className="h-3 w-3" />
                                {place.enrichedEmail}
                              </span>
                            )}
                            {place.enrichedInstagram && (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-soft)] px-2 py-1 text-[11px] font-medium text-[var(--accent)]">
                                <Instagram className="h-3 w-3" />
                                {place.enrichedInstagram}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2.5 border-t border-[var(--border-hairline)] pt-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <select
                          value={selectedFunnel}
                          disabled={duplicate}
                          onChange={(e) =>
                            setPlaceFunnels((prev) => ({
                              ...prev,
                              [place.placeId]: e.target.value as FunnelId,
                            }))
                          }
                          className="input-field rounded-xl px-2.5 py-2 text-xs disabled:opacity-50"
                        >
                          {FUNNELS.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.label}
                            </option>
                          ))}
                        </select>

                        {place.website && (
                          <button
                            type="button"
                            onClick={() => handleEnrichPlace(place)}
                            disabled={enrichingPlaceId === place.placeId}
                            className="btn-ghost inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                          >
                            <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
                            {enrichingPlaceId === place.placeId
                              ? "Buscando..."
                              : "Buscar E-mail/Instagram"}
                          </button>
                        )}
                      </div>

                      {duplicate ? (
                        <span className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/12 px-3.5 py-2 text-xs font-semibold text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Já no CRM
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSendPlaceToCrm(place)}
                          disabled={sendingPlaceId === place.placeId}
                          className="btn-accent inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-50 cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          {sendingPlaceId === place.placeId
                            ? "Enviando..."
                            : "Enviar para o CRM"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MANUAL FORM */}
      {subTab === "manual" && (
        <form
          onSubmit={handleManualSubmit}
          className="glass-panel rounded-3xl p-6 sm:p-8 max-w-4xl space-y-5"
        >
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              Cadastro Rápido de Lead
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              O lead entra automaticamente na coluna Captado com proteção contra
              duplicidade por telefone ou nome.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                Empresa / Cliente *
              </label>
              <input
                type="text"
                required
                value={mCompany}
                onChange={(e) => setMCompany(e.target.value)}
                placeholder="Ex: Construtora Minas Horizonte"
                className="input-field w-full rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                Nome do Decisor *
              </label>
              <input
                type="text"
                required
                value={mContact}
                onChange={(e) => setMContact(e.target.value)}
                placeholder="Ex: Juliana Mendes"
                className="input-field w-full rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                WhatsApp / Telefone *
              </label>
              <input
                type="text"
                required
                value={mPhone}
                onChange={(e) => setMPhone(e.target.value)}
                placeholder="(31) 99999-9999"
                className="input-field w-full rounded-xl px-3.5 py-2.5 font-mono-num text-sm"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                E-mail Comercial
              </label>
              <input
                type="email"
                value={mEmail}
                onChange={(e) => setMEmail(e.target.value)}
                placeholder="juliana@empresa.com.br"
                className="input-field w-full rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                Funil de Destino
              </label>
              <select
                value={mFunnel}
                onChange={(e) => {
                  const next = e.target.value as FunnelId;
                  setMFunnel(next);
                  const found = FUNNELS.find((f) => f.id === next);
                  if (found) setMValue(String(found.defaultValue));
                }}
                className="input-field w-full rounded-xl px-3.5 py-2.5 text-sm"
              >
                {FUNNELS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label} ({f.subtitle})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                Valor Estimado (R$)
              </label>
              <input
                type="number"
                min={0}
                value={mValue}
                onChange={(e) => setMValue(e.target.value)}
                className="input-field w-full rounded-xl px-3.5 py-2.5 font-mono-num text-sm font-semibold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                Cargo / Função
              </label>
              <input
                type="text"
                value={mRole}
                onChange={(e) => setMRole(e.target.value)}
                placeholder="Ex: Gerente de RH"
                className="input-field w-full rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                Bairro (BH)
              </label>
              <input
                type="text"
                value={mNeighborhood}
                onChange={(e) => setMNeighborhood(e.target.value)}
                placeholder="Ex: Lourdes, Savassi, Barro Preto..."
                className="input-field w-full rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                Origem
              </label>
              <input
                type="text"
                value={mOrigin}
                onChange={(e) => setMOrigin(e.target.value)}
                placeholder="Instagram, Indicação, LinkedIn..."
                className="input-field w-full rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                Parceiro Indicador (15% Comissão)
              </label>
              <select
                value={mPartnerId}
                onChange={(e) => setMPartnerId(e.target.value)}
                className="input-field w-full rounded-xl px-3.5 py-2.5 text-sm"
              >
                <option value="">Venda direta (sem parceiro)</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.company} ({p.commissionRate}%)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
              Observações Iniciais
            </label>
            <textarea
              rows={3}
              value={mNotes}
              onChange={(e) => setMNotes(e.target.value)}
              placeholder="Contexto da abordagem, data desejada, tipo de evento ou coleção..."
              className="input-field w-full rounded-xl px-3.5 py-2.5 text-sm"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submittingManual}
              className="btn-accent inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold disabled:opacity-60 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              {submittingManual ? "Salvando..." : "Cadastrar Lead no CRM"}
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: CSV BULK IMPORTER */}
      {subTab === "csv" && (
        <div className="glass-panel rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                Importador de Leads em Massa (.csv)
              </h2>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Suporta separador vírgula ou ponto-e-vírgula (Excel BR) com
                detecção automática de duplicados.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadSampleCsv}
              className="btn-ghost inline-flex items-center gap-1.5 self-start rounded-xl px-3.5 py-2 text-xs font-semibold cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              Baixar CSV Modelo
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-12 sm:items-center">
            <div className="sm:col-span-4">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                Funil de Destino da Importação
              </label>
              <select
                value={csvTargetFunnel}
                onChange={(e) =>
                  setCsvTargetFunnel(e.target.value as FunnelId)
                }
                className="input-field w-full rounded-xl px-3.5 py-2.5 text-sm"
              >
                {FUNNELS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-8">
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)]/50 px-6 py-6 text-center hover:border-[var(--accent-border)] transition-colors">
                <Upload className="h-6 w-6 text-[var(--accent)]" />
                <span className="mt-2 text-xs font-semibold text-[var(--text-primary)]">
                  {csvFileName
                    ? `Arquivo carregado: ${csvFileName}`
                    : "Clique para selecionar um arquivo .csv"}
                </span>
                <span className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                  Colunas esperadas: empresa, contato, telefone, email, valor,
                  origem
                </span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {csvRows.length > 0 && (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-2xl border border-[var(--border-hairline)]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--bg-subtle)] text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                    <tr>
                      <th className="px-4 py-3">Empresa</th>
                      <th className="px-4 py-3">Contato</th>
                      <th className="px-4 py-3">Telefone</th>
                      <th className="px-4 py-3">Valor</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-hairline)]">
                    {csvRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-[var(--bg-subtle)]/40">
                        <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">
                          {row.companyName}
                        </td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">
                          {row.contactName}
                        </td>
                        <td className="px-4 py-3 font-mono-num text-[var(--text-secondary)]">
                          {row.phone}
                        </td>
                        <td className="px-4 py-3 font-mono-num text-[var(--text-primary)]">
                          R$ {row.estimatedValue.toLocaleString("pt-BR")}
                        </td>
                        <td className="px-4 py-3">
                          {row.isDuplicate ? (
                            <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-amber-400">
                              Duplicado (ignorado)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                              <Check className="h-3 w-3" />
                              Pronto
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-[var(--text-secondary)]">
                  {csvRows.filter((r) => !r.isDuplicate).length} leads prontos
                  para importação
                </p>
                <button
                  type="button"
                  onClick={handleImportCsv}
                  disabled={importingCsv}
                  className="btn-accent inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  {importingCsv ? "Importando..." : "Confirmar Importação"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
