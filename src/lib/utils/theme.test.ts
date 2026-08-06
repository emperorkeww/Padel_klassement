import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  applyTheme,
  getThemePreference,
  resolveTheme,
  setThemePreference,
  THEME_COLOR,
  watchSystemTheme,
} from "@/lib/utils/theme";

// jsdom heeft geen matchMedia: stub met instelbare OS-voorkeur + listeners.
let systemDark = false;
let listeners: Array<() => void> = [];
function stubMatchMedia() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      get matches() {
        return systemDark;
      },
      addEventListener: (_: string, cb: () => void) => listeners.push(cb),
      removeEventListener: (_: string, cb: () => void) => {
        listeners = listeners.filter((l) => l !== cb);
      },
    })),
  );
}
const fireSystemChange = () => listeners.forEach((l) => l());

// Node's globale localStorage (zonder --localstorage-file) is een kreupele
// stub die ook window.localStorage overschaduwt; vervang hem door een simpele
// map zodat de voorkeur echt gelezen/geschreven kan worden.
let store: Record<string, string> = {};
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = String(v);
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  },
});

beforeEach(() => {
  store = {};
  systemDark = false;
  listeners = [];
  stubMatchMedia();
  delete document.documentElement.dataset.theme;
  document.head
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((m) => m.remove());
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = "#0c8a5f";
  document.head.appendChild(meta);
});

describe("getThemePreference", () => {
  it("valt terug op 'system' zonder of met onbekende opgeslagen waarde", () => {
    expect(getThemePreference()).toBe("system");
    window.localStorage.setItem("theme", "paars");
    expect(getThemePreference()).toBe("system");
  });

  it("leest een geldige opgeslagen keuze", () => {
    window.localStorage.setItem("theme", "dark");
    expect(getThemePreference()).toBe("dark");
  });
});

describe("resolveTheme", () => {
  it("volgt bij 'system' de OS-voorkeur", () => {
    expect(resolveTheme("system")).toBe("light");
    systemDark = true;
    expect(resolveTheme("system")).toBe("dark");
  });

  it("expliciete keuzes blijven staan, wat het OS ook zegt", () => {
    systemDark = true;
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
  });
});

describe("applyTheme / setThemePreference", () => {
  it("zet data-theme op <html> en werkt de theme-color-meta bij", () => {
    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(
      document.querySelector('meta[name="theme-color"]')?.getAttribute("content"),
    ).toBe(THEME_COLOR.dark);

    applyTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(
      document.querySelector('meta[name="theme-color"]')?.getAttribute("content"),
    ).toBe(THEME_COLOR.light);
  });

  it("setThemePreference bewaart de keuze én past haar direct toe", () => {
    setThemePreference("dark");
    expect(window.localStorage.getItem("theme")).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});

describe("watchSystemTheme", () => {
  it("schakelt live mee met het OS zolang de voorkeur 'system' is", () => {
    setThemePreference("system");
    const stop = watchSystemTheme();
    systemDark = true;
    fireSystemChange();
    expect(document.documentElement.dataset.theme).toBe("dark");
    stop();
  });

  it("negeert OS-wissels bij een expliciete keuze", () => {
    setThemePreference("light");
    const stop = watchSystemTheme();
    systemDark = true;
    fireSystemChange();
    expect(document.documentElement.dataset.theme).toBe("light");
    stop();
  });
});

// De themekleur van de browserbalk staat noodgedwongen twee keer in de app:
// hier in THEME_COLOR, en in het inline script van index.html dat vóór de
// eerste paint draait (en dus geen module kan importeren). Het commentaar in
// beide bestanden vroeg om ze in sync te houden; sinds #1074 doet deze test
// dat, want zo'n verzoek is geen garantie — na de herijking stond de donkere
// kleur in index.html nog op de oude zijbalk-tint.
describe("themekleur van de browserbalk", () => {
  // Vitest draait vanuit de projectroot; import.meta.url is er onder jsdom
  // geen file:-URL, dus readFileSync krijgt een pad in plaats van een URL.
  const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");

  it("index.html gebruikt exact de kleuren uit THEME_COLOR", () => {
    const script = /dark \? "(#[0-9a-f]{6})" : "(#[0-9a-f]{6})"/.exec(html);
    expect(script, "inline theme-color-script niet gevonden").not.toBeNull();
    expect(script![1]).toBe(THEME_COLOR.dark);
    expect(script![2]).toBe(THEME_COLOR.light);
  });

  it("de statische meta-tag draagt de lichte kleur", () => {
    const meta = /<meta name="theme-color" content="(#[0-9a-f]{6})"/.exec(html);
    expect(meta, "statische theme-color-meta niet gevonden").not.toBeNull();
    expect(meta![1]).toBe(THEME_COLOR.light);
  });
});
