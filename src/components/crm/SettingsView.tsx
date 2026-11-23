"use client";

import React, { useEffect, useState } from "react";
import {
  Activity,
  Bell,
  BellRing,
  Bot,
  CheckCircle2,
  Clock,
  Database,
  Download,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Palette,
  Play,
  QrCode,
  RefreshCw,
  Save,
  ShieldCheck,
  Smartphone,
  Upload,
} from "lucide-react";
import { STUDIO_SKINS, useTheme } from "@/components/ThemeProvider";
import {
  CronExecutionLog,
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
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [saving, setSaving] = useState(false);
  const [runningCron, setRunningCron] = useState(false);
  const [cronReport, setCronReport] = useState<CronRunReport | null>(null);
  const [cronHistory, setCronHistory] = useState<CronExecutionLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [queueJobs, setQueueJobs] = useState<WhatsappQueueJob[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [processingQueue, setProcessingQueue] = useState(false);
  const { skin, density, setSkin, setDensity } = useTheme();
  const [pushDevicesCount, setPushDevicesCount] = useState(0);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  useEffect(() => {
    fetch("/api/push/subscribe", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json && typeof json.devicesCount === "number") {
          setPushDevicesCount(json.devicesCount);
        }
      })
      .catch(() => {});

    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setPushSubscribed(Boolean(sub)))
        .catch(() => {});
    }
  }, []);

  const handleTogglePush = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      onNotify(
        "Seu navegador não suporta Web Push (no iPhone, instale o App na Tela de Início primeiro).",
        "error"
      );
      return;
    }
    setPushLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: existing.endpoint }),
        });
        await existing.unsubscribe();
        setPushSubscribed(false);
        setPushDevicesCount((c) => Math.max(0, c - 1));
        onNotify("Notificações Push desativadas neste dispositivo.", "info");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        onNotify("Permissão de notificação negada pelo navegador.", "error");
        return;
      }

      const keyRes = await fetch("/api/push/subscribe", { cache: "no-store" });
      const keyJson = await keyRes.json();
      if (!keyJson?.publicKey) {
        onNotify("Não foi possível obter a chave VAPID.", "error");
        return;
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyJson.publicKey),
      });

      const subJson = subscription.toJSON();
      const saveRes = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subJson),
      });
      if (saveRes.ok) {
        const saved = await saveRes.json();
        setPushSubscribed(true);
        setPushDevicesCount(saved.devicesCount ?? 1);
        onNotify(
          "Notificações Push ativadas neste dispositivo!",
          "success"
        );
      }
    } catch {
      onNotify("Falha ao configurar notificações Push.", "error");
    } finally {
      setPushLoading(false);
    }
  };

  const handleTestPush = async () => {
    setPushLoading(true);
    try {
      const res = await fetch("/api/push/subscribe", { method: "PUT" });
      const json = await res.json();
      if (res.ok && json.sent > 0) {
        onNotify(
          `Notificação de teste enviada para ${json.sent} dispositivo(s).`,
          "success"
        );
      } else {
        onNotify(
          "Nenhum dispositivo ativo para receber Push. Ative primeiro acima.",
          "info"
        );
      }
    } finally {
      setPushLoading(false);
    }
  };

  const [restoringBackup, setRestoringBackup] = useState(false);

  const handleRestoreBackupFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoringBackup(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const json = await res.json();
      if (!res.ok) {
        onNotify(json.error || "Arquivo de backup inválido.", "error");
        return;
      }
      await onRefreshStore();
      onNotify(
        `Backup restaurado: ${json.counts?.leads ?? 0} leads, ${json.counts?.partners ?? 0} parceiros e ${json.counts?.templates ?? 0} templates.`,
        "success"
      );
    } catch {
      onNotify("Erro ao ler o arquivo JSON de backup.", "error");
    } finally {
      setRestoringBackup(false);
      e.target.value = "";
    }
  };

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

  const loadCronHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/cron/followup?history=1", {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        setCronHistory(json.logs || []);
      }
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadQueue();
    loadCronHistory();
  }, []);

  const eligibleForAutomation = leads.filter(
    (l) =>
      (l.stage === "contatado" || l.stage === "proposta_aberta") &&
      l.automacaoAtiva &&
      !l.respondeu
  );

  const pendingQueueCount = queueJobs.filter(
    (j) => j.status === "pendente"
  ).length;

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      newAdminPassword.trim().length > 0 &&
      newAdminPassword.trim().length < 4
    ) {
      onNotify("A senha do CRM deve ter pelo menos 4 caracteres.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<StudioSettings> & { newAdminPassword?: string } = {
        whatsappProvider,
        whatsappApiUrl: whatsappApiUrl.trim(),
        whatsappApiKey: whatsappApiKey.trim(),
        whatsappInstance: whatsappInstance.trim(),
        adminEmail: adminEmail.trim(),
        pixKey: pixKey.trim(),
        pixRecipientName: pixRecipientName.trim() || "Ultimo Quadro",
        pixCity: (pixCity.trim() || "BELO HORIZONTE").toUpperCase(),
      };
      if (newAdminPassword.trim().length >= 4) {
        payload.newAdminPassword = newAdminPassword.trim();
      }
      await onUpdateSettings(payload);
      if (newAdminPassword.trim().length >= 4) {
        setNewAdminPassword("");
        onNotify(
          "Configurações e nova senha criptografada (SHA-256) salvas.",
          "success"
        );
      } else {
        onNotify("Configurações salvas com sucesso.", "success");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClearPassword = async () => {
    setSaving(true);
    try {
      await onUpdateSettings({
        clearAdminPassword: true,
      } as unknown as Partial<StudioSettings>);
      onNotify(
        "Senha personalizada do banco removida. (Se CRM_ADMIN_PASSWORD existir na Vercel, ela continuará ativa).",
        "info"
      );
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
      await loadCronHistory();
      onNotify(
        dryRun
          ? `Simulação concluída: ${json.triggeredCount} lead(s) elegíveis para disparo.`
          : `Régua executada: ${json.triggeredCount} follow-up(s) processados.`,
        "success"
      );
    } finally {
      setRunningCron(false);
    }
  };

  const handleProcessQueueNow = async () => {
    setProcessingQueue(true);
    try {
      const res = await fetch("/api/whatsapp/queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const json = await res.json();
      if (!res.ok) {
        onNotify(json.error || "Erro ao processar fila de WhatsApp.", "error");
        return;
      }
      setQueueJobs(json.jobs || []);
      onNotify(
        json.processed > 0
          ? `${json.processed} disparo(s) pendente(s) processados na fila.`
          : "Nenhum disparo pendente pronto para envio.",
        "success"
      );
    } finally {
      setProcessingQueue(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono-num text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-text)]">
            Automação B2B &amp; Integrações
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            Configurações &amp; Motor de Cadência
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-semibold",
              integrationStatus.whatsappApiLive
                ? "badge-success"
                : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-hairline)]"
            )}
          >
            <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
            {integrationStatus.whatsappApiLive
              ? `WhatsApp API (${integrationStatus.whatsappProvider.toUpperCase()})`
              : "WhatsApp: Modo Seguro"}
          </span>

          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-semibold",
              integrationStatus.gmailLive
                ? "badge-success"
                : integrationStatus.resendLive
                ? "badge-info"
                : "badge-accent"
            )}
          >
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            {integrationStatus.gmailLive
              ? "Gmail SMTP Ativo"
              : integrationStatus.resendLive
              ? "Resend + Radar Ativos"
              : "E-mail em Simulação"}
          </span>

          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-semibold",
              integrationStatus.adminAuthEnabled
                ? "badge-success"
                : "badge-warning"
            )}
          >
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            {integrationStatus.adminAuthEnabled
              ? "Login Admin Ativo"
              : "Acesso Aberto (sem senha)"}
          </span>
        </div>
      </div>

      {/* Integration & Security Status Cards */}
      <div className="double-bezel stagger-in">
        <div className="double-bezel-core grid grid-cols-1 divide-y divide-[var(--border-hairline)] md:grid-cols-2 md:divide-y-0 md:divide-x">
          <div className="p-4 flex items-start gap-3">
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                integrationStatus.adminAuthEnabled
                  ? "bg-[var(--status-success-bg)] text-[var(--status-success)]"
                  : "bg-[var(--status-warning-bg)] text-[var(--status-warning)]"
              )}
            >
              <Lock className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="text-xs space-y-1">
              <p className="font-bold text-[var(--text-primary)]">
                Cofre Administrativo (HMAC-SHA256 + Anti-Brute-Force)
              </p>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                {integrationStatus.adminAuthEnabled
                  ? "Sessão assinada por cookie HttpOnly com expiração e limite de 5 tentativas por IP ativa. As propostas públicas (/proposta/[id]) permanecem liberadas para clientes."
                  : "Cadastre uma senha no formulário abaixo (salva criptografada no Firebase) ou defina CRM_ADMIN_PASSWORD na Vercel para ativar o login."}
              </p>
            </div>
          </div>

          <div className="p-4 flex items-start gap-3">
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                integrationStatus.gmailLive || integrationStatus.resendLive
                  ? "bg-[var(--status-success-bg)] text-[var(--status-success)]"
                  : "bg-[var(--accent-soft)] text-[var(--accent-text)]"
              )}
            >
              <BellRing className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="text-xs space-y-1">
              <p className="font-bold text-[var(--text-primary)]">
                Provedor de E-mail Transacional (Gmail SMTP ou Resend)
              </p>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                {integrationStatus.gmailLive
                  ? "Gmail SMTP (Nodemailer) configurado e pronto para disparar propostas para qualquer cliente sem domínio pago."
                  : "Configure GMAIL_USER e GMAIL_APP_PASSWORD (Senha de App Google) para enviar e-mails gratuitos para qualquer cliente, ou use RESEND_API_KEY."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Card 1: Motor de Follow-up Automático */}
        <div
          className="double-bezel stagger-in xl:col-span-12"
          style={{ ["--stagger" as string]: 0 }}
        >
          <section className="double-bezel-core p-6 space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-text)]">
                <Bot className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-bold text-[var(--text-primary)]">
                  Motor de Follow-up Automático (Cron diário às 09:00 BRT)
                </h2>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  Varre leads em <strong>Contatado</strong> e{" "}
                  <strong>Proposta Aberta</strong> com{" "}
                  <code className="font-mono-num text-[var(--accent-text)]">
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
                className="btn-ghost inline-flex min-h-[42px] items-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-semibold disabled:opacity-50"
              >
                <Activity
                  className="h-3.5 w-3.5 text-[var(--accent-text)]"
                  aria-hidden="true"
                />
                {runningCron ? "Analisando..." : "Testar Régua Agora"}
              </button>
              <button
                type="button"
                onClick={() => handleRunCron(false)}
                disabled={runningCron}
                className="btn-accent inline-flex min-h-[42px] items-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-bold disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                {runningCron ? "Executando..." : "Executar Disparos Agora"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-[var(--bg-subtle)] p-4">
              <p className="text-[11px] text-[var(--text-muted)]">
                Leads monitorados na régua
              </p>
              <p className="mt-1 font-mono-num text-2xl font-bold text-[var(--text-primary)]">
                {eligibleForAutomation.length}
              </p>
            </div>
            <div className="rounded-lg bg-[var(--bg-subtle)] p-4">
              <p className="text-[11px] text-[var(--text-muted)]">
                Endpoint Cron (Vercel)
              </p>
              <p className="mt-1 font-mono-num text-xs font-semibold text-[var(--accent-text)]">
                GET /api/cron/followup · 0 12 * * *
              </p>
            </div>
            <div className="rounded-lg bg-[var(--bg-subtle)] p-4">
              <p className="text-[11px] text-[var(--text-muted)]">
                Proteção Anti-Spam / Trava
              </p>
              <p className="mt-1 text-xs font-semibold text-[var(--status-success)] flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Desliga ao Responder / Pagar
              </p>
            </div>
          </div>

          {cronReport && (
            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-[var(--text-primary)]">
                  Resultado da{" "}
                  {cronReport.dryRun ? "Simulação (Dry-Run)" : "Execução Real"}:{" "}
                  {cronReport.triggeredCount} disparo(s) de{" "}
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
                      className="flex flex-col gap-2 rounded-lg bg-[var(--bg-surface-solid)] border border-[var(--border-hairline)] px-3.5 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between"
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
                        <span className="badge-info rounded-md px-2.5 py-0.5">
                          E-mail: {act.emailStatus}
                        </span>
                        <span className="badge-success rounded-md px-2.5 py-0.5">
                          WA: {act.whatsappStatus}
                        </span>
                        {act.tagAdded && (
                          <span className="badge-danger rounded-md px-2.5 py-0.5">
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

          {/* Persisted Cron Execution History (Last 10) */}
          <div className="border-t border-[var(--border-hairline)] pt-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Histórico de Execuções do Cron (Últimas 10)
              </h3>
              <button
                type="button"
                onClick={loadCronHistory}
                className="btn-ghost inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold"
                aria-label="Atualizar histórico do cron"
              >
                <RefreshCw
                  className={cn("h-3 w-3", loadingHistory && "animate-spin")}
                  aria-hidden="true"
                />
                Atualizar
              </button>
            </div>

            {cronHistory.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">
                Nenhuma execução registrada ainda. Clique em Testar Régua ou
                aguarde o agendamento diário às 09:00 BRT.
              </p>
            ) : (
              <div className="divide-y divide-[var(--border-hairline)]">
                {cronHistory.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between gap-3 py-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase",
                            log.dryRun ? "badge-info" : "badge-success"
                          )}
                        >
                          {log.dryRun ? "Simulação" : "Produção"}
                        </span>
                        <span className="font-mono-num text-[11px] text-[var(--text-muted)]">
                          {formatDateTimeBr(log.executedAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                        {log.triggeredCount} disparo(s) de {log.scannedEligible}{" "}
                        elegíveis · {log.whatsappQueueScheduled} na fila WA
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          </section>
        </div>

        {/* Card 2: Settings Form */}
        <div
          className="double-bezel stagger-in xl:col-span-7"
          style={{ ["--stagger" as string]: 1 }}
        >
          <form
            onSubmit={handleSaveSettings}
            className="double-bezel-core h-full p-6 space-y-6"
          >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Smartphone
                  className="h-4 w-4 text-[var(--status-success)]"
                  aria-hidden="true"
                />
                <h2 className="text-sm font-bold text-[var(--text-primary)]">
                  Integração WhatsApp Automático (Evolution API / Z-API)
                </h2>
              </div>
              <div className="flex rounded-lg bg-[var(--bg-subtle)] p-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setWhatsappProvider("evolution")}
                  aria-pressed={whatsappProvider === "evolution"}
                  className={cn(
                    "min-h-[34px] rounded-md px-2.5 py-1 font-semibold transition-colors",
                    whatsappProvider === "evolution"
                      ? "bg-[var(--accent-btn)] text-[var(--accent-fg)]"
                      : "text-[var(--text-secondary)]"
                  )}
                >
                  Evolution API
                </button>
                <button
                  type="button"
                  onClick={() => setWhatsappProvider("zapi")}
                  aria-pressed={whatsappProvider === "zapi"}
                  className={cn(
                    "min-h-[34px] rounded-md px-2.5 py-1 font-semibold transition-colors",
                    whatsappProvider === "zapi"
                      ? "bg-[var(--accent-btn)] text-[var(--accent-fg)]"
                      : "text-[var(--text-secondary)]"
                  )}
                >
                  Z-API
                </button>
              </div>
            </div>

            <p className="text-xs text-[var(--text-secondary)]">
              Deixe em branco para manter o{" "}
              <strong>Modo Seguro (1-Clique via wa.me)</strong> como padrão.
              Quando preenchido, habilita alertas do Radar no seu WhatsApp e a
              fila anti-ban persistida (intervalo de 3 a 6 min).
            </p>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label
                  htmlFor="cfg-wa-url"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5"
                >
                  WHATSAPP_API_URL
                </label>
                <input
                  id="cfg-wa-url"
                  type="url"
                  value={whatsappApiUrl}
                  onChange={(e) => setWhatsappApiUrl(e.target.value)}
                  placeholder={
                    whatsappProvider === "zapi"
                      ? "https://api.z-api.io"
                      : "https://sua-evolution-api.com.br"
                  }
                  className="input-field min-h-[42px] w-full rounded-lg px-3.5 py-2.5 font-mono-num text-xs"
                />
              </div>

              <div>
                <label
                  htmlFor="cfg-wa-instance"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5"
                >
                  WHATSAPP_INSTANCE
                </label>
                <input
                  id="cfg-wa-instance"
                  type="text"
                  value={whatsappInstance}
                  onChange={(e) => setWhatsappInstance(e.target.value)}
                  placeholder="ultimo-quadro-bh"
                  className="input-field min-h-[42px] w-full rounded-lg px-3.5 py-2.5 font-mono-num text-xs"
                />
              </div>

              <div>
                <label
                  htmlFor="cfg-wa-key"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5"
                >
                  WHATSAPP_API_KEY
                </label>
                <input
                  id="cfg-wa-key"
                  type="password"
                  value={whatsappApiKey}
                  onChange={(e) => setWhatsappApiKey(e.target.value)}
                  placeholder="Sua API Key / Token"
                  className="input-field min-h-[42px] w-full rounded-lg px-3.5 py-2.5 font-mono-num text-xs"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t border-[var(--border-hairline)] pt-5">
            <div className="flex items-center gap-2">
              <QrCode
                className="h-4 w-4 text-[var(--accent-text)]"
                aria-hidden="true"
              />
              <h2 className="text-sm font-bold text-[var(--text-primary)]">
                Radar em Tempo Real &amp; Pix Estático (Sinal 50%)
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="cfg-admin-email"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5"
                >
                  ADMIN_EMAIL (Alertas de Radar)
                </label>
                <input
                  id="cfg-admin-email"
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="ultimoquadrofilmes@gmail.com"
                  className="input-field min-h-[42px] w-full rounded-lg px-3.5 py-2.5 text-xs"
                />
              </div>

              <div>
                <label
                  htmlFor="cfg-pix-key"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5"
                >
                  Chave Pix (NEXT_PUBLIC_PIX_KEY)
                </label>
                <input
                  id="cfg-pix-key"
                  type="text"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  placeholder="E-mail, CPF/CNPJ, telefone ou aleatória"
                  className="input-field min-h-[42px] w-full rounded-lg px-3.5 py-2.5 font-mono-num text-xs"
                />
              </div>

              <div>
                <label
                  htmlFor="cfg-pix-name"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5"
                >
                  Nome no Pix (BR Code)
                </label>
                <input
                  id="cfg-pix-name"
                  type="text"
                  value={pixRecipientName}
                  onChange={(e) => setPixRecipientName(e.target.value)}
                  placeholder="Ultimo Quadro"
                  className="input-field min-h-[42px] w-full rounded-lg px-3.5 py-2.5 text-xs"
                />
              </div>

              <div>
                <label
                  htmlFor="cfg-pix-city"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5"
                >
                  Cidade no Pix
                </label>
                <input
                  id="cfg-pix-city"
                  type="text"
                  value={pixCity}
                  onChange={(e) => setPixCity(e.target.value)}
                  placeholder="BELO HORIZONTE"
                  className="input-field min-h-[42px] w-full rounded-lg px-3.5 py-2.5 font-mono-num text-xs"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t border-[var(--border-hairline)] pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Lock
                  className="h-4 w-4 text-[var(--accent-text)]"
                  aria-hidden="true"
                />
                <h2 className="text-sm font-bold text-[var(--text-primary)]">
                  Segurança &amp; Cofre de Login (HMAC-SHA256)
                </h2>
              </div>
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 font-mono-num text-[10px] font-bold uppercase",
                  integrationStatus.adminAuthEnabled || settings.adminPasswordHash
                    ? "badge-success"
                    : "badge-warning"
                )}
              >
                {integrationStatus.adminAuthEnabled || settings.adminPasswordHash
                  ? "Login Protegido"
                  : "Acesso Aberto"}
              </span>
            </div>

            <p className="text-xs text-[var(--text-secondary)]">
              Defina ou altere a senha de acesso ao CRM diretamente abaixo. Ela é
              salva com <strong>hash HMAC-SHA256 + salt</strong> no banco de dados
              e ativa automaticamente o bloqueio anti-força bruta (5 tentativas /
              15 min).
            </p>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-12 items-end">
              <div className="sm:col-span-8">
                <label
                  htmlFor="cfg-admin-password"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5"
                >
                  {settings.adminPasswordHash
                    ? "Substituir Senha Atual do CRM"
                    : "Definir Nova Senha do CRM (mín. 4 caracteres)"}
                </label>
                <div className="relative">
                  <Lock
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]"
                  />
                  <input
                    id="cfg-admin-password"
                    type={showNewPassword ? "text" : "password"}
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    placeholder={
                      settings.adminPasswordHash
                        ? "Digite para trocar a senha criptografada..."
                        : "Digite uma senha forte para ativar o Login..."
                    }
                    className="input-field min-h-[42px] w-full rounded-lg pl-9 pr-10 py-2.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    aria-label={
                      showNewPassword ? "Ocultar nova senha" : "Mostrar nova senha"
                    }
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <div className="sm:col-span-4 flex items-center gap-2">
                {settings.adminPasswordHash && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleClearPassword}
                    className="btn-ghost min-h-[42px] w-full rounded-lg px-3 py-2 text-xs font-semibold text-[var(--status-danger)]"
                  >
                    Remover Senha do Banco
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={saving}
              className="btn-accent inline-flex min-h-[44px] items-center gap-2 rounded-lg pl-5 pr-2 py-1.5 text-xs font-bold disabled:opacity-60"
            >
              <span>{saving ? "Salvando..." : "Salvar Configurações"}</span>
              <span className="btn-icon-badge">
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </button>
          </div>
          </form>
        </div>

        {/* Card 3: Persisted Anti-Ban WhatsApp Queue Monitor */}
        <div
          className="double-bezel stagger-in xl:col-span-5"
          style={{ ["--stagger" as string]: 2 }}
        >
          <section className="double-bezel-core h-full p-6 flex flex-col space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock
                  className="h-4 w-4 text-[var(--accent-text)]"
                  aria-hidden="true"
                />
                <div>
                  <h2 className="text-sm font-bold text-[var(--text-primary)]">
                    Fila Anti-Ban de WhatsApp
                  </h2>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Persistida no banco · intervalos de 3 a 6 minutos.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={loadQueue}
                className="btn-ghost flex h-10 w-10 items-center justify-center rounded-lg"
                aria-label="Atualizar fila de WhatsApp"
                title="Atualizar fila"
              >
                <RefreshCw
                  className={cn("h-3.5 w-3.5", loadingQueue && "animate-spin")}
                  aria-hidden="true"
                />
              </button>
            </div>

            {pendingQueueCount > 0 && (
              <button
                type="button"
                onClick={handleProcessQueueNow}
                disabled={processingQueue}
                className="btn-accent inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                {processingQueue
                  ? "Processando fila..."
                  : `Processar Fila Pendente Agora (${pendingQueueCount})`}
              </button>
            )}

            <div className="flex-1 overflow-y-auto max-h-[380px] pr-1">
              {queueJobs.length === 0 ? (
                <div className="border-t border-[var(--border-hairline)] py-6 text-center">
                  <CheckCircle2
                    className="mx-auto h-6 w-6 text-[var(--text-muted)]"
                    aria-hidden="true"
                  />
                  <p className="mt-2 text-xs font-semibold text-[var(--text-secondary)]">
                    Nenhum disparo na fila no momento
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                    Use o Disparador em Lote ou a Régua Automática para enfileirar
                    mensagens com espaçamento seguro de 3 a 6 min.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-hairline)] border-t border-[var(--border-hairline)]">
                  {queueJobs.map((job) => (
                    <div
                      key={job.id}
                      className="py-3 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[var(--text-primary)] truncate">
                          {job.companyName}
                        </span>
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase",
                            job.status === "enviado" && "badge-success",
                            job.status === "pendente" && "badge-warning",
                            job.status === "enviando" && "badge-info",
                            job.status === "simulado" && "badge-accent",
                            job.status === "erro" && "badge-danger"
                          )}
                        >
                          {job.status}
                        </span>
                      </div>
                      <p className="font-mono-num text-[11px] text-[var(--text-secondary)]">
                        {job.phone} · Previsto: {formatDateTimeBr(job.scheduledFor)}
                      </p>
                      {job.error && (
                        <p className="text-[11px] text-[var(--status-danger)]">
                          {job.error}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Card 4: Studio Skins, Densidade & Notificações Push no Celular */}
        <div
          className="double-bezel stagger-in xl:col-span-7"
          style={{ ["--stagger" as string]: 3 }}
        >
          <section className="double-bezel-core h-full p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Palette
                  className="h-4 w-4 text-[var(--accent-text)]"
                  aria-hidden="true"
                />
                <h2 className="text-sm font-bold text-[var(--text-primary)]">
                  Studio Skins &amp; Densidade Visual
                </h2>
              </div>
              <div className="dock-shell inline-flex gap-1">
                <button
                  type="button"
                  onClick={() => setDensity("comfortable")}
                  className={cn(
                    "min-h-[30px] rounded-md px-2.5 text-[11px] font-semibold transition-colors",
                    density === "comfortable"
                      ? "bg-[var(--bg-surface-solid)] text-[var(--text-primary)] border border-[var(--border-hairline)]"
                      : "text-[var(--text-secondary)]"
                  )}
                >
                  Confortável (Toque)
                </button>
                <button
                  type="button"
                  onClick={() => setDensity("compact")}
                  className={cn(
                    "min-h-[30px] rounded-md px-2.5 text-[11px] font-semibold transition-colors",
                    density === "compact"
                      ? "bg-[var(--bg-surface-solid)] text-[var(--text-primary)] border border-[var(--border-hairline)]"
                      : "text-[var(--text-secondary)]"
                  )}
                >
                  Compacta (Desktop)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {STUDIO_SKINS.map((s) => {
                const active = skin === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSkin(s.id)}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all",
                      active
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-[var(--border-hairline)] hover:bg-[var(--bg-surface-hover)]"
                    )}
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15"
                      style={{ backgroundColor: s.swatchBg }}
                    >
                      <span
                        className="h-3.5 w-3.5 rounded-full"
                        style={{ backgroundColor: s.swatchAccent }}
                      />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[var(--text-primary)]">
                        {s.label}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                        {s.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Card 5: Web Push Mobile Notifications */}
        <div
          className="double-bezel stagger-in xl:col-span-5"
          style={{ ["--stagger" as string]: 4 }}
        >
          <section className="double-bezel-core h-full p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Bell
                    className="h-4 w-4 text-[var(--accent-text)]"
                    aria-hidden="true"
                  />
                  <h2 className="text-sm font-bold text-[var(--text-primary)]">
                    Notificações Push no Celular
                  </h2>
                </div>
                <span className="badge-accent rounded-md px-2 py-0.5 font-mono-num text-[10px] font-bold">
                  {pushDevicesCount} DISP.
                </span>
              </div>
              <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                Receba alertas nativos na tela bloqueada quando um cliente abrir
                o Portal, aprovar proposta, clicar em &quot;Já fiz o Pix&quot; ou pedir
                reunião. No iPhone, instale primeiro na Tela de Início.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pushLoading}
                onClick={handleTogglePush}
                className={cn(
                  "min-h-[42px] flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 text-xs font-bold disabled:opacity-60",
                  pushSubscribed ? "btn-ghost" : "btn-accent"
                )}
              >
                <Bell className="h-3.5 w-3.5" />
                {pushSubscribed
                  ? "Desativar neste Dispositivo"
                  : "Ativar Push neste Dispositivo"}
              </button>
              {pushDevicesCount > 0 && (
                <button
                  type="button"
                  disabled={pushLoading}
                  onClick={handleTestPush}
                  className="btn-ghost min-h-[42px] rounded-lg px-3.5 text-xs font-semibold"
                >
                  Testar
                </button>
              )}
            </div>
          </section>
        </div>

        {/* Card 6: Full Database Backup & Restore (.json) */}
        <div
          className="double-bezel stagger-in xl:col-span-12"
          style={{ ["--stagger" as string]: 3 }}
        >
          <section className="double-bezel-core p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-text)]">
                <Database className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)]">
                  Backup Completo &amp; Restauração do CRM (.json)
                </h2>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  Exporte uma cópia integral de todos os leads, parceiros,
                  reuniões, entregas 4K, scripts e configurações do estúdio ou
                  restaure um backup anterior com 1 clique.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <a
                href="/api/backup"
                download
                className="btn-accent inline-flex min-h-[42px] items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Baixar Backup (.json)
              </a>

              <label className="btn-ghost inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold">
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {restoringBackup ? "Restaurando..." : "Restaurar Backup"}
                </span>
                <input
                  type="file"
                  accept="application/json,.json"
                  disabled={restoringBackup}
                  onChange={handleRestoreBackupFile}
                  className="sr-only"
                />
              </label>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
