import { NextRequest, NextResponse } from "next/server";
import { DEMO_BH_PLACES } from "@/lib/seed";
import { FunnelId, PlaceCandidate } from "@/types/crm";

export const dynamic = "force-dynamic";

const BH_NEIGHBORHOOD_COORDS: Record<string, { lat: number; lon: number; label: string }> = {
  lourdes: { lat: -19.9295, lon: -43.9415, label: "Lourdes" },
  savassi: { lat: -19.9388, lon: -43.9346, label: "Savassi" },
  "barro preto": { lat: -19.9204, lon: -43.9532, label: "Barro Preto" },
  funcionarios: { lat: -19.9325, lon: -43.9295, label: "Funcionários" },
  pampulha: { lat: -19.8588, lon: -43.9788, label: "Pampulha" },
  belvedere: { lat: -19.9746, lon: -43.9458, label: "Belvedere" },
  centro: { lat: -19.9191, lon: -43.9386, label: "Centro" },
  sion: { lat: -19.9488, lon: -43.9291, label: "Sion" },
  buritis: { lat: -19.9708, lon: -43.9675, label: "Buritis" },
  "santo agostinho": { lat: -19.9261, lon: -43.9504, label: "Santo Agostinho" },
  serra: { lat: -19.9386, lon: -43.9165, label: "Serra" },
  mangabeiras: { lat: -19.9517, lon: -43.9128, label: "Mangabeiras" },
  prado: { lat: -19.9212, lon: -43.9648, label: "Prado" },
  "cidade nova": { lat: -19.8842, lon: -43.9277, label: "Cidade Nova" },
  "vila da serra": { lat: -19.9781, lon: -43.9445, label: "Vila da Serra" },
  "nova lima": { lat: -19.9857, lon: -43.8469, label: "Nova Lima" },
};

