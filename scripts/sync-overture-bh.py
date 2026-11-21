#!/usr/bin/env python3
"""
Extracts real commercial businesses for Belo Horizonte & Nova Lima (MG)
from Overture Maps Places (GeoParquet on S3) into a compact gzipped index
at src/data/overture-bh-places.json.gz for fast serverless search on Vercel.

Usage:
  python scripts/sync-overture-bh.py
"""

from __future__ import annotations

import gzip
import json
import math
import os
import re
import unicodedata
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import duckdb

# Bounding box covering Belo Horizonte + Nova Lima
BH_BBOX = {
    "xmin": -44.08,
    "xmax": -43.78,
    "ymin": -20.06,
    "ymax": -19.77,
}

MIN_CONFIDENCE = 0.65
MAX_RECORDS = 8000

OUTPUT_PATH = Path(__file__).resolve().parent.parent / "src" / "data" / "overture-bh-places.json.gz"

# Neighborhood centroids for GPS-based fallback when Overture freeform omits bairro
BH_NEIGHBORHOOD_CENTERS: list[tuple[str, float, float, float]] = [
    ("Savassi", -19.9396, -43.9347, 1.1),
    ("Lourdes", -19.9308, -43.9438, 1.0),
    ("Funcionários", -19.9333, -43.9275, 1.1),
    ("Barro Preto", -19.9218, -43.9519, 1.1),
    ("Santo Agostinho", -19.9267, -43.9511, 1.0),
    ("Centro", -19.9191, -43.9386, 1.2),
    ("Sion", -19.9467, -43.9296, 1.1),
    ("Anchieta", -19.9489, -43.9212, 1.1),
    ("Cruzeiro", -19.9441, -43.9198, 1.0),
    ("Carmo", -19.9408, -43.9278, 0.9),
    ("Serra", -19.9380, -43.9136, 1.2),
    ("Mangabeiras", -19.9532, -43.9082, 1.4),
    ("Santa Efigênia", -19.9234, -43.9228, 1.2),
    ("Santa Tereza", -19.9144, -43.9167, 1.2),
    ("Floresta", -19.9132, -43.9310, 1.2),
    ("Santo Antônio", -19.9422, -43.9412, 1.0),
    ("Cidade Jardim", -19.9442, -43.9493, 1.1),
    ("Luxemburgo", -19.9512, -43.9502, 1.1),
    ("Gutierrez", -19.9367, -43.9608, 1.1),
    ("Prado", -19.9221, -43.9635, 1.2),
    ("Grajaú", -19.9388, -43.9675, 1.2),
    ("Belvedere", -19.9744, -43.9469, 1.5),
    ("Buritis", -19.9708, -43.9721, 1.8),
    ("Estoril", -19.9612, -43.9633, 1.3),
    ("Santa Lúcia", -19.9571, -43.9438, 1.2),
    ("Vila da Serra", -19.9830, -43.9395, 1.8),
    ("Vale do Sereno", -19.9910, -43.9340, 1.5),
    ("Jardim Canadá", -20.0448, -43.9808, 2.2),
    ("Nova Lima", -19.9860, -43.8470, 3.0),
    ("Pampulha", -19.8582, -43.9718, 3.0),
    ("Ouro Preto", -19.8780, -43.9850, 1.6),
    ("Castelo", -19.8886, -43.9978, 1.6),
    ("Cidade Nova", -19.8861, -43.9278, 1.6),
    ("Padre Eustáquio", -19.9144, -43.9752, 1.5),
    ("Barreiro", -19.9755, -44.0185, 2.5),
    ("Venda Nova", -19.8148, -43.9588, 2.5),
]

BH_NEIGHBORHOOD_NAMES = [nb[0] for nb in BH_NEIGHBORHOOD_CENTERS] + [
    "Coração de Jesus",
    "Lagoinha",
    "Serra Verde",
]

