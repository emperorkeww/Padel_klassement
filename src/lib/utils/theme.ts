// Thema-voorkeur (systeem/licht/donker) met persistentie en live toepassing.
// De resolver zet altijd expliciet data-theme="light|dark" op <html>, zodat de
// CSS één donker token-blok volstaat (zie :root[data-theme="dark"] in
// src/app/index.css). Het inline script in index.html doet exact dezelfde
// resolutie vóór de eerste paint (geen flits) — houd beide in sync.

export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "theme";
/** Kleur van de browser-/systeembalk rond de app. Moet gelijk blijven aan de
 *  twee waarden in het inline script van index.html — theme.test.ts leest dat
 *  bestand en faalt zodra de twee uit elkaar lopen (#1074). */
export const THEME_COLOR: Record<"light" | "dark", string> = {
  light: "#0c8a5f", // smaragd, zoals de statische meta
  dark: "#06090d", // --sidebar-bg: sluit aan op de mobiele topbalk (#1074/#1128)
};

const media = () => window.matchMedia("(prefers-color-scheme: dark)");

/** De bewaarde voorkeur; onbekende/ontbrekende waarde = "system". */
export function getThemePreference(): ThemePreference {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    /* private mode e.d. */
  }
  return "system";
}

/** Voorkeur → effectief thema (system volgt de OS-voorkeur). */
export function resolveTheme(pref: ThemePreference): "light" | "dark" {
  if (pref === "system") return media().matches ? "dark" : "light";
  return pref;
}

/** Zet het effectieve thema op <html> en werk de theme-color-meta bij. */
export function applyTheme(pref: ThemePreference = getThemePreference()): void {
  const theme = resolveTheme(pref);
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLOR[theme]);
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
