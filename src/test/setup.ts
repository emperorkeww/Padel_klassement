// Voegt jest-dom matchers toe (toBeInTheDocument, toHaveTextContent, ...).
// Geladen via `setupFiles` in vite.config.ts.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { invalidateAll } from "../lib/queryCache";

// Node 22+ definieert een eigen globale localStorage die zonder
// --localstorage-file geen werkende methodes heeft; die wint het van jsdom's
// implementatie. Wijs de global expliciet naar de jsdom-storage zodat code
// met een kaal `localStorage.` in tests gewoon werkt.
if (typeof window !== "undefined" && window.localStorage) {
  try {
    Object.defineProperty(globalThis, "localStorage", {
      value: window.localStorage,
      configurable: true,
      writable: true,
    });
  } catch {
    /* al goed geconfigureerd */
  }
}

// De querycache is module-level; tussen tests legen zodat elke test zijn
// eigen (mock)data ziet in plaats van een hit uit de vorige test.
afterEach(() => invalidateAll());
