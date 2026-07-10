import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  applyTheme,
  getThemePreference,
  resolveTheme,
  setThemePreference,
  watchSystemTheme,
} from "./theme";

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
    ).toBe("#121814");

    applyTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(
      document.querySelector('meta[name="theme-color"]')?.getAttribute("content"),
    ).toBe("#0c8a5f");
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
