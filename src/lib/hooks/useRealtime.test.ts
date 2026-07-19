import { describe, it, expect } from "vitest";
import { CACHE_PREFIXES } from "@/lib/hooks/useRealtime";

// Alle bronbestanden als ruwe tekst (Vite-glob, geen node:fs nodig). Tests zelf
// sluiten we uit: die bevatten `useRealtime("…")` in commentaar/regex en zouden
// de scan vervuilen.
const sources = import.meta.glob("/src/**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/** Elke tabelnaam waarop de app via useRealtime("<tabel>", …) abonneert. */
function subscribedTables(): Set<string> {
  const tables = new Set<string>();
  const re = /useRealtime\(\s*"([^"]+)"/g;
  for (const [path, src] of Object.entries(sources)) {
    if (/\.test\.tsx?$/.test(path)) continue;
    for (const m of src.matchAll(re)) tables.add(m[1]);
  }
  return tables;
}

describe("CACHE_PREFIXES ↔ useRealtime-abonnementen", () => {
  // Vangnet tegen een stille herhaling van #467: een tabel-hernoeming die de
  // realtime-cache-invalidatie tot een no-op maakt. Elke tabel waarop de app
  // abonneert moet een niet-lege prefixlijst hebben, anders invalideert een
  // realtime-event niets en zien andere clients verouderde data.
  it("dekt elke geabonneerde tabel met minstens één cache-prefix", () => {
    const tables = subscribedTables();
    // Sanity: de scan vindt daadwerkelijk abonnementen.
    expect(tables.size).toBeGreaterThan(0);

    const missing = [...tables].filter((t) => !CACHE_PREFIXES[t]?.length);
    expect(
      missing,
      `tabellen zonder cache-prefix: ${missing.join(", ")}`,
    ).toEqual([]);
  });
});