function inferFunnelFromQuery(text: string): FunnelId {
  const lower = normalizeSearch(text);
  if (
    lower.includes("barro preto") ||
    lower.includes("confec") ||
    lower.includes("moda") ||
    lower.includes("roupa") ||
    lower.includes("clothes") ||
    lower.includes("boutique") ||
    lower.includes("atacado")
  ) {
    return "moda";
  }
  if (
    lower.includes("clinica") ||
    lower.includes("estetica") ||
    lower.includes("spa") ||
    lower.includes("wellness") ||
    lower.includes("fitness") ||
    lower.includes("pilates") ||
    lower.includes("dermato") ||
    lower.includes("beauty") ||
    lower.includes("dentist") ||
    lower.includes("medico")
  ) {
    return "estetica";
  }
  if (
    lower.includes("nightlife") ||
    lower.includes("balada") ||
    lower.includes("club") ||
    lower.includes("boate") ||
    lower.includes("pub") ||
    lower.includes("lounge") ||
    lower.includes("casa de show") ||
    lower.includes("festa")
  ) {
    return "nightlife";
  }
  if (
    lower.includes("restaurante") ||
    lower.includes("gastronomia") ||
    lower.includes("hamburgueria") ||
    lower.includes("cafe") ||
    lower.includes("pizzaria") ||
    lower.includes("ifood") ||
    lower.includes("delivery") ||
    lower.includes("bistro") ||
    lower.includes("bar")
  ) {
    return "gastronomia";
  }
  return "corporativo";
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function extractNeighborhoodFromAddress(
  address: string,
  fallback: string
): string {
  const bhMatch = address.match(/-\s*([^,-]+),\s*Belo Horizonte/i);
  if (bhMatch?.[1]) return bhMatch[1].trim();
  return fallback || "Belo Horizonte";
}

function buildOverpassFilters(normalizedQuery: string): string[] {
  const filters: string[] = [];

  if (
    normalizedQuery.includes("confec") ||
    normalizedQuery.includes("moda") ||
    normalizedQuery.includes("roupa") ||
    normalizedQuery.includes("loja") ||
    normalizedQuery.includes("atacado") ||
    normalizedQuery.includes("barro preto")
  ) {
    filters.push('["shop"~"clothes|fashion|boutique|tailor|fabric|shoes|jewelry"]');
  }

  if (
    normalizedQuery.includes("restaurante") ||
    normalizedQuery.includes("gastronomia") ||
    normalizedQuery.includes("bar") ||
    normalizedQuery.includes("bistro")
  ) {
    filters.push('["amenity"~"restaurant|bar|cafe"]');
  }

  if (
    normalizedQuery.includes("evento") ||
    normalizedQuery.includes("buffet") ||
    normalizedQuery.includes("espaco") ||
    normalizedQuery.includes("salao")
  ) {
    filters.push('["amenity"~"events_venue|conference_centre|restaurant|theatre"]');
  }

  if (normalizedQuery.includes("hotel") || normalizedQuery.includes("pousada")) {
    filters.push('["tourism"~"hotel|guest_house"]');
  }

  if (
    normalizedQuery.includes("clinica") ||
    normalizedQuery.includes("estetica") ||
    normalizedQuery.includes("medico") ||
    normalizedQuery.includes("odonto") ||
    normalizedQuery.includes("dermato")
  ) {
    filters.push('["amenity"~"clinic|doctors|dentist"]');
    filters.push('["shop"~"beauty|cosmetics"]');
  }

  if (
    normalizedQuery.includes("arquitetura") ||
    normalizedQuery.includes("advocacia") ||
    normalizedQuery.includes("escritorio") ||
    normalizedQuery.includes("empresa") ||
    normalizedQuery.includes("corporativ")
  ) {
    filters.push('["office"]');
  }

  if (filters.length === 0) {
    filters.push('["amenity"~"restaurant|events_venue|clinic"]');
    filters.push('["shop"~"clothes|fashion|beauty"]');
    filters.push('["tourism"="hotel"]');
  }

  return filters;
}

function formatOsmPhone(raw?: string): string {
  if (!raw) return "";
  return raw.split(";")[0].trim();
}

function formatOsmWebsite(raw?: string): string {
  if (!raw) return "";
  const first = raw.split(";")[0].trim();
  if (!first) return "";
  return /^https?:\/\//i.test(first) ? first : `https://${first}`;
}

function formatOsmInstagram(raw?: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (trimmed.startsWith("@")) return trimmed;
  const match = trimmed.match(/instagram\.com\/([a-zA-Z0-9._]+)/i);
  if (match?.[1]) return `@${match[1]}`;
  if (/^[a-zA-Z0-9._]{2,30}$/.test(trimmed)) return `@${trimmed}`;
  return undefined;
}

async function searchOpenStreetMapBH(
  combinedQuery: string,
  rawNeighborhood: string
): Promise<PlaceCandidate[]> {
  const norm = normalizeSearch(combinedQuery);
  const matchedHood = Object.entries(BH_NEIGHBORHOOD_COORDS).find(([key]) =>
    norm.includes(key)
  );
  const center = matchedHood
    ? matchedHood[1]
    : { lat: -19.9245, lon: -43.9352, label: rawNeighborhood || "Belo Horizonte" };

  const candidates: PlaceCandidate[] = [];
  const seenNames = new Set<string>();

  const pushUnique = (item: PlaceCandidate) => {
    const key = normalizeSearch(item.name);
    if (!key || seenNames.has(key)) return;
    seenNames.add(key);
    candidates.push(item);
  };

  // 1. Fast Overpass radius query around the BH neighborhood (returns real phones, websites, Instagram)
  const filters = buildOverpassFilters(norm);
  const radius = matchedHood ? 1400 : 3000;
  const unionParts = filters
    .map((f) => `nwr${f}["name"](around:${radius},${center.lat},${center.lon});`)
    .join("");
  const overpassQuery = `[out:json][timeout:8];(${unionParts});out tags center 25;`;

  const overpassEndpoints = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
  ];

  for (const endpoint of overpassEndpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7500);
      const res = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "UltimoQuadroCRM/1.0 (Belo Horizonte & Nova Lima)",
        },
        body: `data=${encodeURIComponent(overpassQuery)}`,
      });
      clearTimeout(timer);

      if (!res.ok) continue;
      const json = (await res.json()) as {
        elements?: Array<{
          id: number;
          type: string;
          tags?: Record<string, string>;
        }>;
      };

      const elements = json.elements ?? [];
      // Sort so places with phone or website appear first!
      elements.sort((a, b) => {
        const scoreA =
          (a.tags?.phone || a.tags?.["contact:phone"] ? 2 : 0) +
          (a.tags?.website || a.tags?.["contact:website"] ? 2 : 0) +
          (a.tags?.["contact:instagram"] || a.tags?.instagram ? 1 : 0);
        const scoreB =
          (b.tags?.phone || b.tags?.["contact:phone"] ? 2 : 0) +
          (b.tags?.website || b.tags?.["contact:website"] ? 2 : 0) +
          (b.tags?.["contact:instagram"] || b.tags?.instagram ? 1 : 0);
        return scoreB - scoreA;
      });

      for (const el of elements.slice(0, 15)) {
        const t = el.tags ?? {};
        if (!t.name) continue;

        const street = t["addr:street"] || "";
        const num = t["addr:housenumber"] ? `, ${t["addr:housenumber"]}` : "";
        const suburb = t["addr:suburb"] || center.label;
        const address = street
          ? `${street}${num} — ${suburb}, Belo Horizonte - MG`
          : `${suburb}, Belo Horizonte - MG`;

        const categoryRaw =
          t.shop || t.amenity || t.tourism || t.office || "Estabelecimento BH";
        const categoryMap: Record<string, string> = {
          restaurant: "Restaurante",
          events_venue: "Espaço de Eventos",
          conference_centre: "Centro de Convenções",
          hotel: "Hotel Corporativo",
          clothes: "Moda & Confecção",
          fashion: "Moda & Confecção",
          boutique: "Boutique & Moda",
          beauty: "Estética & Beleza",
          clinic: "Clínica",
          doctors: "Consultório Médico",
          dentist: "Clínica Odontológica",
          bar: "Bar & Lounge",
          cafe: "Café & Bistrô",
        };
        const category =
          categoryMap[categoryRaw] ||
          categoryRaw.replaceAll("_", " ").replace(/^\w/, (c) => c.toUpperCase());

        pushUnique({
          placeId: `osm-${el.type}-${el.id}`,
          name: t.name,
          phone: formatOsmPhone(t.phone || t["contact:phone"]),
          address,
          neighborhood: suburb,
          website: formatOsmWebsite(t.website || t["contact:website"]),
          category,
          suggestedFunnel: inferFunnelFromQuery(`${combinedQuery} ${category}`),
          enrichedEmail: (t.email || t["contact:email"] || "").trim() || undefined,
          enrichedInstagram: formatOsmInstagram(
            t["contact:instagram"] || t.instagram
          ),
        });
      }

      if (candidates.length > 0) break;
    } catch {
      // Try next mirror or Nominatim fallback
    }
  }

  // 2. Supplement or fallback via Nominatim free-text search (very fast, <1.5s)
  if (candidates.length < 6) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const nomUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&extratags=1&limit=10&q=${encodeURIComponent(
        `${combinedQuery} Belo Horizonte MG Brasil`
      )}`;
      const res = await fetch(nomUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "UltimoQuadroCRM/1.0 (Belo Horizonte & Nova Lima)",
          "Accept-Language": "pt-BR,pt;q=0.9",
        },
      });
      clearTimeout(timer);

      if (res.ok) {
        const items = (await res.json()) as Array<{
          place_id: number;
          name?: string;
          display_name?: string;
          type?: string;
          address?: Record<string, string>;
          extratags?: Record<string, string> | null;
        }>;

        for (const item of items) {
          if (!item.name) continue;
          const addr = item.address ?? {};
          const extra = item.extratags ?? {};
          const suburb =
            addr.suburb || addr.neighbourhood || center.label || "Belo Horizonte";
          const road = addr.road || "";
          const house = addr.house_number ? `, ${addr.house_number}` : "";
          const formattedAddr = road
            ? `${road}${house} — ${suburb}, Belo Horizonte - MG`
            : item.display_name?.split(",").slice(0, 3).join(",") ||
              `${suburb}, Belo Horizonte - MG`;

          pushUnique({
            placeId: `nom-${item.place_id}`,
            name: item.name,
            phone: formatOsmPhone(extra.phone || extra["contact:phone"]),
            address: formattedAddr,
            neighborhood: suburb,
            website: formatOsmWebsite(extra.website || extra["contact:website"]),
            category:
              (item.type || "Estabelecimento BH")
                .replaceAll("_", " ")
                .replace(/^\w/, (c) => c.toUpperCase()),
            suggestedFunnel: inferFunnelFromQuery(
              `${combinedQuery} ${item.type || ""}`
            ),
            enrichedEmail:
              (extra.email || extra["contact:email"] || "").trim() || undefined,
            enrichedInstagram: formatOsmInstagram(
              extra["contact:instagram"] || extra.instagram
            ),
          });
        }
      }
    } catch {
      // Ignore Nominatim network error
    }
  }

  return candidates.slice(0, 15);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      query?: string;
      neighborhood?: string;
    };
    const rawQuery = (body.query || "").trim();
    const rawNeighborhood = (body.neighborhood || "").trim();
    const combinedQuery = [rawQuery, rawNeighborhood]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (!combinedQuery) {
      return NextResponse.json(
        { error: "Informe um nicho ou bairro de Belo Horizonte para buscar." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();

    // 1. Try Google Places API (New) if configured and billing active
    if (apiKey) {
      try {
        const response = await fetch(
          "https://places.googleapis.com/v1/places:searchText",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": apiKey,
              "X-Goog-FieldMask":
                "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.primaryTypeDisplayName,places.rating",
            },
            body: JSON.stringify({
              textQuery: `${combinedQuery}, Belo Horizonte, MG, Brasil`,
              languageCode: "pt-BR",
              maxResultCount: 15,
            }),
          }
        );

        if (response.ok) {
          const json = (await response.json()) as {
            places?: Array<{
              id?: string;
              displayName?: { text?: string };
              formattedAddress?: string;
              nationalPhoneNumber?: string;
              websiteUri?: string;
              primaryTypeDisplayName?: { text?: string };
              rating?: number;
            }>;
          };

          const results: PlaceCandidate[] = (json.places ?? []).map((p, idx) => {
            const address = p.formattedAddress || "Belo Horizonte - MG";
            return {
              placeId: p.id || `gplace-${idx}`,
              name: p.displayName?.text || "Empresa em Belo Horizonte",
              phone: p.nationalPhoneNumber || "",
              address,
              neighborhood: extractNeighborhoodFromAddress(
                address,
                rawNeighborhood
              ),
              website: p.websiteUri || "",
              category:
                p.primaryTypeDisplayName?.text || "Estabelecimento Comercial",
              rating: p.rating,
              suggestedFunnel: inferFunnelFromQuery(
                `${combinedQuery} ${p.primaryTypeDisplayName?.text || ""}`
              ),
            };
          });

          return NextResponse.json({
            mode: "google_live",
            query: combinedQuery,
            results,
          });
        }
      } catch {
        // Fallback seamlessly to OpenStreetMap BH (100% Free)
      }
    }

    // 2. Real Belo Horizonte data via OpenStreetMap (Overpass + Nominatim — 100% Free, no billing required)
    const osmResults = await searchOpenStreetMapBH(
      combinedQuery,
      rawNeighborhood
    );

    if (osmResults.length > 0) {
      return NextResponse.json({
        mode: "osm_free",
        query: combinedQuery,
        results: osmResults,
      });
    }

    // 3. Offline Demo Fallback
    const tokens = normalizeSearch(combinedQuery)
      .split(/\s+/)
      .filter((t) => t.length >= 2);

    const scored = DEMO_BH_PLACES.map((item) => {
      const haystack = normalizeSearch(
        `${item.name} ${item.category} ${item.neighborhood} ${item.address}`
      );
      const score = tokens.reduce(
        (acc, token) => (haystack.includes(token) ? acc + 1 : acc),
        0
      );
      return { item, score };
    });

    const filtered = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((s) => s.item);

    const results = filtered.length > 0 ? filtered : DEMO_BH_PLACES.slice(0, 6);

    return NextResponse.json({
      mode: "demo",
      query: combinedQuery,
      results,
    });
  } catch {
    return NextResponse.json(
      { error: "Erro ao consultar estabelecimentos em BH." },
      { status: 500 }
    );
  }
}
