import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

// Bundelbudget (#732). De illustraties en audio kwamen als ruwe AI-output
// binnen — 33 MB in dist/assets, waarvan 21 MB alleen al aan avatars die op
// 66px getoond worden. Na de conversie naar WebP en mono-audio zit dat rond de
// 6 MB; deze test bewaakt dat het niet stilletjes terugkruipt.
//
// Draait alleen ná een build; CI bouwt vóór `npm test`.
// Nieuwe assets comprimeren met: node scripts/optimize-assets.mjs <bestand>
//
// Het pad via een variabele opbouwen: de letterlijke vorm
// `new URL("…", import.meta.url)` herkent Vite als asset-referentie en
// herschrijft hij naar een http-URL, waar fileURLToPath op stukloopt.
const pad = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const ASSETS = pad("../../../dist/assets");

// Ruime marge boven de huidige ~8,4 MB: genoeg lucht voor een nieuwe route of
// een handvol avatars, krap genoeg om één ongecomprimeerde 2 MB-PNG te vangen.
// Verhoogd van 8 naar 9 bij de pias-breakout: de zeven kaarteffect-masters zijn
// samen ~2,0 MB en zijn de enige structurele groei sinds #732. Ze staan al op
// hun compressiegrens (WebP met alpha, 600–1024 px breed); zakt er nog meer
// resolutie af, dan wordt het artwork zichtbaar zacht op een 450px-kaart.
const TOTAAL_MAX_MB = 9;
// Bovengrens per bestand: de twee audiofragmenten (2,14 MB) zijn de zwaarste
// die hier thuishoren.
const BESTAND_MAX_MB = 2.5;

const MB = (bytes: number) => bytes / 1024 / 1024;

describe.skipIf(!existsSync(ASSETS))("bundelbudget dist/assets", () => {
  const bestanden = existsSync(ASSETS)
    ? readdirSync(ASSETS).map((naam) => ({
        naam,
        mb: MB(statSync(`${ASSETS}/${naam}`).size),
      }))
    : [];

  it("blijft als geheel onder het budget", () => {
    const totaal = bestanden.reduce((som, b) => som + b.mb, 0);
    expect(bestanden.length).toBeGreaterThan(0);
    expect(totaal).toBeLessThan(TOTAAL_MAX_MB);
  });

  it("bevat geen enkel bestand boven de bovengrens", () => {
    const teZwaar = bestanden
      .filter((b) => b.mb > BESTAND_MAX_MB)
      .map((b) => `${b.naam} (${b.mb.toFixed(2)} MB)`);
    expect(teZwaar).toEqual([]);
  });
});
