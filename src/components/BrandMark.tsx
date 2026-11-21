"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface BrandMarkProps {
  compact?: boolean;
  showTagline?: boolean;
  className?: string;
}

export function UltimoQuadroIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 380 104"
      fill="none"
      role="img"
      aria-label="Último Quadro — Ícone Oficial"
      className={className}
    >
      <g transform="translate(10, 10)">
        <rect
          x="0"
          y="0"
          width="112"
          height="63"
          rx="6"
          stroke="var(--film-gray)"
          strokeWidth="6"
        />
        <rect
          x="124"
          y="0"
          width="112"
          height="63"
          rx="6"
          stroke="var(--film-gray)"
          strokeWidth="6"
        />
        <rect
          x="248"
          y="0"
          width="112"
          height="63"
          rx="6"
          stroke="var(--accent)"
          strokeWidth="6"
        />
        <line
          x1="0"
          y1="80"
          x2="349.2"
          y2="80"
          stroke="var(--film-gray)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <circle cx="349.2" cy="80" r="7" fill="var(--accent)" />
      </g>
    </svg>
  );
}

export function BrandMark({
  compact = false,
  showTagline = false,
  className,
}: BrandMarkProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-2 py-1.5",
          compact ? "h-8 w-12" : "h-10 w-16"
        )}
      >
        <UltimoQuadroIcon className="w-full h-auto" />
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-1.5 leading-none">
          <span
            className={cn(
              "font-extrabold tracking-[0.14em] uppercase text-[var(--text-primary)]",
              compact ? "text-xs" : "text-sm"
            )}
          >
            ÚLTIMO
          </span>
          <span
            className={cn(
              "font-light tracking-[0.14em] uppercase text-[var(--accent)]",
              compact ? "text-xs" : "text-sm"
            )}
          >
            QUADRO
          </span>
        </div>
        {showTagline ? (
          <p className="mt-1 truncate text-[10px] font-medium text-[var(--text-muted)]">
            A história termina. A imagem fica.
          </p>
        ) : (
          <p className="mt-1 truncate font-mono-num text-[10px] tracking-wider uppercase text-[var(--text-muted)]">
            CRM · BH &amp; Nova Lima · 24FPS
          </p>
        )}
      </div>
    </div>
  );
}
