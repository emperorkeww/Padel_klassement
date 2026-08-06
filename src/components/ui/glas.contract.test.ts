import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Het glas-contract (#1062).
 *
 * Wat dit materiaal veilig maakt, staat in CSS en niet in TypeScript: de
 * terugval zonder backdrop-filter, de voorkeuren voor minder transparantie en
 * meer contrast, en de afspraak dat er niets duurs geanimeerd wordt. Die
 * regels zijn met een render niet te controleren — jsdom rekent geen CSS uit —
 * dus leest deze suite het stylesheet als tekst. Zelfde aanpak als de
 * premium-glans op de FUT-kaart (#773).
 */

const css = readFileSync("src/components/ui/glas.css", "utf8");

/** Het blok achter een selector of at-rule, met gebalanceerde accolades. */
function blok(kop: string): string {
  const start = css.indexOf(kop);
  if (start === -1) throw new Error(`blok ontbreekt: ${kop}`);
  let i = css.indexOf("{", start);
  let diepte = 0;
  const begin = i;
  for (; i < css.length; i++) {
    if (css[i] === "{") diepte++;
    else if (css[i] === "}") {
      diepte--;
      if (diepte === 0) return css.slice(begin + 1, i);
    }
  }
  throw new Error(`blok niet gesloten: ${kop}`);
}

function aantal(bron: string, naald: RegExp): number {
  return bron.match(naald)?.length ?? 0;
}

describe("glas.css", () => {
  it("valt terug op een dicht vlak zonder backdrop-filter", () => {
    const terugval = blok("@supports not (");
    expect(terugval).toMatch(/background:\s*var\(--glas-vast\)/);
    // Geen halftransparant vlak zonder blur: dan zou de tekst van de pagina
    // eronder dwars door de inhoud heen lezen.
    expect(terugval).toMatch(/border-color:\s*var\(--line-strong\)/);
  });

  it("respecteert minder transparantie en meer contrast", () => {
    for (const kop of [
      "@media (prefers-reduced-transparency: reduce)",
      "@media (prefers-contrast: more)",
    ]) {
      const regels = blok(kop);
      expect(regels).toMatch(/background:\s*var\(--glas-vast\)/);
      expect(regels).toMatch(/backdrop-filter:\s*none/);
      expect(regels).toMatch(/display:\s*none/);
    }
  });

  it("animeert de dure eigenschappen niet", () => {
    // box-shadow mag: dat is één overgang bij hover, geen doorlopende
    // beweging. backdrop-filter en filter mogen nooit — die kosten per frame
    // een nieuwe blur van alles wat achter het vlak ligt.
    const overgangen = css.match(/transition:[^;]+;/g) ?? [];
    expect(overgangen.length).toBeGreaterThan(0);
    for (const regel of overgangen) {
      expect(regel).not.toMatch(/backdrop-filter|filter|blur|background/);
    }
    // Er draait niets doorlopend rond; een blijvend bewegend glasvlak zou op
    // elke scroll opnieuw geschilderd worden.
    expect(css).not.toMatch(/@keyframes|animation:/);
  });

  it("beweegt alleen mét bewegingsvoorkeur", () => {
    const beweging = blok("@media (prefers-reduced-motion: no-preference)");
    expect(aantal(css, /transition:/g)).toBe(aantal(beweging, /transition:/g));
  });

  it("knipt alleen wanneer er een vorm is gekozen", () => {
    // De onderbalk heeft een bal die bewust boven de balk uitsteekt; overflow
    // op `.glas` zelf zou die weghalen.
    expect(blok("\n.glas {")).not.toMatch(/overflow/);
    expect(blok("\n.glas--pil {")).toMatch(/overflow:\s*hidden/);
    expect(blok("\n.glas--paneel {")).toMatch(/overflow:\s*hidden/);
  });

  it("houdt de rand overeind waar mask-compositing ontbreekt", () => {
    // De verlopende refractierand zit ín het @supports-blok; de gewone border
    // op `.glas` is wat er overblijft als dat niet kan.
    expect(blok("\n.glas {")).toMatch(/border:\s*1px solid/);
    expect(blok("@supports ((mask-composite: exclude)")).toMatch(
      /mask-composite:\s*exclude/,
    );
  });
});