FUNNEL_EXACT_OR_TOKEN_RULES: list[tuple[str, tuple[str, ...]]] = [
    (
        "nightlife",
        (
            "nightclub",
            "cocktail_bar",
            "dance_club",
            "lounge",
            "music_venue",
            "live_music_venue",
            "karaoke",
            "hookah_bar",
            "speakeasy",
            "pub",
            "wine_bar",
            "beer_bar",
            "beer_garden",
            "sports_bar",
            "comedy_club",
            "bar",
        ),
    ),
    (
        "gastronomia",
        (
            "restaurant",
            "steakhouse",
            "bistro",
            "gastropub",
            "burger_restaurant",
            "pizza_restaurant",
            "sushi_restaurant",
            "cafe",
            "coffee_shop",
            "bakery",
            "patisserie",
            "ice_cream_shop",
            "gelato_shop",
            "winery",
            "brewery",
            "deli",
            "tapas_bar",
            "caterer",
            "food_court",
            "churrascaria",
            "barbecue_restaurant",
            "seafood_restaurant",
            "japanese_restaurant",
            "italian_restaurant",
            "brazilian_restaurant",
            "french_restaurant",
            "mexican_restaurant",
            "dessert_shop",
            "acai_shop",
            "pastelaria",
        ),
    ),
    (
        "moda",
        (
            "clothing_store",
            "womens_clothing_store",
            "mens_clothing_store",
            "childrens_clothing_store",
            "boutique",
            "fashion_accessories_store",
            "apparel",
            "shoe_store",
            "footwear_store",
            "jewelry_store",
            "lingerie_store",
            "sportswear_store",
            "bridal_shop",
            "tailor",
            "handbag_store",
            "sunglasses_store",
            "textile",
            "leather_goods_store",
            "swimwear_store",
            "menswear",
            "womenswear",
            "department_store",
            "clothing",
            "fashion",
        ),
    ),
    (
        "estetica",
        (
            "medical_spa",
            "day_spa",
            "spa",
            "skin_care_clinic",
            "dermatologist",
            "plastic_surgeon",
            "cosmetic_dentist",
            "dentist",
            "beauty_salon",
            "hair_salon",
            "nail_salon",
            "barber_shop",
            "laser_hair_removal_service",
            "aesthetic_clinic",
            "wellness_center",
            "pilates_studio",
            "yoga_studio",
            "fitness_center",
            "gym",
            "massage_therapist",
            "massage_spa",
            "eyebrow_bar",
            "makeup_artist",
            "cosmetics_store",
            "health_and_beauty",
            "nutritionist",
            "physiotherapist",
            "beauty",
        ),
    ),
    (
        "corporativo",
        (
            "event_planning",
            "event_venue",
            "wedding_venue",
            "banquet_hall",
            "convention_center",
            "conference_center",
            "hotel",
            "resort",
            "coworking_space",
            "business_center",
            "corporate_office",
            "law_firm",
            "legal_services",
            "attorney",
            "accounting_firm",
            "real_estate_agency",
            "real_estate_agent",
            "architecture_firm",
            "architect",
            "engineering_service",
            "marketing_agency",
            "advertising_agency",
            "consulting_agency",
            "business_consulting",
            "software_company",
            "technology_company",
            "it_service_and_computer_repair",
            "hospital",
            "medical_center",
            "clinic",
            "auditorium",
            "theater",
            "cultural_center",
            "country_club",
            "private_school",
            "university",
            "college",
            "car_dealer",
            "interior_design_studio",
        ),
    ),
]

