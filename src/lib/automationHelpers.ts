import {
  AutomationSettings,
  DEFAULT_AUTOMATION_SETTINGS,
  FunnelId,
  Lead,
  StudioSettings,
} from "@/types/crm";

export function getPublicAppUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv && !fromEnv.includes("localhost")) {
    return fromEnv.replace(/\/+$/, "");
  }
  const prodHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prodHost) {
    return `https://${prodHost.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  }
  const vercelHost = process.env.VERCEL_URL?.trim();
  if (vercelHost) {
    return `https://${vercelHost.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  }
  return fromEnv?.replace(/\/+$/, "") || "https://crmaster-alpha.vercel.app";
}

export function getSaoPauloParts(date: Date = new Date()): {
  ymd: string;
  hour: number;
  minute: number;
  weekday: number; // 0 = Sun ... 6 = Sat
} {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "0";
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    ymd: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    weekday: weekdayMap[get("weekday")] ?? 1,
  };
}

export function isWithinBusinessHours(
  cfg: AutomationSettings = DEFAULT_AUTOMATION_SETTINGS,
  now: Date = new Date()
): boolean {
  if (!cfg.businessHoursOnly) return true;
  const sp = getSaoPauloParts(now);
  // Monday (1) through Friday (5), and optional Saturday morning if end >= 12
  if (sp.weekday === 0) return false;
  if (sp.weekday === 6 && sp.hour >= 13) return false;
  return sp.hour >= cfg.businessHourStart && sp.hour < cfg.businessHourEnd;
}

export function diffDaysYmd(fromYmd: string, toYmd: string): number {
  const a = new Date(`${fromYmd}T12:00:00Z`).getTime();
  const b = new Date(`${toYmd}T12:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 9999;
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

export function getVerticalContextHook(funnel: FunnelId): string {
  switch (funnel) {
    case "gastronomia":
      return "fotos dos pratos com luz natural controlada (Instagram + iFood) e vídeos curtos de preparo";
    case "moda":
      return "lookbook, provador e vídeos verticais com entrega ágil para os lançamentos da coleção";
    case "estetica":
      return "retratos de pele limpa e vídeos curtos que passam confiança real para novos pacientes";
    case "nightlife":
      return "cobertura noturna de atmosfera real e aftermovie entregue enquanto o público ainda repercute a noite";
    case "corporativo":
    default:
      return "cobertura fotográfica e audiovisual com prévia selecionada já na manhã seguinte para RH e marca";
  }
}

export function buildContextualFollowupMessage(params: {
  lead: Lead;
  step: "dia_2" | "dia_5";
  portalUrl: string;
  nextAvailableDate: string;
}): { subject: string; body: string } {
  const { lead, step, portalUrl, nextAvailableDate } = params;
  const hook = getVerticalContextHook(lead.funnel);
  const firstName = lead.contactName?.split(" ")[0] || lead.contactName || "tudo bem";

  if (step === "dia_5") {
    return {
      subject: `Agenda perto de ${nextAvailableDate} | ${lead.companyName} | ÚLTIMO QUADRO`,
      body: `Olá ${firstName}, tudo bem?

Estamos fechando a escala de produções da ÚLTIMO QUADRO em Belo Horizonte e Nova Lima para o período de ${nextAvailableDate} e queria confirmar se ainda faz sentido manter a ${lead.companyName} no nosso radar para esta janela.

Se quiser revisar os formatos ou reservar a data com calma, o portal exclusivo continua aberto aqui:
${portalUrl}

Caso prefira retomar em um próximo momento, sem problema algum. Seguimos à disposição por aqui.`,
    };
  }

  // Dia 2 contextual: diferente se o cliente já recebeu/abriu proposta vs primeiro contato
  if (lead.stage === "proposta_aberta" || lead.visualizacoesProposta > 0) {
    return {
      subject: `Sobre o projeto da ${lead.companyName} | ÚLTIMO QUADRO`,
      body: `Olá ${firstName}, tudo bem?

Aqui é da equipe da ÚLTIMO QUADRO. Passando para saber se ficou alguma dúvida no material que preparamos para a ${lead.companyName} (${hook}).

Se quiser ajustar o formato, adaptar o escopo ou encaixar em uma data específica, montamos sob medida sem burocracia.

Deixo o acesso direto ao portal aqui para facilitar:
${portalUrl}`,
    };
  }

  return {
    subject: `Produção audiovisual para a ${lead.companyName} | ÚLTIMO QUADRO`,
    body: `Olá ${firstName}, tudo bem?

Sei que a semana aí na ${lead.companyName} costuma ser corrida. Aqui é da ÚLTIMO QUADRO e reunimos neste link os formatos que trabalhamos aqui em BH e Nova Lima para ${hook}:
${portalUrl}

Se fizer sentido para as próximas semanas, podemos conversar brevemente para entender o que vocês precisam.`,
  };
}

export function buildBrandedEmailHtml(params: {
  kicker: string;
  headline: string;
  bodyText: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const escape = (s: string) =>
    s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  const paragraphs = params.bodyText
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;color:#d4d4d8;font-size:14px;line-height:1.65;">${escape(
          p
        ).replaceAll("\n", "<br/>")}</p>`
    )
    .join("");

  const ctaHtml =
    params.ctaLabel && params.ctaUrl
      ? `<div style="margin-top:24px;"><a href="${escape(params.ctaUrl)}" style="display:inline-block;background:#B54512;color:#F5F5F5;text-decoration:none;font-weight:700;font-size:13px;padding:12px 22px;border-radius:8px;">${escape(params.ctaLabel)}</a></div>`
      : "";

  return `
    <div style="background:#0C0C0C;padding:32px 16px;font-family:'Montserrat',Arial,sans-serif;">
      <div style="max-width:580px;margin:0 auto;background:#141414;border:1px solid rgba(245,245,245,0.1);border-radius:12px;padding:28px;">
        <div style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#EA7845;margin-bottom:8px;font-weight:800;">
          ${escape(params.kicker)}
        </div>
        <h2 style="margin:0 0 18px;color:#F5F5F5;font-size:19px;font-weight:700;line-height:1.3;">
          ${escape(params.headline)}
        </h2>
        ${paragraphs}
        ${ctaHtml}
        <hr style="border:none;border-top:1px solid rgba(245,245,245,0.08);margin:24px 0 14px;" />
        <p style="margin:0;color:#969696;font-size:11px;">
          ÚLTIMO QUADRO · A história termina. A imagem fica. · Belo Horizonte e Nova Lima, MG · (31) 98399-7195
        </p>
      </div>
    </div>
  `;
}

export async function emitOutgoingWebhook(
  settings: Partial<StudioSettings> | null | undefined,
  event:
    | "lead.created"
    | "proposal.viewed"
    | "proposal.approved"
    | "payment.reported"
    | "meeting.requested"
    | "deliverable.reviewed"
    | "whatsapp.replied",
  payload: Record<string, unknown>
): Promise<boolean> {
  const url = settings?.automation?.outgoingWebhookUrl?.trim();
  if (!url || !/^https?:\/\//i.test(url)) return false;

  const secret = settings?.automation?.outgoingWebhookSecret?.trim();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-UQ-Event": event,
        ...(secret ? { "X-UQ-Secret": secret } : {}),
      },
      body: JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        studio: settings?.studioName || "ÚLTIMO QUADRO",
        payload,
      }),
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
