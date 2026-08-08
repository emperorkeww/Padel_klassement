// Houdt EDGE_FUNCTIES eerlijk tegenover de bron (#1049).
//
// Het manifest is met de hand onderhouden, want "is deze sleutel echt nodig of
// heeft hij een bruikbare standaard" is een oordeel dat je niet uit een
// `Deno.env.get`-aanroep afleidt. Alles wat wél mechanisch vast te stellen is,
// wordt hier afgeleid en vergeleken — inclusief de regel die het hele issue
// aftrapte: wie zich met CRON_SECRET beveiligt, moet verify_jwt = false hebben.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { EDGE_FUNCTIES, PLATFORM_SECRETS } from "./edgeFuncties.ts";

// Paden vanaf de projectroot: onder vitest is import.meta.url geen file-URL,
// dus new URL(..., import.meta.url) werkt hier niet (zie mail-templates.test.mjs).
const functiesDir = join(process.cwd(), "supabase/functions");
const configPad = join(process.cwd(), "supabase/config.toml");

/** De functiemappen zoals `supabase functions deploy` ze zou vinden. */
function functieMappen(): string[] {
  return readdirSync(functiesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
    .map((e) => e.name)
    .sort();
}

/**
 * `[functions.x] verify_jwt = ...` uit config.toml. Een function die er niet in
 * staat, krijgt de platformstandaard `true` — precies het gat waar
 * appeal-deadline in viel.
 */
function verifyJwtUitConfig(): Map<string, boolean> {
  const toml = readFileSync(configPad, "utf8");
  const kaart = new Map<string, boolean>();
  const re = /^\[functions\.([a-z0-9-]+)\]\s*$([\s\S]*?)(?=^\[|\Z)/gm;
  for (const m of toml.matchAll(re)) {
    const blok = m[2];
    const vlag = /^\s*verify_jwt\s*=\s*(true|false)\s*$/m.exec(blok);
    if (vlag) kaart.set(m[1], vlag[1] === "true");
  }
  return kaart;
}

/**
 * Alle `Deno.env.get("X")` die een function bereikt: in zijn eigen index.ts en
 * in de _shared-helpers die hij (transitief) importeert. Zonder dat tweede stuk
 * lijken generate-*-avatar geen enkele sleutel nodig te hebben, terwijl
 * aiPortretHandler.ts er OPENAI_API_KEY én CRON_SECRET uit leest.
 */
function envVarsVan(functie: string): Set<string> {
  const gezien = new Set<string>();
  const gevonden = new Set<string>();

  const bezoek = (pad: string): void => {
    if (gezien.has(pad)) return;
    gezien.add(pad);

    let bron: string;
    try {
      bron = readFileSync(pad, "utf8");
    } catch {
      return; // npm:/jsr:-import of iets anders dat niet op schijf staat
    }

    for (const m of bron.matchAll(/Deno\.env\.get\(\s*["']([A-Z0-9_]+)["']/g)) {
      gevonden.add(m[1]);
    }
    for (const m of bron.matchAll(/from\s+["'](\.\.?\/[^"']+)["']/g)) {
      bezoek(resolve(dirname(pad), m[1]));
    }
  };

  bezoek(join(functiesDir, functie, "index.ts"));
  return gevonden;
}

const config = verifyJwtUitConfig();

describe("EDGE_FUNCTIES", () => {
  it("dekt precies de functiemappen die gedeployd worden", () => {
    expect(EDGE_FUNCTIES.map((f) => f.naam).sort()).toEqual(functieMappen());
  });

  it.each(EDGE_FUNCTIES)("$naam: verifyJwt klopt met config.toml", (f) => {
    // Geen entry in config.toml => platformstandaard true.
    expect(config.get(f.naam) ?? true).toBe(f.verifyJwt);
  });

  it.each(EDGE_FUNCTIES)("$naam: cronGeheim klopt met de bron", (f) => {
    expect(envVarsVan(f.naam).has("CRON_SECRET")).toBe(f.cronGeheim);
  });

  // Dít is de check die #1049 aftrapte. Een function die zich in de handler met
  // x-cron-secret beveiligt, wordt door de platform-JWT-gate onbereikbaar: de
  // 401 valt vóór de handler en de aanroeper heeft geen JWT om mee te sturen.
  it.each(EDGE_FUNCTIES.filter((f) => f.cronGeheim))(
    "$naam: beveiligt zich met CRON_SECRET en staat dus op verify_jwt = false",
    (f) => {
      expect(config.get(f.naam)).toBe(false);
    },
  );

  it.each(EDGE_FUNCTIES)("$naam: noemt geen sleutel die nergens gelezen wordt", (f) => {
    const echt = envVarsVan(f.naam);
    for (const sleutel of [...f.vereist, ...f.optioneel]) {
      expect(echt.has(sleutel), `${f.naam} noemt ${sleutel}`).toBe(true);
    }
  });

  it.each(EDGE_FUNCTIES)("$naam: vergeet geen sleutel die hij wél leest", (f) => {
    const genoemd = new Set([
      ...f.vereist,
      ...f.optioneel,
      ...PLATFORM_SECRETS,
    ]);
    for (const sleutel of envVarsVan(f.naam)) {
      expect(genoemd.has(sleutel), `${f.naam} leest ${sleutel} ongenoemd`).toBe(
        true,
      );
    }
  });
});