CATEGORY_LABELS_PT: dict[str, str] = {
    "restaurant": "Restaurante",
    "brazilian_restaurant": "Restaurante Brasileiro",
    "italian_restaurant": "Restaurante Italiano",
    "japanese_restaurant": "Restaurante Japonês",
    "sushi_restaurant": "Restaurante Japonês & Sushi",
    "steakhouse": "Churrascaria & Steakhouse",
    "burger_restaurant": "Hamburgueria",
    "pizza_restaurant": "Pizzaria",
    "seafood_restaurant": "Frutos do Mar",
    "french_restaurant": "Restaurante Francês",
    "mexican_restaurant": "Restaurante Mexicano",
    "bistro": "Bistrô",
    "gastropub": "Gastropub",
    "cafe": "Café & Bistrô",
    "coffee_shop": "Cafeteria",
    "bakery": "Padaria & Confeitaria",
    "patisserie": "Confeitaria",
    "ice_cream_shop": "Sorveteria & Gelateria",
    "brewery": "Cervejaria",
    "winery": "Vinícola & Adega",
    "bar": "Bar",
    "cocktail_bar": "Bar de Drinks & Coquetelaria",
    "pub": "Pub & Bar",
    "lounge": "Lounge & Nightlife",
    "nightclub": "Casa Noturna & Club",
    "wine_bar": "Wine Bar",
    "beer_bar": "Bar de Cervejas",
    "beer_garden": "Beer Garden",
    "live_music_venue": "Casa de Shows & Música ao Vivo",
    "music_venue": "Espaço de Música & Eventos",
    "clothing_store": "Loja de Roupas & Moda",
    "womens_clothing_store": "Moda Feminina",
    "mens_clothing_store": "Moda Masculina",
    "boutique": "Boutique & Moda",
    "shoe_store": "Calçados & Moda",
    "jewelry_store": "Joalheria & Acessórios",
    "lingerie_store": "Moda Íntima",
    "sportswear_store": "Moda Fitness & Esportiva",
    "bridal_shop": "Moda Noiva & Festa",
    "fashion_accessories_store": "Acessórios de Moda",
    "beauty_salon": "Salão de Beleza & Estética",
    "medical_spa": "Clínica de Estética",
    "day_spa": "Spa & Bem-Estar",
    "spa": "Spa & Wellness",
    "skin_care_clinic": "Clínica Dermatológica & Pele",
    "dermatologist": "Dermatologia",
    "plastic_surgeon": "Cirurgia Plástica & Estética",
    "dentist": "Clínica Odontológica",
    "cosmetic_dentist": "Odontologia Estética",
    "hair_salon": "Salão de Cabelo",
    "nail_salon": "Esmalteria & Unhas",
    "barber_shop": "Barbearia",
    "pilates_studio": "Estúdio de Pilates",
    "yoga_studio": "Estúdio de Yoga",
    "gym": "Academia & Fitness",
    "fitness_center": "Centro Fitness & Wellness",
    "cosmetics_store": "Cosméticos & Perfumaria",
    "event_planning": "Produção & Eventos",
    "event_venue": "Espaço de Eventos",
    "wedding_venue": "Espaço para Casamentos & Eventos",
    "banquet_hall": "Salão de Festas & Eventos",
    "convention_center": "Centro de Convenções",
    "hotel": "Hotel Corporativo",
    "coworking_space": "Coworking & Escritórios",
    "law_firm": "Escritório de Advocacia",
    "legal_services": "Serviços Jurídicos",
    "real_estate_agent": "Imobiliária & Incorporação",
    "real_estate_agency": "Imobiliária & Incorporação",
    "architecture_firm": "Escritório de Arquitetura",
    "architect": "Arquitetura & Design",
    "marketing_agency": "Agência de Marketing",
    "advertising_agency": "Agência de Publicidade",
    "software_company": "Empresa de Tecnologia",
    "medical_center": "Centro Médico",
    "clinic": "Clínica",
    "hospital": "Hospital",
    "accounting_firm": "Contabilidade & Consultoria",
}


def norm(text: str) -> str:
    s = unicodedata.normalize("NFD", text.lower())
    return "".join(ch for ch in s if unicodedata.category(ch) != "Mn")


def get_latest_release() -> str:
    with urllib.request.urlopen("https://stac.overturemaps.org/catalog.json", timeout=15) as resp:
        catalog = json.loads(resp.read().decode("utf-8"))
    latest = catalog.get("latest")
    if not latest:
        raise RuntimeError("Could not resolve latest Overture Maps release from STAC catalog.")
    return str(latest)


def matches_category_token(cat: str, rule: str) -> bool:
    if cat == rule:
        return True
    # Match whole underscore-delimited segments (prevents "spa" matching "coworking_space")
    return bool(re.search(rf"(^|_){re.escape(rule)}($|_)", cat))


def classify_funnel(primary: str | None, hierarchy: list[str] | None, basic: str | None) -> str | None:
    # Check primary & basic category first (most accurate), then hierarchy
    primary_cats = [c.lower() for c in (primary, basic) if c]
    hier_cats = [h.lower() for h in (hierarchy or []) if h]

    for cat_group in (primary_cats, hier_cats):
        for funnel_id, rules in FUNNEL_EXACT_OR_TOKEN_RULES:
            for cat in cat_group:
                for rule in rules:
                    if matches_category_token(cat, rule):
                        return funnel_id
    return None


