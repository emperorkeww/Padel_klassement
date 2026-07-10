// Thema-voorkeur (systeem/licht/donker/smurf) met persistentie en live
// toepassing. De resolver zet altijd expliciet data-theme="light|dark|smurf"
// op <html>, zodat de CSS per thema één token-blok volstaat (zie
// :root[data-theme="dark"] en :root[data-theme="smurf"] in src/app/index.css).
// Het inline script in index.html doet exact dezelfde resolutie vóór de
// eerste paint (geen flits) — houd beide in sync.

import { useSyncExternalStore } from "react";

export type ThemePreference = "system" | "light" | "dark" | "smurf";
export type ResolvedTheme = "light" | "dark" | "smurf";

const STORAGE_KEY = "theme";
const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: "#0c8a5f", // smaragd, zoals de statische meta
  dark: "#121814", // donkere zijbalk-tint
  smurf: "#1c66c8", // smurfblauw
};

// Defensief: jsdom (tests) heeft geen matchMedia; val dan terug op "licht".
const NO_MEDIA = {
  matches: false,
  addEventListener: () => {},
  removeEventListener: () => {},
} as unknown as MediaQueryList;
const media = () =>
  typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : NO_MEDIA;

/** De bewaarde voorkeur; onbekende/ontbrekende waarde = "system". */
export function getThemePreference(): ThemePreference {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system" || raw === "smurf")
      return raw;
  } catch {
    /* private mode e.d. */
  }
  return "system";
}

/** Voorkeur → effectief thema (system volgt de OS-voorkeur). */
export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === "system") return media().matches ? "dark" : "light";
  return pref;
}

// Abonnees op themawissels (o.a. useTheme voor thema-afhankelijke copy).
const listeners = new Set<() => void>();

/** Meld je aan voor themawissels; geeft een afmeldfunctie terug. */
export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Het effectieve thema zoals het nu op <html> staat. */
export function getResolvedTheme(): ResolvedTheme {
  const t = document.documentElement.dataset.theme;
  if (t === "dark" || t === "smurf" || t === "light") return t;
  return resolveTheme(getThemePreference());
}

/** React-hook: het effectieve thema, live bij wissels (voor themabare copy). */
export function useTheme(): ResolvedTheme {
  return useSyncExternalStore(subscribeTheme, getResolvedTheme);
}

/** Zet het effectieve thema op <html> en werk de theme-color-meta bij. */
export function applyTheme(pref: ThemePreference = getThemePreference()): void {
  const theme = resolveTheme(pref);
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLOR[theme]);
  listeners.forEach((l) => l());
}

/** Bewaart de keuze en past haar direct toe. */
export function setThemePreference(pref: ThemePreference): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    /* niet kunnen bewaren is geen reden om niet te schakelen */
  }
  applyTheme(pref);
}

/**
 * Volgt OS-wissels zolang de voorkeur "system" is (bv. auto-donker 's avonds).
 * Aanroepen bij app-start; geeft een opruimfunctie terug (voor tests).
 */
export function watchSystemTheme(): () => void {
  const m = media();
  const onChange = () => {
    if (getThemePreference() === "system") applyTheme("system");
  };
  m.addEventListener("change", onChange);
  return () => m.removeEventListener("change", onChange);
}
