import { StudioSettings, WhatsappQueueJob } from "@/types/crm";
import { formatWhatsappNumber, generateId } from "@/lib/utils";
import {
  getPersistedWhatsappQueue,
  saveWhatsappQueueJob,
  updateLead,
} from "@/lib/repository";

export interface WhatsappApiConfig {
  provider: "evolution" | "zapi";
  apiUrl: string;
  apiKey: string;
  instance: string;
}

export function resolveWhatsappConfig(
  settings?: Partial<StudioSettings>
): WhatsappApiConfig | null {
  const apiUrl = (
    settings?.whatsappApiUrl ||
    process.env.WHATSAPP_API_URL ||
    ""
  )
    .trim()
    .replace(/\/+$/, "");
  const apiKey = (
    settings?.whatsappApiKey ||
    process.env.WHATSAPP_API_KEY ||
    ""
  ).trim();
  const instance = (
    settings?.whatsappInstance ||
    process.env.WHATSAPP_INSTANCE ||
    ""
  ).trim();
  const provider: "evolution" | "zapi" =
    settings?.whatsappProvider === "zapi" ? "zapi" : "evolution";

  if (!apiUrl || !apiKey || !instance) return null;
  return { provider, apiUrl, apiKey, instance };
}

export async function sendWhatsappViaApi(params: {
  phone: string;
  message: string;
  config: WhatsappApiConfig | null;
}): Promise<{ ok: boolean; mode: "live" | "unconfigured"; error?: string }> {
  if (!params.config) {
    return { ok: false, mode: "unconfigured" };
  }

  const number = formatWhatsappNumber(params.phone);
  if (!number) {
    return { ok: false, mode: "live", error: "Número de WhatsApp inválido." };
  }

  try {
    const { provider, apiUrl, apiKey, instance } = params.config;

    if (provider === "zapi") {
      const endpoint = `${apiUrl}/instances/${encodeURIComponent(
        instance
      )}/token/${encodeURIComponent(apiKey)}/send-text`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Client-Token": apiKey,
        },
        body: JSON.stringify({
          phone: number,
          message: params.message,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return {
          ok: false,
          mode: "live",
          error: `Z-API retornou HTTP ${res.status}: ${text.slice(0, 120)}`,
        };
      }

      return { ok: true, mode: "live" };
    }

    // Evolution API v1/v2 endpoint
    const endpoint = `${apiUrl}/message/sendText/${encodeURIComponent(
      instance
    )}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify({
        number,
        text: params.message,
        textMessage: { text: params.message },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        mode: "live",
        error: `Evolution API retornou HTTP ${res.status}: ${text.slice(0, 120)}`,
      };
    }

    return { ok: true, mode: "live" };
  } catch (err) {
    return {
      ok: false,
      mode: "live",
      error: err instanceof Error ? err.message : "Erro de rede WhatsApp API.",
    };
  }
}

// Anti-ban randomized delay between 3 and 6 minutes (180s to 360s)
export function getRandomAntiBanDelayMs(): number {
  const minMs = 3 * 60 * 1000;
  const maxMs = 6 * 60 * 1000;
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

export async function getWhatsappQueueJobs(): Promise<WhatsappQueueJob[]> {
  return getPersistedWhatsappQueue();
}

export interface EnqueueWhatsappInput {
  leadId: string;
  companyName: string;
  phone: string;
  message: string;
}

async function executeSingleJob(
  job: WhatsappQueueJob,
  config: WhatsappApiConfig | null
): Promise<WhatsappQueueJob> {
  const sending: WhatsappQueueJob = { ...job, status: "enviando" };
  await saveWhatsappQueueJob(sending);

  let finished: WhatsappQueueJob;
  if (!config) {
    finished = {
      ...sending,
      status: "simulado",
      sentAt: new Date().toISOString(),
    };
  } else {
    const res = await sendWhatsappViaApi({
      phone: job.phone,
      message: job.message,
      config,
    });
    finished = res.ok
      ? { ...sending, status: "enviado", sentAt: new Date().toISOString() }
      : {
          ...sending,
          status: "erro",
          error: res.error || "Falha no disparo",
        };
  }

  await saveWhatsappQueueJob(finished);

  await updateLead(
    finished.leadId,
    {},
    {
      type: "whatsapp",
      title:
        finished.status === "enviado"
          ? "WhatsApp automático entregue (Fila Anti-Ban)"
          : finished.status === "simulado"
          ? "WhatsApp automático simulado (API não configurada)"
          : "Falha no disparo automático de WhatsApp",
      description: finished.error
        ? finished.error
        : `Disparo processado com intervalo seguro (${Math.round(
            finished.delaySeconds / 60
          )} min).`,
    },
    false
  );

  return finished;
}

/**
 * Persists a batch of WhatsApp jobs into Firestore/local store with randomized 3-6 min intervals.
 * Executes the first immediately when the queue is idle; subsequent jobs are processed by cron or manual trigger.
 */
export async function enqueueWhatsappBatch(params: {
  items: EnqueueWhatsappInput[];
  config: WhatsappApiConfig | null;
}): Promise<WhatsappQueueJob[]> {
  const existing = await getPersistedWhatsappQueue();
  const hasActivePending = existing.some(
    (j) => j.status === "pendente" || j.status === "enviando"
  );

  const createdJobs: WhatsappQueueJob[] = [];
  let cumulativeDelayMs = 0;

  for (let i = 0; i < params.items.length; i++) {
    const item = params.items[i];
    const stepDelayMs =
      i === 0 && !hasActivePending ? 0 : getRandomAntiBanDelayMs();
    cumulativeDelayMs += stepDelayMs;

    const now = Date.now();
    const job: WhatsappQueueJob = {
      id: generateId("waq"),
      leadId: item.leadId,
      companyName: item.companyName,
      phone: item.phone,
      message: item.message,
      status: "pendente",
      delaySeconds: Math.round(stepDelayMs / 1000),
      scheduledFor: new Date(now + cumulativeDelayMs).toISOString(),
      createdAt: new Date(now).toISOString(),
    };

    await saveWhatsappQueueJob(job);
    createdJobs.push(job);
  }

  // Execute the first job right away if its scheduled time is now (delay 0)
  if (createdJobs[0] && createdJobs[0].delaySeconds === 0) {
    createdJobs[0] = await executeSingleJob(createdJobs[0], params.config);
  }

  return createdJobs;
}

/**
 * Processes all pending persisted jobs whose scheduledFor timestamp has arrived (or all pending when force=true).
 */
export async function processDueWhatsappQueue(params: {
  config: WhatsappApiConfig | null;
  forceAll?: boolean;
}): Promise<{ processed: WhatsappQueueJob[] }> {
  const jobs = await getPersistedWhatsappQueue();
  const nowMs = Date.now();

  const due = jobs
    .filter((j) => {
      if (j.status !== "pendente") return false;
      if (params.forceAll) return true;
      return new Date(j.scheduledFor).getTime() <= nowMs;
    })
    .sort(
      (a, b) =>
        new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
    );

  const processed: WhatsappQueueJob[] = [];
  for (const job of due) {
    const done = await executeSingleJob(job, params.config);
    processed.push(done);
  }

  return { processed };
}
