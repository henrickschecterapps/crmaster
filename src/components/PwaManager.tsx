"use client";

import React, { useEffect, useState } from "react";
import { Download, Share, WifiOff, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "uq_pwa_install_dismissed_v1";

export function PwaManager() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Register Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const updateOnline = () => setIsOffline(!navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);

    const wasDismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((window.navigator as unknown as { standalone?: boolean }).standalone);

    if (!wasDismissed && !isStandalone) {
      setDismissed(false);
      const ua = window.navigator.userAgent.toLowerCase();
      const isIos = /iphone|ipad|ipod/.test(ua);
      const isSafari = /safari/.test(ua) && !/crios|fxios|edgios/.test(ua);
      if (isIos && isSafari) {
        setShowIosHint(true);
      }
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (!wasDismissed) setDismissed(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setDeferredPrompt(null);
      setDismissed(true);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShowIosHint(false);
    window.localStorage.setItem(DISMISS_KEY, "1");
  };

  return (
    <>
      {isOffline && (
        <div
          role="status"
          className="fixed top-2 left-1/2 -translate-x-1/2 z-50 badge-warning inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-bold shadow-lg"
        >
          <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
          Modo Offline Local-First · Exibindo cache salvo no dispositivo
        </div>
      )}

      {!dismissed && (deferredPrompt || showIosHint) && (
        <div
          style={{
            bottom: "calc(4.75rem + env(safe-area-inset-bottom, 0px))",
          }}
          className="fixed left-3 right-20 sm:left-auto sm:right-5 sm:!bottom-5 z-30 sm:max-w-sm"
        >
          <div className="double-bezel">
            <div className="double-bezel-core p-3.5 flex items-start gap-3">
              <img
                src="/icons/icon-192.png"
                alt="Ícone ÚLTIMO QUADRO"
                className="h-10 w-10 rounded-lg shrink-0 border border-[var(--border-hairline)]"
              />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-bold text-[var(--text-primary)]">
                    Instalar ÚLTIMO QUADRO App
                  </p>
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    aria-label="Dispensar aviso de instalação"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {deferredPrompt ? (
                  <>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      Abra em tela cheia, acesse offline em eventos e receba
                      alertas Push.
                    </p>
                    <button
                      type="button"
                      onClick={handleInstall}
                      className="btn-accent inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-3 py-1 text-[11px] font-bold"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Instalar no Celular / Desktop
                    </button>
                  </>
                ) : (
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    No Safari do iPhone, toque em{" "}
                    <Share className="inline h-3 w-3 text-[var(--accent-text)]" />{" "}
                    <strong>Compartilhar</strong> e depois em{" "}
                    <strong>Adicionar à Tela de Início</strong>.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
