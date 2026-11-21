"use client";

import React, { useState } from "react";
import { Lock, LogIn } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

export function LoginGate() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!password.trim()) {
      setError("Informe a senha de acesso.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Falha ao autenticar.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-4 py-12">
      <div className="surface-card w-full max-w-md rounded-xl p-6 sm:p-8 space-y-6">
        <div className="space-y-4">
          <BrandMark showTagline />
          <div className="border-t border-[var(--border-hairline)] pt-4">
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              Acesso Administrativo
            </h1>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
              Digite sua senha para acessar o painel comercial, leads e finanças
              da ÚLTIMO QUADRO.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="admin-password"
              className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
            >
              Senha do CRM
            </label>
            <div className="relative">
              <Lock
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
              />
              <input
                id="admin-password"
                type="password"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                className="input-field w-full rounded-lg py-3 pl-10 pr-4 text-sm"
              />
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="badge-danger rounded-lg px-3.5 py-2.5 text-xs font-medium"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-accent w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-bold disabled:opacity-60"
          >
            <LogIn aria-hidden="true" className="h-4 w-4" />
            {loading ? "Validando acesso..." : "Entrar no CRM"}
          </button>
        </form>
      </div>
    </main>
  );
}
