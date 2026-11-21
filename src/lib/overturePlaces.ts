import fs from "fs";
import path from "path";
import zlib from "zlib";
import { FunnelId, PlaceCandidate } from "@/types/crm";

interface CompactOvertureRecord {
  id: string;
  n: string; // name
  c: string; // Portuguese category label
  t: string; // Overture taxonomy primary
  f: FunnelId;
  b: string; // neighborhood
  a: string; // address
  cf: number; // confidence 0..1
  lt: number; // lat
  ln: number; // lon
  p?: string; // phone
  w?: string; // website
  ig?: string; // instagram
  e?: string; // email
}

interface OvertureDatasetFile {
  release: string;
  generatedAt: string;
  region: string;
  total: number;
  countsByFunnel: Record<FunnelId, number>;
  places: CompactOvertureRecord[];
}

interface IndexedOvertureRecord extends CompactOvertureRecord {
  normName: string;
  normCat: string;
  normTax: string;
  normNeighborhood: string;
  normAddress: string;
}

interface CachedDataset {
  release: string;
  generatedAt: string;
  total: number;
  countsByFunnel: Record<FunnelId, number>;
  records: IndexedOvertureRecord[];
}

const DATASET_PATH = path.join(
  process.cwd(),
  "src",
  "data",
  "overture-bh-places.json.gz"
);

let cachedDataset: CachedDataset | null = null;

