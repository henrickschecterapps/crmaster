"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Theme = "dark" | "light";
export type StudioSkin = "obsidian" | "midnight" | "graphite" | "alabaster";
export type UiDensity = "comfortable" | "compact";

export const STUDIO_SKINS: Array<{
  id: StudioSkin;
  label: string;
  description: string;
  theme: Theme;
  swatchBg: string;
  swatchAccent: string;
}> = [
  {
    id: "obsidian",
    label: "Obsidian Ember",
    description: "Assinatura ÚLTIMO QUADRO · preto cinema + laranja queimado",
    theme: "dark",
    swatchBg: "#0C0C0C",
    swatchAccent: "#EA7845",
  },
  {
    id: "midnight",
    label: "Midnight Cinema",
    description: "Sala de color grading · azul noturno profundo + ciano",
    theme: "dark",
    swatchBg: "#070C18",
    swatchAccent: "#38BDF8",
  },
  {
    id: "graphite",
    label: "Graphite Linear",
    description: "Estúdio minimalista · grafite técnico + cobre suave",
    theme: "dark",
    swatchBg: "#121316",
    swatchAccent: "#E08E52",
  },
  {
    id: "alabaster",
    label: "Alabaster Editorial",
    description: "Modo claro editorial · papel quente + terracota",
    theme: "light",
    swatchBg: "#F6F5F3",
    swatchAccent: "#B54512",
  },
];

interface ThemeContextValue {
  theme: Theme;
  skin: StudioSkin;
  density: UiDensity;
  toggleTheme: () => void;
  setSkin: (skin: StudioSkin) => void;
  setDensity: (density: UiDensity) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  skin: "obsidian",
  density: "comfortable",
  toggleTheme: () => {},
  setSkin: () => {},
  setDensity: () => {},
});

const STORAGE_THEME_KEY = "crmaster_theme_v1";
const STORAGE_SKIN_KEY = "crmaster_skin_v1";
const STORAGE_DENSITY_KEY = "crmaster_density_v1";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [skin, setSkinState] = useState<StudioSkin>("obsidian");
  const [density, setDensityState] = useState<UiDensity>("comfortable");

  const applyAttrs = (nextTheme: Theme, nextSkin: StudioSkin, nextDensity: UiDensity) => {
    document.documentElement.setAttribute("data-theme", nextTheme);
    document.documentElement.setAttribute("data-skin", nextSkin);
    document.documentElement.setAttribute("data-density", nextDensity);
  };

  useEffect(() => {
    const savedSkin = window.localStorage.getItem(STORAGE_SKIN_KEY) as StudioSkin | null;
    const savedTheme = window.localStorage.getItem(STORAGE_THEME_KEY) as Theme | null;
    const savedDensity = window.localStorage.getItem(STORAGE_DENSITY_KEY) as UiDensity | null;

    const resolvedSkin: StudioSkin =
      savedSkin && STUDIO_SKINS.some((s) => s.id === savedSkin)
        ? savedSkin
        : savedTheme === "light"
        ? "alabaster"
        : "obsidian";
    const resolvedTheme: Theme =
      STUDIO_SKINS.find((s) => s.id === resolvedSkin)?.theme ?? "dark";
    const resolvedDensity: UiDensity =
      savedDensity === "compact" ? "compact" : "comfortable";

    setSkinState(resolvedSkin);
    setTheme(resolvedTheme);
    setDensityState(resolvedDensity);
    applyAttrs(resolvedTheme, resolvedSkin, resolvedDensity);
  }, []);

  const setSkin = (nextSkin: StudioSkin) => {
    const meta = STUDIO_SKINS.find((s) => s.id === nextSkin) ?? STUDIO_SKINS[0];
    setSkinState(meta.id);
    setTheme(meta.theme);
    window.localStorage.setItem(STORAGE_SKIN_KEY, meta.id);
    window.localStorage.setItem(STORAGE_THEME_KEY, meta.theme);
    applyAttrs(meta.theme, meta.id, density);
  };

  const setDensity = (nextDensity: UiDensity) => {
    setDensityState(nextDensity);
    window.localStorage.setItem(STORAGE_DENSITY_KEY, nextDensity);
    applyAttrs(theme, skin, nextDensity);
  };

  const toggleTheme = () => {
    const nextSkin: StudioSkin = theme === "dark" ? "alabaster" : "obsidian";
    setSkin(nextSkin);
  };

  return (
    <ThemeContext.Provider
      value={{ theme, skin, density, toggleTheme, setSkin, setDensity }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
