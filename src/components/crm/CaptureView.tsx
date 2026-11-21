"use client";

import React, { useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  CheckSquare,
  Download,
  FileSpreadsheet,
  Filter,
  Globe,
  Instagram,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
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
import {
  cn,
  formatPhoneBr,
  normalizeName,
  normalizePhone,
} from "@/lib/utils";
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

type ResultFilter = "all" | "phone" | "instagram" | "email" | "hide_existing";

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

  const [placesQuery, setPlacesQuery] = useState("confecção moda Barro Preto");
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesMode, setPlacesMode] = useState<
    "overture_bh" | "google_live" | "osm_free" | "demo"
  >("overture_bh");
  const [overtureMeta, setOvertureMeta] = useState<{
    release?: string;
    total?: number;
  }>({});
  const [placeResults, setPlaceResults] = useState<PlaceCandidate[]>([]);
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<string[]>([]);
  const [importingSelectedPlaces, setImportingSelectedPlaces] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [placeFunnels, setPlaceFunnels] = useState<Record<string, FunnelId>>(
    {}
  );
  const [sendingPlaceId, setSendingPlaceId] = useState<string | null>(null);
  const [enrichingPlaceId, setEnrichingPlaceId] = useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/places/search", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.available) {
          setOvertureMeta({ release: json.release, total: json.total });
          setPlacesMode("overture_bh");
        } else {
          setPlacesMode(
            integrationStatus.googlePlacesLive ? "google_live" : "osm_free"
          );
        }
      })
      .catch(() => {
        // Ignore silent metadata fetch error
      });
  }, [integrationStatus.googlePlacesLive]);

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
  const [manualError, setManualError] = useState("");
  const [submittingManual, setSubmittingManual] = useState(false);

  const [csvRows, setCsvRows] = useState<ParsedCsvRow[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvTargetFunnel, setCsvTargetFunnel] =
    useState<FunnelId>("corporativo");
  const [importingCsv, setImportingCsv] = useState(false);

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

  const isLeadDuplicate = React.useCallback(
    (companyName: string, phone: string): boolean => {
      const p = normalizePhone(phone);
      const n = normalizeName(companyName);
      return (
        (Boolean(p) && existingSignatures.phones.has(p)) ||
        (Boolean(n) && existingSignatures.names.has(n))
      );
    },
    [existingSignatures]
  );

  const filteredPlaceResults = useMemo(() => {
    return placeResults.filter((p) => {
      if (resultFilter === "phone") return Boolean(p.phone);
      if (resultFilter === "instagram") return Boolean(p.enrichedInstagram);
      if (resultFilter === "email") return Boolean(p.enrichedEmail);
      if (resultFilter === "hide_existing")
        return !isLeadDuplicate(p.name, p.phone);
      return true;
    });
  }, [placeResults, resultFilter, isLeadDuplicate]);

  const handlePlacesSearch = async (queryOverride?: string) => {
    const q = (queryOverride ?? placesQuery).trim();
    if (!q) return;
    if (queryOverride) setPlacesQuery(queryOverride);

    setPlacesLoading(true);
    setHasSearched(true);
    setSelectedPlaceIds([]);
    try {
      const res = await fetch("/api/places/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const json = await res.json();
      if (!res.ok) {
        onNotify(json.error || "Erro ao consultar estabelecimentos", "error");
        return;
      }
      setPlacesMode(json.mode);
      if (json.release || json.totalIndexed) {
        setOvertureMeta({
          release: json.release,
          total: json.totalIndexed,
        });
      }
      setPlaceResults(json.results || []);
      const funnelDefaults: Record<string, FunnelId> = {};
      for (const item of (json.results || []) as PlaceCandidate[]) {
        funnelDefaults[item.placeId] = item.suggestedFunnel;
      }
      setPlaceFunnels(funnelDefaults);
    } catch {
      onNotify("Falha de rede ao consultar empresas em BH.", "error");
    } finally {
      setPlacesLoading(false);
    }
  };

  const toggleSelectPlace = (placeId: string) => {
    setSelectedPlaceIds((prev) =>
      prev.includes(placeId)
        ? prev.filter((id) => id !== placeId)
        : [...prev, placeId]
    );
  };

  const handleSelectAllFiltered = () => {
    const selectable = filteredPlaceResults
      .filter((p) => !isLeadDuplicate(p.name, p.phone))
      .map((p) => p.placeId);

    const allAlreadySelected =
      selectable.length > 0 &&
      selectable.every((id) => selectedPlaceIds.includes(id));

    if (allAlreadySelected) {
      setSelectedPlaceIds([]);
    } else {
      setSelectedPlaceIds(selectable);
    }
  };

  const handleBulkImportSelectedPlaces = async () => {
    const chosen = placeResults.filter(
      (p) =>
        selectedPlaceIds.includes(p.placeId) &&
        !isLeadDuplicate(p.name, p.phone)
    );
    if (chosen.length === 0) {
      onNotify("Selecione ao menos 1 empresa inédita para importar.", "info");
      return;
    }

    setImportingSelectedPlaces(true);
    try {
      const inputs: CreateLeadInput[] = chosen.map((candidate) => {
        const chosenFunnel =
          placeFunnels[candidate.placeId] || candidate.suggestedFunnel;
        const defaultVal =
          FUNNELS.find((f) => f.id === chosenFunnel)?.defaultValue ?? 1950;

        return {
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
          origin:
            candidate.source === "overture" || placesMode === "overture_bh"
              ? "Overture Maps BH"
              : placesMode === "google_live"
              ? "Google Places BH"
              : "OpenStreetMap BH",
          notes: `Captado em BH (${candidate.category}). Endereço: ${candidate.address}.`,
        };
      });

      const res = await onCreateLeadsBulk(inputs);
      setSelectedPlaceIds([]);
      onNotify(
        `${res.imported.length} empresa(s) importadas para o CRM (${res.skippedDuplicates} duplicadas ignoradas).`,
        "success"
      );
    } catch {
      onNotify("Erro ao importar empresas selecionadas.", "error");
    } finally {
      setImportingSelectedPlaces(false);
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
        origin:
          candidate.source === "overture" || placesMode === "overture_bh"
            ? "Overture Maps BH"
            : placesMode === "google_live"
            ? "Google Places BH"
            : "OpenStreetMap BH",
        notes: `Captado em BH (${candidate.category}). Endereço: ${candidate.address}.`,
      });
      if (res.duplicate) {
        onNotify("Duplicidade detectada: empresa já existe no CRM.", "info");
      } else {
        onNotify(`"${candidate.name}" enviado para o CRM (Captado).`, "success");
      }
    } catch {
      onNotify("Erro ao enviar empresa para o CRM.", "error");
    } finally {
      setSendingPlaceId(null);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError("");

    if (!mCompany.trim()) {
      setManualError("Informe o nome da empresa ou cliente.");
      return;
    }
    if (mPhone.replace(/\D/g, "").length < 10) {
      setManualError("Informe um WhatsApp ou telefone válido com DDD.");
      return;
    }
    if (mEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mEmail.trim())) {
      setManualError("Informe um endereço de e-mail válido.");
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
        setManualError(
          "Já existe um lead com este telefone ou nome de empresa no CRM."
        );
        return;
      }
      onNotify(`Lead "${res.lead.companyName}" cadastrado com sucesso.`, "success");
      setMCompany("");
      setMContact("");
      setMRole("");
      setMPhone("");
      setMEmail("");
      setMNeighborhood("");
      setMNotes("");
    } catch {
      setManualError("Erro ao salvar lead. Verifique sua conexão e tente novamente.");
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
        onNotify(
          "O CSV precisa ter cabeçalho e ao menos 1 linha de lead.",
          "error"
        );
        return;
      }

      const delimiter = lines[0].includes(";") ? ";" : ",";
      const headers = lines[0]
        .split(delimiter)
        .map((h) => normalizeName(h.replace(/^"|"$/g, "")));

      const findIdx = (candidates: string[]) =>
        headers.findIndex((h) => candidates.some((c) => h.includes(c)));

      const idxCompany = findIdx([
        "empresa",
        "company",
        "cliente",
        "loja",
        "nome",
      ]);
      const idxContact = findIdx([
        "contato",
        "decisor",
        "responsavel",
        "contact",
      ]);
      const idxPhone = findIdx([
        "telefone",
        "whatsapp",
        "celular",
        "phone",
        "fone",
      ]);
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
    a.download = "modelo-leads-ultimo-quadro-bh.csv";
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
        `${res.imported.length} leads importados (${res.skippedDuplicates} duplicados ignorados).`,
        "success"
      );
      setCsvRows([]);
      setCsvFileName("");
    } catch {
      onNotify("Erro ao importar leads do CSV.", "error");
    } finally {
      setImportingCsv(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono-num text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-text)]">
            Máquina de Prospecção · Belo Horizonte &amp; Nova Lima
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            Captação de Leads
          </h1>
        </div>

        <div
          className="flex flex-wrap items-center gap-1.5 rounded-xl p-1.5 surface-card"
          role="tablist"
          aria-label="Modos de captação de leads"
        >
          <button
            type="button"
            role="tab"
            aria-selected={subTab === "places"}
            onClick={() => setSubTab("places")}
            className={cn(
              "inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors",
              subTab === "places"
                ? "bg-[var(--accent-btn)] text-[var(--accent-fg)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            Captar Leads (BH)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === "manual"}
            onClick={() => setSubTab("manual")}
            className={cn(
              "inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors",
              subTab === "manual"
                ? "bg-[var(--accent-btn)] text-[var(--accent-fg)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
            Cadastro Manual
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === "csv"}
            onClick={() => setSubTab("csv")}
            className={cn(
              "inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors",
              subTab === "csv"
                ? "bg-[var(--accent-btn)] text-[var(--accent-fg)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
            Importar CSV
          </button>
        </div>
      </div>

      {/* TAB 1: OVERTURE MAPS BH + OSM FALLBACK */}
      {subTab === "places" && (
        <div className="space-y-5">
          <div className="surface-card rounded-xl p-6 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-[var(--text-primary)]">
                  Busca por Nicho + Bairro (BH &amp; Nova Lima)
                </h2>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  Extrai nome, telefone, e-mail, Instagram, endereço e site com
                  filtro automático anti-duplicidade.
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 self-start rounded-md px-3 py-1 text-[11px] font-semibold",
                  placesMode === "overture_bh" ||
                    placesMode === "google_live" ||
                    placesMode === "osm_free"
                    ? "badge-success"
                    : "badge-accent"
                )}
              >
                <MapPin className="h-3 w-3" aria-hidden="true" />
                {placesMode === "overture_bh"
                  ? `Overture Maps BH Ativo${
                      overtureMeta.total
                        ? ` (${overtureMeta.total.toLocaleString("pt-BR")} empresas)`
                        : ""
                    }`
                  : placesMode === "google_live"
                  ? "Google Places API Ativa"
                  : placesMode === "osm_free"
                  ? "OpenStreetMap BH (Fallback)"
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
                <label htmlFor="capture-places-query" className="sr-only">
                  Buscar nicho e bairro em Belo Horizonte
                </label>
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
                  aria-hidden="true"
                />
                <input
                  id="capture-places-query"
                  type="text"
                  value={placesQuery}
                  onChange={(e) => setPlacesQuery(e.target.value)}
                  placeholder='Ex: "restaurante gastronomia Lourdes" ou "confecção Barro Preto"'
                  className="input-field min-h-[46px] w-full rounded-lg py-3 pl-10 pr-4 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={placesLoading}
                className="btn-accent inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-bold disabled:opacity-60"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
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
                  className="min-h-[34px] rounded-md border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:border-[var(--accent-border)] hover:text-[var(--accent-text)] transition-colors"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {!hasSearched ? (
            <div className="surface-card rounded-xl p-10 text-center">
              <MapPin
                className="mx-auto h-8 w-8 text-[var(--accent-text)]"
                aria-hidden="true"
              />
              <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">
                Pronto para prospectar empresas em Belo Horizonte &amp; Nova Lima
              </p>
              <p className="mt-1 text-xs text-[var(--text-secondary)] max-w-md mx-auto">
                Digite um nicho e bairro acima ou clique em uma das sugestões
                rápidas para buscar empresas reais com filtro anti-duplicidade.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Quick Filters + Batch Selection Bar */}
              <div className="surface-card rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div
                  className="flex flex-wrap items-center gap-1.5"
                  role="group"
                  aria-label="Filtrar resultados da busca"
                >
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--text-muted)] mr-1">
                    <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                    Filtrar:
                  </span>
                  {(
                    [
                      {
                        id: "all",
                        label: `Todos (${placeResults.length})`,
                      },
                      {
                        id: "phone",
                        label: `Com Telefone (${placeResults.filter((p) => p.phone).length})`,
                      },
                      {
                        id: "instagram",
                        label: `Com Instagram (${placeResults.filter((p) => p.enrichedInstagram).length})`,
                      },
                      {
                        id: "email",
                        label: `Com E-mail (${placeResults.filter((p) => p.enrichedEmail).length})`,
                      },
                      {
                        id: "hide_existing",
                        label: "Ocultar já no CRM",
                      },
                    ] as const
                  ).map((fOpt) => (
                    <button
                      key={fOpt.id}
                      type="button"
                      onClick={() => setResultFilter(fOpt.id)}
                      aria-pressed={resultFilter === fOpt.id}
                      className={cn(
                        "min-h-[34px] rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors",
                        resultFilter === fOpt.id
                          ? "bg-[var(--accent-btn)] text-[var(--accent-fg)]"
                          : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      )}
                    >
                      {fOpt.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="btn-ghost inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
                  >
                    <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />
                    Selecionar página
                  </button>

                  {selectedPlaceIds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleBulkImportSelectedPlaces}
                      disabled={importingSelectedPlaces}
                      className="btn-accent inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      {importingSelectedPlaces
                        ? "Importando..."
                        : `Importar Selecionados (${selectedPlaceIds.length})`}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {filteredPlaceResults.map((place) => {
                  const duplicate = isLeadDuplicate(place.name, place.phone);
                  const selectedFunnel =
                    placeFunnels[place.placeId] || place.suggestedFunnel;
                  const isChecked = selectedPlaceIds.includes(place.placeId);

                  return (
                    <div
                      key={place.placeId}
                      className={cn(
                        "surface-card rounded-xl p-5 flex flex-col justify-between gap-4 transition-colors",
                        isChecked && "border-[var(--accent-border)] bg-[var(--accent-soft)]/30",
                        duplicate && "opacity-75"
                      )}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0">
                            {!duplicate && (
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSelectPlace(place.placeId)}
                                aria-label={`Selecionar ${place.name} para importação em lote`}
                                className="mt-1 h-4 w-4 rounded accent-[var(--accent)] shrink-0"
                              />
                            )}
                            <div className="min-w-0">
                              <span className="text-[11px] font-semibold text-[var(--accent-text)]">
                                {place.category} · {place.neighborhood}
                              </span>
                              <h3 className="mt-0.5 text-base font-bold text-[var(--text-primary)]">
                                {place.name}
                              </h3>
                            </div>
                          </div>

                          {place.rating ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-subtle)] px-2.5 py-1 font-mono-num text-xs font-semibold text-[var(--text-primary)] shrink-0">
                              <Star
                                className="h-3 w-3 fill-[var(--accent)] text-[var(--accent)]"
                                aria-hidden="true"
                              />
                              {place.rating.toFixed(1)}
                            </span>
                          ) : place.confidence ? (
                            <span
                              title="Score de confiança Overture Maps"
                              className="badge-success inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-mono-num text-[11px] font-semibold shrink-0"
                            >
                              {Math.round(place.confidence * 100)}% ativo
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-3 space-y-1.5 text-xs text-[var(--text-secondary)]">
                          <p className="flex items-center gap-2">
                            <Phone
                              className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0"
                              aria-hidden="true"
                            />
                            <span className="font-mono-num">
                              {place.phone || "Telefone não informado"}
                            </span>
                          </p>
                          <p className="flex items-start gap-2">
                            <MapPin
                              className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                            <span>{place.address}</span>
                          </p>
                          {place.website && (
                            <p className="flex items-center gap-2">
                              <Globe
                                className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0"
                                aria-hidden="true"
                              />
                              <a
                                href={place.website}
                                target="_blank"
                                rel="noreferrer"
                                className="truncate text-[var(--accent-text)] hover:underline"
                              >
                                {place.website.replace(/^https?:\/\//, "")}
                              </a>
                            </p>
                          )}
                          {(place.enrichedEmail || place.enrichedInstagram) && (
                            <div className="mt-2 flex flex-wrap gap-1.5 pt-1">
                              {place.enrichedEmail && (
                                <span className="badge-info inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium">
                                  <Mail className="h-3 w-3" aria-hidden="true" />
                                  {place.enrichedEmail}
                                </span>
                              )}
                              {place.enrichedInstagram && (
                                <span className="badge-accent inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium">
                                  <Instagram
                                    className="h-3 w-3"
                                    aria-hidden="true"
                                  />
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
                            aria-label={`Funil de destino para ${place.name}`}
                            onChange={(e) =>
                              setPlaceFunnels((prev) => ({
                                ...prev,
                                [place.placeId]: e.target.value as FunnelId,
                              }))
                            }
                            className="input-field min-h-[40px] rounded-lg px-2.5 py-2 text-xs disabled:opacity-50"
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
                              className="btn-ghost inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold disabled:opacity-50"
                            >
                              <Globe
                                className="h-3.5 w-3.5 text-[var(--accent-text)]"
                                aria-hidden="true"
                              />
                              {enrichingPlaceId === place.placeId
                                ? "Buscando..."
                                : "Buscar E-mail/Instagram"}
                            </button>
                          )}
                        </div>

                        {duplicate ? (
                          <span className="badge-success inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold">
                            <CheckCircle2
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            Já no CRM
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSendPlaceToCrm(place)}
                            disabled={sendingPlaceId === place.placeId}
                            className="btn-accent inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50"
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
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
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MANUAL FORM */}
      {subTab === "manual" && (
        <form
          onSubmit={handleManualSubmit}
          className="surface-card rounded-xl p-6 sm:p-8 max-w-4xl space-y-5"
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
              <label
                htmlFor="manual-company"
                className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5"
              >
                Empresa / Cliente *
              </label>
              <input
                id="manual-company"
                type="text"
                required
                value={mCompany}
                onChange={(e) => setMCompany(e.target.value)}
                placeholder="Ex: Construtora Minas Horizonte"
                className="input-field min-h-[44px] w-full rounded-lg px-3.5 py-2.5 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="manual-contact"
                className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5"
              >
                Nome do Decisor *
              </label>
              <input
                id="manual-contact"
                type="text"
                required
                value={mContact}
                onChange={(e) => setMContact(e.target.value)}
                placeholder="Ex: Juliana Mendes"
                className="input-field min-h-[44px] w-full rounded-lg px-3.5 py-2.5 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="manual-phone"
                className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5"
              >
                WhatsApp / Telefone *
              </label>
              <input
                id="manual-phone"
                type="tel"
                required
                value={mPhone}
                onChange={(e) => setMPhone(formatPhoneBr(e.target.value))}
                placeholder="(31) 99999-9999"
                className="input-field min-h-[44px] w-full rounded-lg px-3.5 py-2.5 font-mono-num text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="manual-email"
                className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5"
              >
                E-mail Comercial
              </label>
              <input
                id="manual-email"
                type="email"
                value={mEmail}
                onChange={(e) => setMEmail(e.target.value)}
                placeholder="juliana@empresa.com.br"
                className="input-field min-h-[44px] w-full rounded-lg px-3.5 py-2.5 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="manual-funnel"
                className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5"
              >
                Funil de Destino
              </label>
              <select
                id="manual-funnel"
                value={mFunnel}
                onChange={(e) => {
                  const next = e.target.value as FunnelId;
                  setMFunnel(next);
                  const found = FUNNELS.find((f) => f.id === next);
                  if (found) setMValue(String(found.defaultValue));
                }}
                className="input-field min-h-[44px] w-full rounded-lg px-3.5 py-2.5 text-sm"
              >
                {FUNNELS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label} ({f.subtitle})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="manual-value"
                className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5"
              >
                Valor Estimado (R$)
              </label>
              <input
                id="manual-value"
                type="number"
                min={0}
                value={mValue}
                onChange={(e) => setMValue(e.target.value)}
                className="input-field min-h-[44px] w-full rounded-lg px-3.5 py-2.5 font-mono-num text-sm font-semibold"
              />
            </div>

            <div>
              <label
                htmlFor="manual-role"
                className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5"
              >
                Cargo / Função
              </label>
              <input
                id="manual-role"
                type="text"
                value={mRole}
                onChange={(e) => setMRole(e.target.value)}
                placeholder="Ex: Gerente de RH"
                className="input-field min-h-[44px] w-full rounded-lg px-3.5 py-2.5 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="manual-neighborhood"
                className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5"
              >
                Bairro (BH / Nova Lima)
              </label>
              <input
                id="manual-neighborhood"
                type="text"
                value={mNeighborhood}
                onChange={(e) => setMNeighborhood(e.target.value)}
                placeholder="Ex: Lourdes, Savassi, Barro Preto..."
                className="input-field min-h-[44px] w-full rounded-lg px-3.5 py-2.5 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="manual-origin"
                className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5"
              >
                Origem
              </label>
              <input
                id="manual-origin"
                type="text"
                value={mOrigin}
                onChange={(e) => setMOrigin(e.target.value)}
                placeholder="Instagram, Indicação, LinkedIn..."
                className="input-field min-h-[44px] w-full rounded-lg px-3.5 py-2.5 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="manual-partner"
                className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5"
              >
                Parceiro Indicador (15% Comissão)
              </label>
              <select
                id="manual-partner"
                value={mPartnerId}
                onChange={(e) => setMPartnerId(e.target.value)}
                className="input-field min-h-[44px] w-full rounded-lg px-3.5 py-2.5 text-sm"
              >
                <option value="">Venda direta (sem parceiro)</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.company} · {p.commissionRate}%)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="manual-notes"
              className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5"
            >
              Observações Iniciais
            </label>
            <textarea
              id="manual-notes"
              rows={3}
              value={mNotes}
              onChange={(e) => setMNotes(e.target.value)}
              placeholder="Contexto da abordagem, data desejada, tipo de evento ou coleção..."
              className="input-field w-full rounded-lg px-3.5 py-2.5 text-sm"
            />
          </div>

          {manualError && (
            <p
              role="alert"
              className="badge-danger rounded-lg px-3.5 py-2.5 text-xs font-medium"
            >
              {manualError}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submittingManual}
              className="btn-accent inline-flex min-h-[44px] items-center gap-2 rounded-lg px-6 py-3 text-sm font-bold disabled:opacity-60"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {submittingManual ? "Salvando..." : "Cadastrar Lead no CRM"}
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: CSV BULK IMPORTER */}
      {subTab === "csv" && (
        <div className="surface-card rounded-xl p-6 sm:p-8 space-y-6">
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
              className="btn-ghost inline-flex min-h-[42px] items-center gap-1.5 self-start rounded-lg px-3.5 py-2 text-xs font-semibold"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Baixar CSV Modelo
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-12 sm:items-center">
            <div className="sm:col-span-4">
              <label
                htmlFor="csv-target-funnel"
                className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5"
              >
                Funil de Destino da Importação
              </label>
              <select
                id="csv-target-funnel"
                value={csvTargetFunnel}
                onChange={(e) =>
                  setCsvTargetFunnel(e.target.value as FunnelId)
                }
                className="input-field min-h-[44px] w-full rounded-lg px-3.5 py-2.5 text-sm"
              >
                {FUNNELS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-8">
              <label
                htmlFor="csv-file-input"
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)] px-6 py-6 text-center hover:border-[var(--accent-border)] transition-colors"
              >
                <Upload
                  className="h-6 w-6 text-[var(--accent-text)]"
                  aria-hidden="true"
                />
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
                  id="csv-file-input"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvUpload}
                  className="sr-only"
                />
              </label>
            </div>
          </div>

          {csvRows.length > 0 && (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-xl border border-[var(--border-hairline)]">
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
                      <tr key={idx} className="hover:bg-[var(--bg-subtle)]">
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
                            <span className="badge-warning rounded-md px-2.5 py-0.5 text-[10px] font-semibold">
                              Duplicado (ignorado)
                            </span>
                          ) : (
                            <span className="badge-success inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-[10px] font-semibold">
                              <Check className="h-3 w-3" aria-hidden="true" />
                              Pronto
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-[var(--text-secondary)]">
                  {csvRows.filter((r) => !r.isDuplicate).length} leads prontos
                  para importação
                </p>
                <button
                  type="button"
                  onClick={handleImportCsv}
                  disabled={importingCsv}
                  className="btn-accent inline-flex min-h-[42px] items-center gap-2 rounded-lg px-5 py-2.5 text-xs font-bold disabled:opacity-50"
                >
                  <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
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