def humanize_category(primary: str | None, basic: str | None) -> str:
    raw = (primary or basic or "estabelecimento").lower()
    if raw in CATEGORY_LABELS_PT:
        return CATEGORY_LABELS_PT[raw]
    for key, label in CATEGORY_LABELS_PT.items():
        if matches_category_token(raw, key):
            return label
    return raw.replace("_", " ").strip().title()


def format_br_phone(phones: list[str] | None) -> str:
    if not phones:
        return ""
    for raw in phones:
        if not raw:
            continue
        digits = re.sub(r"\D", "", raw)
        if digits.startswith("55") and len(digits) in (12, 13):
            digits = digits[2:]
        if len(digits) == 11:
            return f"({digits[:2]}) {digits[2:7]}-{digits[7:]}"
        if len(digits) == 10:
            return f"({digits[:2]}) {digits[2:6]}-{digits[6:]}"
        if len(digits) >= 8:
            return raw.strip()
    return ""


def pick_website(websites: list[str] | None) -> str | None:
    if not websites:
        return None
    for url in websites:
        if not url:
            continue
        clean = url.strip()
        if not clean:
            continue
        if "facebook.com" in clean.lower() or "instagram.com" in clean.lower():
            continue
        if not clean.startswith("http"):
            clean = "https://" + clean
        return clean
    return None


def pick_instagram(socials: list[str] | None, websites: list[str] | None) -> str | None:
    candidates = list(socials or []) + list(websites or [])
    for item in candidates:
        if not item:
            continue
        m = re.search(r"instagram\.com/([a-zA-Z0-9._]{2,30})", item, re.IGNORECASE)
        if m:
            handle = m.group(1).strip("/")
            if handle.lower() not in ("p", "reel", "reels", "stories", "explore", "accounts"):
                return f"@{handle}"
    return None


def pick_email(emails: list[str] | None) -> str | None:
    if not emails:
        return None
    for item in emails:
        if item and "@" in item:
            return item.strip().lower()
    return None


def approx_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    dlat = (lat2 - lat1) * 111.0
    dlon = (lon2 - lon1) * 111.0 * math.cos(math.radians(lat1))
    return math.sqrt(dlat * dlat + dlon * dlon)


def extract_address_and_neighborhood(
    addresses: list[dict] | None,
    name: str,
    lat: float,
    lon: float,
) -> tuple[str, str]:
    freeform = ""
    locality = ""
    if addresses and len(addresses) > 0:
        first = addresses[0] or {}
        freeform = (first.get("freeform") or "").strip()
        locality = (first.get("locality") or "").strip()

    city = "Nova Lima" if (norm(locality) == "nova lima" or (lat < -19.972 and lon > -43.955)) else "Belo Horizonte"
    if locality and norm(locality) in ("belo horizonte", "nova lima"):
        city = locality

    neighborhood = ""
    norm_text = norm(f"{freeform} {name} {locality}")
    for nb in BH_NEIGHBORHOOD_NAMES:
        if norm(nb) in norm_text:
            neighborhood = nb
            break

    # GPS fallback to nearest BH/Nova Lima neighborhood within its radius
    if not neighborhood:
        best_nb = ""
        best_dist = 999.0
        for nb_name, nb_lat, nb_lon, radius_km in BH_NEIGHBORHOOD_CENTERS:
            dist = approx_km(lat, lon, nb_lat, nb_lon)
            if dist <= radius_km and dist < best_dist:
                best_dist = dist
                best_nb = nb_name
        neighborhood = best_nb or ("Nova Lima" if city == "Nova Lima" else "Belo Horizonte")

    if freeform:
        if norm(city) in norm(freeform):
            address = f"{freeform}, MG" if "mg" not in norm(freeform) else freeform
        else:
            address = f"{freeform}, {neighborhood}, {city} - MG" if norm(neighborhood) not in norm(freeform) and neighborhood not in ("Belo Horizonte", "Nova Lima") else f"{freeform}, {city} - MG"
    else:
        address = f"{neighborhood}, {city} - MG"

    return address, neighborhood


