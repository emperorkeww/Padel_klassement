// Voegt jest-dom matchers toe (toBeInTheDocument, toHaveTextContent, ...).
// Geladen via `setupFiles` in vite.config.ts.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { invalidateAll } from "@/lib/supabase/queryCache";

// Node 22+ definieert een eigen globale localStorage die zonder
// --localstorage-file geen werkende methodes heeft (getItem/setItem zijn geen
// functies) en die jsdom's implementatie overschaduwt. Is de actieve storage
// kreupel, vervang hem dan door een simpele map-backed shim, zodat code met een
// kaal `localStorage.` in tests echt kan lezen/schrijven/wissen.
function installStorageShim() {
  const store = new Map<string, string>();
  const shim: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    key: (i) => [...store.keys()][i] ?? null,
    removeItem: (k) => void store.delete(k),
    setItem: (k, v) => void store.set(k, String(v)),
  };
  for (const target of [globalThis, window]) {
    try {
      Object.defineProperty(target, "localStorage", {
        value: shim,
        configurable: true,
        writable: true,
      });
    } catch {
      /* niet te herdefiniëren — negeer */
    }
  }
}

if (typeof localStorage === "undefined" || typeof localStorage.setItem !== "function") {
  installStorageShim();
}

// De querycache is module-level; tussen tests legen zodat elke test zijn
// eigen (mock)data ziet in plaats van een hit uit de vorige test. Ook de
// localStorage wissen: sinds #462 persisteren o.a. match-concepten daarheen, en
// een achtergebleven concept zou de volgende test een "hervatte" sheet geven.
afterEach(() => {
  invalidateAll();
  try {
    localStorage.clear();
  } catch {
    /* geen storage — negeer */
  }
});
