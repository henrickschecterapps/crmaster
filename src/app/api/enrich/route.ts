import { NextRequest, NextResponse } from "next/server";
import { getLeadById, updateLead } from "@/lib/repository";
import { requireAdminApiAuth } from "@/lib/apiGuard";

export const dynamic = "force-dynamic";

const PRIORITY_EMAIL_PREFIXES = [
  "rh@",
  "gentecultura@",
  "marketing@",
  "eventos@",
  "comercial@",
  "contato@",
  "atendimento@",
];

const IGNORED_EMAIL_PATTERNS = [
  /\.png$/i,
  /\.jpg$/i,
  /\.jpeg$/i,
  /\.svg$/i,
  /\.webp$/i,
  /\.gif$/i,
  /example\.com/i,
  /wixpress\.com/i,
  /sentry\.io/i,
  /yourdomain/i,
];

const IGNORED_IG_HANDLES = new Set([
  "p",
  "reel",
  "reels",
  "explore",
  "stories",
  "accounts",
  "about",
  "developer",
  "legal",
  "sharer",
  "share",
  "tv",
]);

function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    h === "localhost" ||
    h === "::1" ||
    h === "0.0.0.0" ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    h.endsWith(".localhost")
  ) {
    return true;
  }
  // Block IPv4 private, loopback, link-local (AWS/GCP metadata 169.254.169.254)
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  // Block IPv6 private/link-local
  if (h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) {
    return true;
  }
  return false;
}

function normalizeWebsiteUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProto = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const u = new URL(withProto);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (isBlockedHostname(u.hostname)) return null;
    if (!u.hostname.includes(".")) return null;
    return u.origin;
  } catch {
    return null;
  }
}

async function safeFetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; UltimoQuadroBot/1.0; +https://ultimo-quadro.vercel.app)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) return "";
    const text = await res.text();
    return text.slice(0, 250_000);
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

function extractContactsFromHtml(html: string): {
  emails: string[];
  instagrams: string[];
} {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const rawEmails = html.match(emailRegex) ?? [];

  const uniqueEmails = Array.from(
    new Set(
      rawEmails
        .map((e) => e.toLowerCase().trim())
        .filter((e) => !IGNORED_EMAIL_PATTERNS.some((rx) => rx.test(e)))
    )
  );

  // Prioritize corporate outreach emails (rh@, marketing@, eventos@, contato@)
  uniqueEmails.sort((a, b) => {
    const idxA = PRIORITY_EMAIL_PREFIXES.findIndex((p) => a.startsWith(p));
    const idxB = PRIORITY_EMAIL_PREFIXES.findIndex((p) => b.startsWith(p));
    const scoreA = idxA === -1 ? 99 : idxA;
    const scoreB = idxB === -1 ? 99 : idxB;
    return scoreA - scoreB;
  });

  const igUrlRegex =
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9._]{2,30})/gi;
  const igMatches: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = igUrlRegex.exec(html)) !== null) {
    const handle = match[1].replace(/\/$/, "").toLowerCase();
    if (!IGNORED_IG_HANDLES.has(handle) && !handle.includes(".")) {
      igMatches.push(`@${handle}`);
    } else if (!IGNORED_IG_HANDLES.has(handle) && !handle.endsWith(".php")) {
      igMatches.push(`@${handle}`);
    }
  }

  return {
    emails: uniqueEmails.slice(0, 5),
    instagrams: Array.from(new Set(igMatches)).slice(0, 3),
  };
}

export async function POST(req: NextRequest) {
  const authErr = await requireAdminApiAuth(req);
  if (authErr) return authErr;

  try {
    const body = (await req.json()) as {
      leadId?: string;
      website?: string;
      url?: string;
      companyName?: string;
    };

    let targetWebsite = body.website || body.url || "";
    const lead = body.leadId ? await getLeadById(body.leadId) : null;
    if (!targetWebsite && lead?.website) {
      targetWebsite = lead.website;
    }

    const origin = normalizeWebsiteUrl(targetWebsite);
    if (!origin) {
      return NextResponse.json(
        { error: "Informe um site válido (ex: https://empresa.com.br)." },
        { status: 400 }
      );
    }

    // Fetch homepage and /contato (plus /fale-conosco) in parallel
    const [homeHtml, contactHtml, faleHtml] = await Promise.all([
      safeFetchHtml(origin),
      safeFetchHtml(`${origin}/contato`),
      safeFetchHtml(`${origin}/fale-conosco`),
    ]);

    const combinedHtml = `${homeHtml}\n${contactHtml}\n${faleHtml}`;
    const pagesFetched = [homeHtml, contactHtml, faleHtml].filter(Boolean).length;

    let { emails, instagrams } = extractContactsFromHtml(combinedHtml);
    let mode: "live" | "inferred" = "live";

    // Helpful graceful fallback for fictional/offline demo sites from BH demo mode
    if (pagesFetched === 0) {
      mode = "inferred";
      const domain = new URL(origin).hostname.replace(/^www\./, "");
      const handleBase = domain
        .split(".")[0]
        .replace(/[^a-z0-9]/gi, "")
        .toLowerCase();
      emails = [`contato@${domain}`, `eventos@${domain}`];
      instagrams = handleBase ? [`@${handleBase}`] : [];
    }

    const bestEmail = emails[0] || "";
    const bestInstagram = instagrams[0] || "";

    let updatedLead = lead;
    if (lead && (bestEmail || bestInstagram)) {
      updatedLead = await updateLead(
        lead.id,
        {
          email: lead.email || bestEmail,
          instagram: lead.instagram || bestInstagram,
        },
        {
          type: "enriquecimento",
          title:
            mode === "live"
              ? "Enriquecimento de site concluído"
              : "Enriquecimento de site (sugestão domínio demo)",
          description: `Site analisado: ${origin}. ${
            bestEmail ? `E-mail: ${bestEmail}` : "Sem e-mail público"
          } | ${bestInstagram ? `Instagram: ${bestInstagram}` : "Sem Instagram encontrado"}.`,
        },
        false
      );
    }

    return NextResponse.json({
      mode,
      origin,
      pagesFetched,
      bestEmail,
      bestInstagram,
      emails,
      instagrams,
      lead: updatedLead,
    });
  } catch {
    return NextResponse.json(
      { error: "Erro ao enriquecer informações do site." },
      { status: 500 }
    );
  }
}