function norm(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const BH_NEIGHBORHOOD_CENTERS: Record<
  string,
  { lat: number; lon: number; radiusKm: number }
> = {
  savassi: { lat: -19.9396, lon: -43.9347, radiusKm: 1.8 },
  lourdes: { lat: -19.9308, lon: -43.9438, radiusKm: 1.6 },
  funcionarios: { lat: -19.9333, lon: -43.9275, radiusKm: 1.8 },
  "barro preto": { lat: -19.9218, lon: -43.9519, radiusKm: 1.8 },
  "santo agostinho": { lat: -19.9267, lon: -43.9511, radiusKm: 1.6 },
  centro: { lat: -19.9191, lon: -43.9386, radiusKm: 2.0 },
  sion: { lat: -19.9467, lon: -43.9296, radiusKm: 1.8 },
  anchieta: { lat: -19.9489, lon: -43.9212, radiusKm: 1.8 },
  cruzeiro: { lat: -19.9441, lon: -43.9198, radiusKm: 1.6 },
  carmo: { lat: -19.9408, lon: -43.9278, radiusKm: 1.5 },
  serra: { lat: -19.938, lon: -43.9136, radiusKm: 2.0 },
  mangabeiras: { lat: -19.9532, lon: -43.9082, radiusKm: 2.2 },
  "santa efigenia": { lat: -19.9234, lon: -43.9228, radiusKm: 1.8 },
  "santa tereza": { lat: -19.9144, lon: -43.9167, radiusKm: 1.8 },
  floresta: { lat: -19.9132, lon: -43.931, radiusKm: 1.8 },
  "santo antonio": { lat: -19.9422, lon: -43.9412, radiusKm: 1.6 },
  "cidade jardim": { lat: -19.9442, lon: -43.9493, radiusKm: 1.8 },
  luxemburgo: { lat: -19.9512, lon: -43.9502, radiusKm: 1.8 },
  gutierrez: { lat: -19.9367, lon: -43.9608, radiusKm: 1.8 },
  prado: { lat: -19.9221, lon: -43.9635, radiusKm: 1.8 },
  grajau: { lat: -19.9388, lon: -43.9675, radiusKm: 1.8 },
  belvedere: { lat: -19.9744, lon: -43.9469, radiusKm: 2.4 },
  buritis: { lat: -19.9708, lon: -43.9721, radiusKm: 2.6 },
  estoril: { lat: -19.9612, lon: -43.9633, radiusKm: 2.0 },
  "santa lucia": { lat: -19.9571, lon: -43.9438, radiusKm: 2.0 },
  "vila da serra": { lat: -19.983, lon: -43.9395, radiusKm: 2.6 },
  "vale do sereno": { lat: -19.991, lon: -43.934, radiusKm: 2.2 },
  "jardim canada": { lat: -20.0448, lon: -43.9808, radiusKm: 3.0 },
  "nova lima": { lat: -19.986, lon: -43.847, radiusKm: 6.0 },
  pampulha: { lat: -19.8582, lon: -43.9718, radiusKm: 4.5 },
  "ouro preto": { lat: -19.878, lon: -43.985, radiusKm: 2.4 },
  castelo: { lat: -19.8886, lon: -43.9978, radiusKm: 2.4 },
  "cidade nova": { lat: -19.8861, lon: -43.9278, radiusKm: 2.4 },
  "padre eustaquio": { lat: -19.9144, lon: -43.9752, radiusKm: 2.2 },
  barreiro: { lat: -19.9755, lon: -44.0185, radiusKm: 3.5 },
  "venda nova": { lat: -19.8148, lon: -43.9588, radiusKm: 3.5 },
};

const QUERY_SYNONYMS: Record<string, string[]> = {
  confeccao: ["clothing", "moda", "roupa", "boutique", "womens_clothing", "mens_clothing", "apparel", "textile"],
  confeccoes: ["clothing", "moda", "roupa", "boutique", "womens_clothing", "mens_clothing", "apparel", "textile"],
  moda: ["clothing", "boutique", "fashion", "roupa", "shoe", "jewelry", "lingerie", "bridal", "moda"],
  roupa: ["clothing", "boutique", "fashion", "moda"],
  atacado: ["clothing", "moda", "boutique", "textile", "apparel"],
  clinica: ["clinic", "medical_spa", "skin_care", "dermatologist", "dentist", "plastic_surgeon", "clinica"],
  estetica: ["medical_spa", "beauty_salon", "skin_care", "spa", "dermatologist", "aesthetic", "estetica", "cosmetic"],
  wellness: ["spa", "pilates", "yoga", "fitness", "gym", "massage", "wellness"],
  restaurante: ["restaurant", "bistro", "steakhouse", "gastropub", "restaurante"],
  gastronomia: ["restaurant", "bistro", "cafe", "bakery", "burger", "pizza", "sushi", "steakhouse", "gastropub"],
  ifood: ["restaurant", "burger", "pizza", "sushi", "bakery", "cafe"],
  hamburgueria: ["burger", "hamburgueria", "fast_food"],
  pizzaria: ["pizza", "pizzaria", "italian_restaurant"],
  padaria: ["bakery", "patisserie", "cafe", "padaria"],
  cafe: ["cafe", "coffee_shop", "cafeteria", "bakery"],
  bar: ["bar", "cocktail_bar", "pub", "wine_bar", "beer_bar", "lounge"],
  nightlife: ["nightclub", "cocktail_bar", "lounge", "pub", "bar", "live_music", "music_venue", "dance_club"],
  balada: ["nightclub", "dance_club", "lounge", "live_music", "bar"],
  festa: ["event_venue", "banquet_hall", "wedding_venue", "nightclub", "event_planning"],
  evento: ["event_venue", "event_planning", "wedding_venue", "banquet_hall", "convention_center", "hotel"],
  eventos: ["event_venue", "event_planning", "wedding_venue", "banquet_hall", "convention_center", "hotel"],
  espaco: ["event_venue", "wedding_venue", "banquet_hall", "coworking_space", "convention_center"],
  hotel: ["hotel", "resort"],
  corporativo: ["hotel", "coworking", "convention_center", "event_venue", "law_firm", "architecture", "software", "marketing", "consulting", "business"],
  advocacia: ["law_firm", "legal_services", "attorney", "advocacia"],
  arquitetura: ["architect", "architecture_firm", "interior_design", "arquitetura"],
  odonto: ["dentist", "cosmetic_dentist", "odontolog"],
  odontologia: ["dentist", "cosmetic_dentist", "odontolog"],
  academia: ["gym", "fitness_center", "pilates", "yoga", "academia"],
};

const STOP_WORDS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "em",
  "na",
  "no",
  "para",
  "com",
  "bh",
  "belo",
  "horizonte",
  "mg",
  "e",
]);

function approxKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dlat = (lat2 - lat1) * 111;
  const dlon = (lon2 - lon1) * 111 * Math.cos((lat1 * Math.PI) / 180);
  return Math.sqrt(dlat * dlat + dlon * dlon);
}

export function loadOvertureDataset(): CachedDataset | null {
  if (cachedDataset) return cachedDataset;
  if (!fs.existsSync(DATASET_PATH)) return null;

  try {
    const gzBuffer = fs.readFileSync(DATASET_PATH);
    const jsonText = zlib.gunzipSync(gzBuffer).toString("utf-8");
    const parsed = JSON.parse(jsonText) as OvertureDatasetFile;

    const records: IndexedOvertureRecord[] = (parsed.places || []).map((rec) => ({
      ...rec,
      normName: norm(rec.n),
      normCat: norm(rec.c),
      normTax: norm(rec.t),
      normNeighborhood: norm(rec.b),
      normAddress: norm(rec.a),
    }));

    cachedDataset = {
      release: parsed.release,
      generatedAt: parsed.generatedAt,
      total: parsed.total,
      countsByFunnel: parsed.countsByFunnel,
      records,
    };
    return cachedDataset;
  } catch (err) {
    console.error("[Overture Places] Failed to load dataset:", err);
    return null;
  }
}

export function getOvertureMeta(): {
  available: boolean;
  release?: string;
  total?: number;
  generatedAt?: string;
} {
  const ds = loadOvertureDataset();
  if (!ds) return { available: false };
  return {
    available: true,
    release: ds.release,
    total: ds.total,
    generatedAt: ds.generatedAt,
  };
}

function detectTargetFunnel(normQuery: string): FunnelId | null {
  if (
    normQuery.includes("moda") ||
    normQuery.includes("confecc") ||
    normQuery.includes("roupa") ||
    normQuery.includes("boutique") ||
    normQuery.includes("atacado")
  ) {
    return "moda";
  }
  if (
    normQuery.includes("estetica") ||
    normQuery.includes("clinica") ||
    normQuery.includes("dermato") ||
    normQuery.includes("wellness") ||
    normQuery.includes("pilates") ||
    normQuery.includes("odonto") ||
    normQuery.includes("salao")
  ) {
    return "estetica";
  }
  if (
    normQuery.includes("nightlife") ||
    normQuery.includes("balada") ||
    normQuery.includes("boate") ||
    normQuery.includes("club") ||
    normQuery.includes("lounge") ||
    normQuery.includes("pub") ||
    normQuery.includes("bar ") ||
    normQuery === "bar"
  ) {
    return "nightlife";
  }
  if (
    normQuery.includes("restaurante") ||
    normQuery.includes("gastronomia") ||
    normQuery.includes("ifood") ||
    normQuery.includes("hamburgueria") ||
    normQuery.includes("pizzaria") ||
    normQuery.includes("padaria") ||
    normQuery.includes("cafe") ||
    normQuery.includes("bistro")
  ) {
    return "gastronomia";
  }
  if (
    normQuery.includes("corporativ") ||
    normQuery.includes("evento") ||
    normQuery.includes("hotel") ||
    normQuery.includes("coworking") ||
    normQuery.includes("advocacia") ||
    normQuery.includes("arquitetura")
  ) {
    return "corporativo";
  }
  return null;
}

