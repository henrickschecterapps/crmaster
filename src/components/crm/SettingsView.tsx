"use client";

import React, { useEffect, useState } from "react";
import {
  BellRing,
  Bot,
  CheckCircle2,
  Clock,
  Play,
  QrCode,
  RefreshCw,
  Save,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";
import {
  IntegrationStatus,
  Lead,
  StudioSettings,
  WhatsappQueueJob,
} from "@/types/crm";
import { cn, formatDateTimeBr } from "@/lib/utils";

interface SettingsViewProps {
  settings: StudioSettings;
  leads: Lead[];
  integrationStatus: IntegrationStatus;
  onUpdateSettings: (patch: Partial<StudioSettings>) => Promise<void>;
  onRefreshStore: () => Promise<void>;
  onNotify: (message: string, tone?: "success" | "info" | "error") => void;
}

interface CronRunReport {
  executedAt: string;
  dryRun: boolean;
  scannedEligible: number;
  triggeredCount: number;
  whatsappQueueScheduled: number;
  actions: Array<{
    leadId: string;
    companyName: string;
    contactName: string;
    step: "dia_2" | "dia_5";
    hoursSinceInteraction: number;
    emailStatus: string;
    whatsappStatus: string;
    tagAdded?: string;
  }>;
}

export function SettingsView({
  settings,
  leads,
  integrationStatus,
  onUpdateSettings,
  onRefreshStore,
  onNotify,
}: SettingsViewProps) {
  const [whatsappProvider, setWhatsappProvider] = useState<
    "evolution" | "zapi"
  >(settings.whatsappProvider || "evolution");
  const [whatsappApiUrl, setWhatsappApiUrl] = useState(
    settings.whatsappApiUrl || ""
  );
  const [whatsappApiKey, setWhatsappApiKey] = useState(
    settings.whatsappApiKey || ""
  );
  const [whatsappInstance, setWhatsappInstance] = useState(
    settings.whatsappInstance || ""
  );
  const [adminEmail, setAdminEmail] = useState(settings.adminEmail || "");
  const [pixKey, setPixKey] = useState(settings.pixKey || "");
  const [pixRecipientName, setPixRecipientName] = useState(
    settings.pixRecipientName || "Ultimo Quadro"
  );
  const [pixCity, setPixCity] = useState(settings.pixCity || "BELO HORIZONTE");

  const [saving, setSaving] = useState(false);
  const [runningCron, setRunningCron] = useState(false);
  const [cronReport, setCronReport] = useState<CronRunReport | null>(null);
  const [queueJobs, setQueueJobs] = useState<WhatsappQueueJob[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);

  useEffect(() => {
    setWhatsappProvider(settings.whatsappProvider || "evolution");
    setWhatsappApiUrl(settings.whatsappApiUrl || "");
    setWhatsappApiKey(settings.whatsappApiKey || "");
    setWhatsappInstance(settings.whatsappInstance || "");
    setAdminEmail(settings.adminEmail || "");
    setPixKey(settings.pixKey || "");
    setPixRecipientName(settings.pixRecipientName || "Ultimo Quadro");
    setPixCity(settings.pixCity || "BELO HORIZONTE");
  }, [settings]);

  const loadQueue = async () => {
    setLoadingQueue(true);
    try {
      const res = await fetch("/api/whatsapp/queue", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setQueueJobs(json.jobs || []);
      }
    } finally {
      setLoadingQueue(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const eligibleForAutomation = leads.filter(
    (l) =>
      (l.stage === "contatado" || l.stage === "proposta_aberta") &&
      l.automacaoAtiva &&
      !l.respondeu
  );

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onUpdateSettings({
        whatsappProvider,
        whatsappApiUrl: whatsappApiUrl.trim(),
        whatsappApiKey: whatsappApiKey.trim(),
        whatsappInstance: whatsappInstance.trim(),
        adminEmail: adminEmail.trim(),
        pixKey: pixKey.trim(),
        pixRecipientName: pixRecipientName.trim() || "Henrique Matos",
        pixCity: (pixCity.trim() || "BELO HORIZONTE").toUpperCase(),
      });
      onNotify("Configurações da Fase 2 salvas com sucesso!", "success");
    } finally {
      setSaving(false);
    }
  };

  const handleRunCron = async (dryRun: boolean) => {
    setRunningCron(true);
    try {
      const res = await fetch("/api/cron/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });
      const json = (await res.json()) as CronRunReport;
      if (!res.ok) {
        onNotify("Erro ao executar régua de follow-up.", "error");
        return;
      }
      setCronReport(json);
      if (!dryRun) {
        await onRefreshStore();
        await loadQueue();
      }
      onNotify(
        dryRun
          ? `Simulação concluída: ${json.triggeredCount} lead(s) elegíveis para disparo.`
          : `Régua executada: ${json.triggeredCount} follow-up(s) processados!`,
        "success"
      );
    } finally {
      setRunningCron(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
            Automação B2B &amp; Integrações · Fase 2
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            Configurações &amp; Motor de Cadência
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold",
              integrationStatus.whatsappApiLive
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-hairline)]"
            )}
          >
            <Smartphone className="h-3.5 w-3.5" />
            {integrationStatus.whatsappApiLive
              ? `WhatsApp API (${integrationStatus.whatsappProvider.toUpperCase()})`
              : "WhatsApp: Modo Seguro (1-Clique)"}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold",
              integrationStatus.resendLive
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-[var(--accent-soft)] text-[var(--accent)]"
            )}
          >
            <BellRing className="h-3.5 w-3.5" />
            {integrationStatus.resendLive
              ? "Resend + Radar Ativos"
              : "Resend em Simulação"}
          </span>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Card 1: Motor de Follow-up Automático (Cron 09:00) (12 cols) */}
        <section className="glass-panel rounded-3xl p-6 xl:col-span-12 space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Bot className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-bold text-[var(--text-primary)]">
                  Motor de Follow-up Automático (Cron diário às 09:00 BRT)
                </h2>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  Varre leads em <strong>Contatado</strong> e{" "}
                  <strong>Proposta Aberta</strong> com{" "}
                  <code className="font-mono-num text-[var(--accent)]">
                    automacao_ativa = true
                  </code>
                  : Dia 2 (Follow-up 1) e Dia 5 (Follow-up 2 + tag{" "}
                  <em>Último Toque</em>). Desliga automaticamente em{" "}
                  <em>Sinal Pago</em>, <em>Fechado</em> ou{" "}
                  <em>Respondeu</em>.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleRunCron(true)}
                disabled={runningCron}
                className="btn-ghost inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
                {runningCron ? "Analisando..." : "Testar Régua Agora"}
              </button>
              <button
                type="button"
                onClick={() => handleRunCron(false)}
                disabled={runningCron}
                className="btn-accent inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" />
                {runningCron ? "Executando..." : "Executar Disparos Agora"}
              </button>
            </div>
          </div>

          {/* Quick KPI strip */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-[var(--bg-subtle)]/75 p-4">
              <p className="text-[11px] text-[var(--text-muted)]">
                Leads monitorados na régua
              </p>
              <p className="mt-1 font-mono-num text-2xl font-bold text-[var(--text-primary)]">
                {eligibleForAutomation.length}
              </p>
            </div>
            <div className="rounded-2xl bg-[var(--bg-subtle)]/75 p-4">
              <p className="text-[11px] text-[var(--text-muted)]">
                Endpoint Cron (Vercel)
              </p>
              <p className="mt-1 font-mono-num text-xs font-semibold text-[var(--accent)]">
                GET /api/cron/followup · 0 12 * * *
              </p>
            </div>
            <div className="rounded-2xl bg-[var(--bg-subtle)]/75 p-4">
              <p className="text-[11px] text-[var(--text-muted)]">
                Proteção Anti-Spam / Trava
              </p>
              <p className="mt-1 text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" />
                Desliga ao Responder / Pagar
              </p>
            </div>
          </div>

          {/* Execution Report */}
          {cronReport && (
            <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/55 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-[var(--text-primary)]">
                  Resultado da{" "}
                  {cronReport.dryRun ? "Simulação (Dry-Run)" : "Execução Real"}{" "}
                  — {cronReport.triggeredCount} disparo(s) de{" "}
                  {cronReport.scannedEligible} elegíveis
                </span>
                <span className="font-mono-num text-[11px] text-[var(--text-muted)]">
                  {formatDateTimeBr(cronReport.executedAt)}
                </span>
              </div>

              {cronReport.actions.length === 0 ? (
                <p className="text-xs text-[var(--text-secondary)]">
                  Nenhum lead atingiu os gatilhos pendentes de Dia 2 (+48h) ou
                  Dia 5 (+120h) neste momento.
                </p>
              ) : (
                <div className="space-y-2">
                  {cronReport.actions.map((act) => (
                    <div
                      key={act.leadId}
                      className="flex flex-col gap-2 rounded-xl bg-[var(--bg-surface-solid)] border border-[var(--border-hairline)] px-3.5 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-semibold text-[var(--text-primary)]">
                          {act.companyName}{" "}
                          <span className="font-normal text-[var(--text-muted)]">
                            ({act.contactName})
                          </span>
                        </p>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          {act.step === "dia_5"
                            ? "Gatilho Dia 5 (Escassez + Tag Último Toque)"
                            : "Gatilho Dia 2 (Follow-up 1)"}{" "}
                          · {act.hoursSinceInteraction}h sem resposta
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
                        <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 text-sky-400">
                          E-mail: {act.emailStatus}
                        </span>
                        <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-emerald-400">
                          WA: {act.whatsappStatus}
                        </span>
                        {act.tagAdded && (
                          <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-rose-400">
                            + {act.tagAdded}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Card 2: Settings Form — WhatsApp API + Radar Email + Static Pix (7 cols) */}
        <form
          onSubmit={handleSaveSettings}
          className="glass-panel rounded-3xl p-6 xl:col-span-7 space-y-6"
        >
          {/* Evolution API / Z-API */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-emerald-400" />
                <h2 className="text-sm font-bold text-[var(--text-primary)]">
                  Integração WhatsApp Automático (Evolution API / Z-API)
                </h2>
              </div>
              <div className="flex rounded-xl bg-[var(--bg-subtle)] p-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setWhatsappProvider("evolution")}
                  className={cn(
                    "rounded-lg px-2.5 py-1 font-semibold cursor-pointer transition-colors",
                    whatsappProvider === "evolution"
                      ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                      : "text-[var(--text-secondary)]"
                  )}
                >
                  Evolution API
                </button>
                <button
                  type="button"
                  onClick={() => setWhatsappProvider("zapi")}
                  className={cn(
                    "rounded-lg px-2.5 py-1 font-semibold cursor-pointer transition-colors",
                    whatsappProvider === "zapi"
                      ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                      : "text-[var(--text-secondary)]"
                  )}
                >
                  Z-API
                </button>
              </div>
            </div>

            <p className="text-xs text-[var(--text-secondary)]">
              Deixe em branco para manter o{" "}
              <strong>Modo Seguro (1-Clique via wa.me)</strong> da Fase 1 como
              padrão. Quando preenchido, habilita alertas do Radar no seu
              WhatsApp e a fila anti-ban (intervalo aleatório de 3 a 6 min).
            </p>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                  WHATSAPP_API_URL
                </label>
                <input
                  type="url"
                  value={whatsappApiUrl}
                  onChange={(e) => setWhatsappApiUrl(e.target.value)}
                  placeholder={
                    whatsappProvider === "zapi"
                      ? "https://api.z-api.io"
                      : "https://sua-evolution-api.com.br"
                  }
                  className="input-field w-full rounded-xl px-3.5 py-2.5 font-mono-num text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                  WHATSAPP_INSTANCE
                </label>
                <input
                  type="text"
                  value={whatsappInstance}
                  onChange={(e) => setWhatsappInstance(e.target.value)}
                  placeholder="henrique-studio-bh"
                  className="input-field w-full rounded-xl px-3.5 py-2.5 font-mono-num text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                  WHATSAPP_API_KEY
                </label>
                <input
                  type="password"
                  value={whatsappApiKey}
                  onChange={(e) => setWhatsappApiKey(e.target.value)}
                  placeholder="Sua API Key / Token"
                  className="input-field w-full rounded-xl px-3.5 py-2.5 font-mono-num text-xs"
                />
              </div>
            </div>
          </div>

          {/* Radar Admin Email + Static Pix BR Code */}
          <div className="space-y-4 border-t border-[var(--border-hairline)] pt-5">
            <div className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-[var(--accent)]" />
              <h2 className="text-sm font-bold text-[var(--text-primary)]">
                Radar em Tempo Real &amp; Pix Estático (Sinal 50%)
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                  ADMIN_EMAIL (Alertas de Radar)
                </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="henrickschecter@gmail.com"
                  className="input-field w-full rounded-xl px-3.5 py-2.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                  Chave Pix (NEXT_PUBLIC_PIX_KEY)
                </label>
                <input
                  type="text"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  placeholder="E-mail, CPF/CNPJ, telefone ou aleatória"
                  className="input-field w-full rounded-xl px-3.5 py-2.5 font-mono-num text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                  Nome no Pix (BR Code)
                </label>
                <input
                  type="text"
                  value={pixRecipientName}
                  onChange={(e) => setPixRecipientName(e.target.value)}
                  placeholder="Henrique Matos"
                  className="input-field w-full rounded-xl px-3.5 py-2.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                  Cidade no Pix
                </label>
                <input
                  type="text"
                  value={pixCity}
                  onChange={(e) => setPixCity(e.target.value)}
                  placeholder="BELO HORIZONTE"
                  className="input-field w-full rounded-xl px-3.5 py-2.5 font-mono-num text-xs"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={saving}
              className="btn-accent inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-xs font-bold disabled:opacity-60 cursor-pointer"
            >
              <Save className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar Configurações"}
            </button>
          </div>
        </form>

        {/* Card 3: Anti-Ban WhatsApp Queue Monitor (5 cols) */}
        <section className="glass-panel rounded-3xl p-6 xl:col-span-5 flex flex-col space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[var(--accent)]" />
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)]">
                  Fila Anti-Ban de WhatsApp
                </h2>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Intervalos aleatórios de 3 a 6 minutos entre envios em lote.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={loadQueue}
              className="btn-ghost flex h-8 w-8 items-center justify-center rounded-xl cursor-pointer"
              title="Atualizar fila"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", loadingQueue && "animate-spin")}
              />
            </button>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[380px] pr-1">
            {queueJobs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border-hairline)] p-6 text-center">
                <CheckCircle2 className="mx-auto h-6 w-6 text-[var(--text-muted)]" />
                <p className="mt-2 text-xs font-semibold text-[var(--text-secondary)]">
                  Nenhum disparo na fila no momento
                </p>
                <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                  Use o Disparador em Lote ou a Régua Automática para enfileirar
                  mensagens com espaçamento seguro de 3 a 6 min.
                </p>
              </div>
            ) : (
              queueJobs.map((job) => (
                <div
                  key={job.id}
                  className="rounded-2xl bg-[var(--bg-subtle)]/70 border border-[var(--border-hairline)] p-3.5 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[var(--text-primary)] truncate">
                      {job.companyName}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        job.status === "enviado" &&
                          "bg-emerald-500/15 text-emerald-400",
                        job.status === "pendente" &&
                          "bg-amber-500/15 text-amber-400",
                        job.status === "enviando" &&
                          "bg-sky-500/15 text-sky-400",
                        job.status === "simulado" &&
                          "bg-[var(--accent-soft)] text-[var(--accent)]",
                        job.status === "erro" &&
                          "bg-rose-500/15 text-rose-400"
                      )}
                    >
                      {job.status}
                    </span>
                  </div>
                  <p className="font-mono-num text-[11px] text-[var(--text-secondary)]">
                    {job.phone} · Previsto:{" "}
                    {formatDateTimeBr(job.scheduledFor)}
                  </p>
                  {job.error && (
                    <p className="text-[11px] text-rose-400">{job.error}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
