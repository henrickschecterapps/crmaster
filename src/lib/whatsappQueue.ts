import { StudioSettings, WhatsappQueueJob } from "@/types/crm";
import { formatWhatsappNumber, generateId } from "@/lib/utils";

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

    // Evolution API v1/v2 standard endpoint
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

/**
 * Anti-ban random delay between 3 and 6 minutes (180s to 360s)
 */
export function getRandomAntiBanDelayMs(): number {
  const minMs = 3 * 60 * 1000; // 180_000 ms (3 min)
  const maxMs = 6 * 60 * 1000; // 360_000 ms (6 min)
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

// Persistent global queue across Next.js route hot-reloads in dev
const globalQueueState = globalThis as unknown as {
  __crmasterWhatsappQueue?: WhatsappQueueJob[];
  __crmasterWhatsappProcessing?: boolean;
};

if (!globalQueueState.__crmasterWhatsappQueue) {
  globalQueueState.__crmasterWhatsappQueue = [];
}

export function getWhatsappQueueJobs(): WhatsappQueueJob[] {
  return [...(globalQueueState.__crmasterWhatsappQueue ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export interface EnqueueWhatsappInput {
  leadId: string;
  companyName: string;
  phone: string;
  message: string;
}

/**
 * Schedules a batch of WhatsApp messages with 3–6 minute randomized anti-ban intervals.
 * Executes in background when running on a stateful Node runtime; returns schedule immediately.
 */
export function enqueueWhatsappBatch(params: {
  items: EnqueueWhatsappInput[];
  config: WhatsappApiConfig | null;
  onJobCompleted?: (job: WhatsappQueueJob) => Promise<void>;
}): WhatsappQueueJob[] {
  const queue = globalQueueState.__crmasterWhatsappQueue!;
  const createdJobs: WhatsappQueueJob[] = [];

  let cumulativeDelayMs = 0;

  for (let i = 0; i < params.items.length; i++) {
    const item = params.items[i];
    // First message starts shortly (or after 3–6 min if queue already has pending jobs)
    const hasActivePending = queue.some(
      (j) => j.status === "pendente" || j.status === "enviando"
    );
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

    queue.push(job);
    createdJobs.push(job);

    // Trim history to last 50 jobs
    if (queue.length > 50) {
      queue.splice(0, queue.length - 50);
    }

    const capturedConfig = params.config;
    const capturedCallback = params.onJobCompleted;

    setTimeout(async () => {
      job.status = "enviando";
      if (!capturedConfig) {
        job.status = "simulado";
        job.sentAt = new Date().toISOString();
      } else {
        const res = await sendWhatsappViaApi({
          phone: job.phone,
          message: job.message,
          config: capturedConfig,
        });
        if (res.ok) {
          job.status = "enviado";
          job.sentAt = new Date().toISOString();
        } else {
          job.status = "erro";
          job.error = res.error || "Falha no disparo";
        }
      }
      if (capturedCallback) {
        try {
          await capturedCallback(job);
        } catch {
          // Ignore callback error
        }
      }
    }, cumulativeDelayMs);
  }

  return createdJobs;
}