def main() -> None:
    release = get_latest_release()
    print(f"[Overture BH Sync] Release: {release}")

    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2';")

    s3_path = f"s3://overturemaps-us-west-2/release/{release}/theme=places/type=place/*"
    query = f"""
        SELECT
            id,
            names.primary AS name,
            confidence,
            basic_category,
            taxonomy.primary AS tax_primary,
            taxonomy.hierarchy AS tax_hierarchy,
            phones,
            websites,
            emails,
            socials,
            addresses,
            bbox.xmin AS lon,
            bbox.ymin AS lat
        FROM read_parquet('{s3_path}')
        WHERE bbox.xmin >= {BH_BBOX['xmin']}
          AND bbox.xmax <= {BH_BBOX['xmax']}
          AND bbox.ymin >= {BH_BBOX['ymin']}
          AND bbox.ymax <= {BH_BBOX['ymax']}
          AND confidence >= {MIN_CONFIDENCE}
          AND (operating_status IS NULL OR operating_status = 'open')
          AND names.primary IS NOT NULL
          AND length(trim(names.primary)) >= 2
    """

    print("[Overture BH Sync] Querying S3 GeoParquet for BH & Nova Lima bbox...")
    rows = con.execute(query).fetchall()
    print(f"[Overture BH Sync] Raw open places fetched (confidence >= {MIN_CONFIDENCE}): {len(rows)}")

    records = []
    seen_keys: set[str] = set()
    counts_by_funnel: dict[str, int] = {
        "corporativo": 0,
        "estetica": 0,
        "nightlife": 0,
        "moda": 0,
        "gastronomia": 0,
    }

    for row in rows:
        (
            pid,
            name,
            confidence,
            basic_category,
            tax_primary,
            tax_hierarchy,
            phones,
            websites,
            emails,
            socials,
            addresses,
            lon,
            lat,
        ) = row

        funnel = classify_funnel(tax_primary, tax_hierarchy, basic_category)
        if not funnel:
            continue

        clean_name = " ".join(str(name).split()).strip()
        if len(clean_name) < 2:
            continue

        phone = format_br_phone(phones)
        website = pick_website(websites)
        instagram = pick_instagram(socials, websites)
        email = pick_email(emails)

        has_contact = bool(phone or website or instagram or email)
        if not has_contact and float(confidence or 0) < 0.85:
            continue

        lat_f = round(float(lat or -19.92), 4)
        lon_f = round(float(lon or -43.94), 4)
        address, neighborhood = extract_address_and_neighborhood(addresses, clean_name, lat_f, lon_f)

        dedupe_key = f"{norm(clean_name)}::{norm(neighborhood)}"
        if dedupe_key in seen_keys:
            continue
        seen_keys.add(dedupe_key)

        category = humanize_category(tax_primary, basic_category)
        score = (
            (3 if phone else 0)
            + (2 if website else 0)
            + (2 if instagram else 0)
            + (2 if email else 0)
            + float(confidence or 0)
        )

        rec: dict = {
            "id": pid,
            "n": clean_name,
            "c": category,
            "t": (tax_primary or basic_category or "").lower(),
            "f": funnel,
            "b": neighborhood,
            "a": address,
            "cf": round(float(confidence or 0), 2),
            "lt": lat_f,
            "ln": lon_f,
            "_s": score,
        }
        if phone:
            rec["p"] = phone
        if website:
            rec["w"] = website
        if instagram:
            rec["ig"] = instagram
        if email:
            rec["e"] = email

        records.append(rec)

    records.sort(key=lambda r: r["_s"], reverse=True)
    records = records[:MAX_RECORDS]

    for r in records:
        r.pop("_s", None)
        counts_by_funnel[r["f"]] = counts_by_funnel.get(r["f"], 0) + 1

    payload = {
        "release": release,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "region": "Belo Horizonte & Nova Lima - MG",
        "bbox": BH_BBOX,
        "total": len(records),
        "countsByFunnel": counts_by_funnel,
        "places": records,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    raw_bytes = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    with gzip.open(OUTPUT_PATH, "wb", compresslevel=9) as gz:
        gz.write(raw_bytes)

    gz_size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print(f"[Overture BH Sync] Saved {len(records)} places to {OUTPUT_PATH}")
    print(f"[Overture BH Sync] Gzip size: {gz_size_kb:.1f} KB (raw: {len(raw_bytes) / 1024:.1f} KB)")
    print(f"[Overture BH Sync] Breakdown by funnel: {json.dumps(counts_by_funnel)}")


if __name__ == "__main__":
    main()
