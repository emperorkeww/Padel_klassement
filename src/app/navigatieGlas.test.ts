import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * De balken en het glasmateriaal (#1062).
 *
 * DashboardLayout in een test monteren kost het hele mock-apparaat van
 * DashboardLayout.test.tsx, en wat hier gecontroleerd moet worden is toch niet
 * te renderen: jsdom rekent geen CSS uit. Dus leest deze suite de bron. Zelfde
 * aanpak als glas.contract.test.ts en FutKaartGlans.test.tsx (#773).
 */

const tsx = readFileSync("src/app/DashboardLayout.tsx", "utf8");
const css = readFileSync("src/app/DashboardLayout.css", "utf8");

/** Het blok achter een selector, met gebalanceerde accolades. */
function blok(kop: string): string {
  const start = css.indexOf(kop);
  if (start === -1) throw new Error(`blok ontbreekt: ${kop}`);
  let i = css.indexOf("{", start);
  const begin = i;
  let diepte = 0;
  for (; i < css.length; i++) {
    if (css[i] === "{") diepte++;
    else if (css[i] === "}") {
      diepte--;
      if (diepte === 0) return css.slice(begin + 1, i);
    }
  }
  throw new Error(`blok niet gesloten: ${kop}`);
}

describe("navigatiebalken op glas", () => {
  it("geeft beide balken hetzelfde materiaal", () => {
    for (const balk of ["topbar", "tabbar"]) {
      expect(tsx).toMatch(
        new RegExp(`"${balk} glas glas--sterk glas--balk glas--levend"`),
      );
    }
  });

  it("laat het licht op beide balken de scrollpositie volgen (#1083)", () => {
    // Het aanwijzer-hooglicht hangt aan hover en bestaat op een telefoon dus
    // niet, terwijl dit een mobile-first app is. Deze twee balken staan altijd
    // in beeld en de pagina schuift eronderdoor: daar is de scrollpositie een
    // bewegingsbron die élk apparaat heeft. `glas--levend` alleen zou een
    // stilstaande glans geven; de hook laat 'm meelopen.
    expect(tsx).toMatch(/const topbarRef = useGlasScrollLicht<HTMLElement>\(\)/);
    expect(tsx).toMatch(/const tabbarRef = useGlasScrollLicht<HTMLElement>\(\)/);
    expect(tsx).toMatch(/ref=\{topbarRef\}/);
    expect(tsx).toMatch(/ref=\{tabbarRef\}/);
  });

  it("laadt glas.css vóór de eigen stylesheet", () => {
    // De balken zetten een paar dingen van het materiaal recht; dat werkt
    // alleen als hun eigen regels later in de cascade staan.
    expect(tsx.indexOf('import "@/ui/glas.css"')).toBeGreaterThan(-1);
    expect(tsx.indexOf('import "@/ui/glas.css"')).toBeLessThan(
      tsx.indexOf('import "./DashboardLayout.css"'),
    );
  });

  it("laat de blur aan het materiaal over", () => {
    // De topbalk had zijn eigen blur; die hoort nu bij .glas, anders staan er
    // twee definities van hetzelfde die uit elkaar kunnen lopen.
    expect(css).not.toMatch(/backdrop-filter/);
  });

  it("houdt de blur op de vaste balken bewust laag", () => {
    // Beide balken blijven staan tijdens het scrollen en worden dus elk frame
    // opnieuw geblurd; daar hoort niet de volle 22px van `sterk` bij.
    for (const balk of ["\n  .topbar {", "\n  .tabbar {"]) {
      expect(blok(balk)).toMatch(/--glas-blur:\s*14px/);
      // En een dichte terugval in de kleur van de balk, niet van een kaart.
      expect(blok(balk)).toMatch(/--glas-vast:\s*var\(--sidebar-bg\)/);
    }
  });

  it("laat elke balk maar één rand houden", () => {
    // .glas--balk haalt de zijranden weg; de rand naar de pagina toe zet de
    // balk zelf, en de andere moet expliciet uit.
    expect(blok("\n  .topbar {")).toMatch(/border-top:\s*0/);
    expect(blok("\n  .topbar {")).toMatch(/border-bottom:\s*1px solid/);
    expect(blok("\n  .tabbar {")).toMatch(/border-bottom:\s*0/);
    expect(blok("\n  .tabbar {")).toMatch(/border-top:\s*1px solid/);
  });

  it("laat de onderbalk naar boven schaduwen", () => {
    expect(blok("\n  .tabbar {")).toMatch(/--glas-schaduw:\s*var\(--shadow-up\)/);
  });
});
