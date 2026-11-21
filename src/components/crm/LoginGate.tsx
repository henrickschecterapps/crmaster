"use client";

import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Eye,
  EyeOff,
  Film,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

interface LoginGateProps {
  studioName?: string;
  requireEmail?: boolean;
}

export function LoginGate({
  studioName = "ÚLTIMO QUADRO",
  requireEmail = false,
}: LoginGateProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(
    null
  );
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (lockoutSeconds > 0) return;

    if (!password.trim()) {
      setError("Informe a senha administrativa para continuar.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim() || undefined,
          password,
          rememberMe,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Falha ao autenticar.");
        if (typeof json.remainingAttempts === "number") {
          setRemainingAttempts(json.remainingAttempts);
        }
        if (typeof json.retryAfterSeconds === "number") {
          setLockoutSeconds(json.retryAfterSeconds);
        }
        return;
      }
      window.location.reload();
    } catch {
      setError("Erro de conexão com o servidor. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const formatCountdown = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <main className="cinema-grain relative min-h-[100dvh] flex flex-col items-center justify-center px-4 py-10">
      {/* Top Cinema Studio Status Strip */}
      <div className="mb-6 flex flex-wrap items-center justify-center gap-3 text-[11px] font-mono-num text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 py-1">
          <span
            className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]"
            aria-hidden="true"
          />
          <Film className="h-3 w-3 text-[var(--accent-text)]" aria-hidden="true" />
          TC 00:00:00:01 · {studioName}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 py-1">
          <ShieldCheck
            className="h-3.5 w-3.5 text-[var(--status-success)]"
            aria-hidden="true"
          />
          HMAC-SHA256 · Rate-Limit Ativo
        </span>
      </div>

      {/* Double-Bezel Machined Login Vault */}
      <div className="double-bezel stagger-in w-full max-w-md">
        <div className="double-bezel-core viewfinder-frame p-6 sm:p-8 space-y-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <BrandMark showTagline />
              <span className="badge-accent rounded-md px-2 py-1 font-mono-num text-[10px] font-bold uppercase tracking-wider">
                COFRE B2B
              </span>
            </div>

            <div className="border-t border-[var(--border-hairline)] pt-4">
              <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
                Autenticação do Estúdio
              </h1>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                Acesso restrito ao pipeline comercial, prospecção Overture BH e
                régua financeira da {studioName}.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {requireEmail && (
              <div>
                <label
                  htmlFor="admin-email"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5"
                >
                  E-mail do Administrador (opcional)
                </label>
                <div className="relative">
                  <Mail
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
                  />
                  <input
                    id="admin-email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contato@ultimoquadro.com.br"
                    className="input-field min-h-[44px] w-full rounded-lg py-2.5 pl-10 pr-4 text-sm"
                  />
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="admin-password"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]"
                >
                  Senha Mestra do CRM
                </label>
                {remainingAttempts !== null &&
                  remainingAttempts > 0 &&
                  remainingAttempts < 5 && (
                    <span className="font-mono-num text-[11px] font-semibold text-[var(--status-warning)]">
                      {remainingAttempts} tentativa(s) restante(s)
                    </span>
                  )}
              </div>
              <div className="relative">
                <Lock
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
                />
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoFocus
                  autoComplete="current-password"
                  disabled={lockoutSeconds > 0}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha de acesso"
                  className="input-field min-h-[44px] w-full rounded-lg py-2.5 pl-10 pr-11 text-sm disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="
                    absolute right-2 top-1/2 -translate-y-1/2
                    flex h-8 w-8 items-center justify-center rounded-md
                    text-[var(--text-muted)] hover:text-[var(--text-primary)]
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]
                  "
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {/* Session Duration Selector */}
            <div className="flex items-center justify-between border-t border-b border-[var(--border-hairline)] py-3">
              <label
                htmlFor="remember-session"
                className="flex items-center gap-2.5 cursor-pointer select-none text-xs text-[var(--text-secondary)]"
              >
                <input
                  id="remember-session"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--border-strong)] accent-[var(--accent)]"
                />
                <span>Manter sessão conectada neste dispositivo</span>
              </label>
              <span className="font-mono-num text-[11px] font-semibold text-[var(--text-muted)]">
                {rememberMe ? "14 DIAS" : "12 HORAS"}
              </span>
            </div>

            {lockoutSeconds > 0 && (
              <div
                role="alert"
                className="badge-danger flex items-center justify-between gap-2 rounded-lg px-3.5 py-2.5 text-xs font-medium"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Proteção anti-força bruta acionada.</span>
                </div>
                <span className="font-mono-num font-bold">
                  {formatCountdown(lockoutSeconds)}
                </span>
              </div>
            )}

            {error && lockoutSeconds === 0 && (
              <p
                role="alert"
                className="badge-danger rounded-lg px-3.5 py-2.5 text-xs font-medium"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || lockoutSeconds > 0}
              className="btn-accent w-full min-h-[46px] inline-flex items-center justify-between rounded-lg pl-5 pr-2 py-2 text-sm font-bold disabled:opacity-60"
            >
              <span>
                {lockoutSeconds > 0
                  ? `Aguarde ${formatCountdown(lockoutSeconds)} para tentar`
                  : loading
                  ? "Validando assinatura HMAC..."
                  : "Desbloquear Painel Comercial"}
              </span>
              <span className="btn-icon-badge">
                <LogIn aria-hidden="true" className="h-4 w-4" />
              </span>
            </button>
          </form>

          {/* Security Footer Details */}
          <div className="divide-y divide-[var(--border-hairline)] border-t border-[var(--border-hairline)] text-[11px] text-[var(--text-muted)]">
            <div className="flex items-center justify-between py-2">
              <span>Propostas Web de Clientes</span>
              <span className="font-mono-num text-[var(--status-success)] font-semibold">
                PÚBLICAS (/proposta/*)
              </span>
            </div>
            <div className="flex items-center justify-between pt-2">
              <span>Criptografia de Sessão</span>
              <span className="font-mono-num text-[var(--text-secondary)]">
                Cookie HttpOnly · SameSite Lax
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