export function searchOvertureBH(
  rawQuery: string,
  rawNeighborhood = "",
  limit = 16
): {
  results: PlaceCandidate[];
  release: string;
  totalIndexed: number;
} | null {
  const ds = loadOvertureDataset();
  if (!ds) return null;

  const combined = norm(`${rawQuery} ${rawNeighborhood}`).trim();
  if (!combined) {
    return { results: [], release: ds.release, totalIndexed: ds.total };
  }

  // Detect neighborhood filter (longest match first)
  let matchedNeighborhoodKey: string | null = null;
  const nbKeys = Object.keys(BH_NEIGHBORHOOD_CENTERS).sort(
    (a, b) => b.length - a.length
  );
  for (const key of nbKeys) {
    if (combined.includes(key)) {
      matchedNeighborhoodKey = key;
      break;
    }
  }
  const nbCenter = matchedNeighborhoodKey
    ? BH_NEIGHBORHOOD_CENTERS[matchedNeighborhoodKey]
    : null;

  // Remove matched neighborhood words from niche tokens
  let nicheText = combined;
  if (matchedNeighborhoodKey) {
    nicheText = nicheText.replace(matchedNeighborhoodKey, " ").trim();
  }

  const rawTokens = nicheText
    .split(/[\s,.-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));

  const targetFunnel = detectTargetFunnel(nicheText || combined);

  const expandedGroups: string[][] = rawTokens.map((tok) => {
    const syns = QUERY_SYNONYMS[tok];
    return syns ? Array.from(new Set([tok, ...syns])) : [tok];
  });

  const scored: Array<{ rec: IndexedOvertureRecord; score: number }> = [];

  for (const rec of ds.records) {
    let score = 0;

    // 1. Geographic neighborhood filter & proximity score
    let geoMatched = true;
    if (nbCenter && matchedNeighborhoodKey) {
      const distKm = approxKm(rec.lt, rec.ln, nbCenter.lat, nbCenter.lon);
      const textNbMatch =
        rec.normNeighborhood.includes(matchedNeighborhoodKey) ||
        rec.normAddress.includes(matchedNeighborhoodKey) ||
        rec.normName.includes(matchedNeighborhoodKey);

      if (textNbMatch) {
        score += 18;
      } else if (distKm <= nbCenter.radiusKm) {
        score += Math.max(6, 16 - distKm * 4);
      } else if (distKm <= nbCenter.radiusKm * 1.75) {
        score += 3;
      } else {
        geoMatched = false;
      }
    }
    if (!geoMatched) continue;

    // 2. Keyword & taxonomy matching
    let matchedTokenCount = 0;
    for (const group of expandedGroups) {
      let groupBest = 0;
      for (const term of group) {
        if (rec.normName.includes(term)) {
          groupBest = Math.max(groupBest, 12);
        } else if (rec.normCat.includes(term) || rec.normTax.includes(term)) {
          groupBest = Math.max(groupBest, 9);
        } else if (rec.normAddress.includes(term)) {
          groupBest = Math.max(groupBest, 4);
        }
      }
      if (groupBest > 0) {
        matchedTokenCount += 1;
        score += groupBest;
      }
    }

    // 3. Funnel alignment boost
    if (targetFunnel && rec.f === targetFunnel) {
      score += 8;
    }

    // Require meaningful match when niche tokens were provided
    if (expandedGroups.length > 0 && matchedTokenCount === 0) {
      if (!(targetFunnel && rec.f === targetFunnel && nbCenter)) {
        continue;
      }
    }

    // 4. Contact richness & confidence tie-breakers
    score += rec.cf * 3;
    if (rec.p) score += 2.5;
    if (rec.w) score += 1.5;
    if (rec.ig) score += 2;
    if (rec.e) score += 1.5;

    if (score > 0) {
      scored.push({ rec, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  const results: PlaceCandidate[] = scored.slice(0, limit).map(({ rec }) => ({
    placeId: `ovt-${rec.id}`,
    name: rec.n,
    phone: rec.p || "",
    address: rec.a,
    neighborhood: rec.b,
    website: rec.w || "",
    category: rec.c,
    confidence: rec.cf,
    source: "overture",
    suggestedFunnel: rec.f,
    enrichedEmail: rec.e,
    enrichedInstagram: rec.ig,
  }));

  return {
    results,
    release: ds.release,
    totalIndexed: ds.total,
  };
}
