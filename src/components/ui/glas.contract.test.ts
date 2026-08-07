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

  it("legt geen positie op aan een vlak dat er al een heeft", () => {
    // glas.css komt ná ui.css in de cascade. Zou `.glas` hier met gewicht
    // `position: relative` zetten, dan viel de zwevende "Jouw positie"-knop
    // (fixed) gewoon terug in de pagina. Vandaar `:where`, dat niets weegt.
    expect(blok("\n.glas {")).not.toMatch(/position:/);
    expect(blok("\n:where(.glas) {")).toMatch(/position:\s*relative/);
  });

  it("houdt de decoratieve lagen achter de inhoud", () => {
    // De meeste vlakken dragen alleen de classes en hebben geen
    // `.glas__inhoud`; hun tekst staat er los in. Een laag op z-index -1
    // schildert binnen de eigen stapelcontext wél over de achtergrond van het
    // vlak, maar niet over die tekst.
    expect(blok(".glas::after {")).toMatch(/z-index:\s*-1/);
    expect(blok(".glas::before {")).toMatch(/z-index:\s*-1/);
  });

  it("laat het thema over de hoeveelheid materiaal gaan (#1083)", () => {
    // Een custom property op het element wint van dezelfde property op :root.
    // Zolang elke variant hier een kaal getal neerzette, kon een thema de
    // dekking en de blur niet meer bijstellen — de donkere
    // `--glas-dekking: 0.8` uit #1062 kwam nergens aan en donker draaide op de
    // lichte dekking. Varianten mogen alleen nog een verhouding op de
    // basis-tokens uitdrukken.
    for (const variant of ["subtiel", "standaard", "sterk", "interactief"]) {
      const regels = blok(`\n.glas--${variant} {`);
      // Alle drie, ook waar de basiswaarde ongewijzigd blijft: custom
      // properties érven, dus een glasvlak ín een ander glasvlak pikt anders de
      // waarde van zijn ouder op. Zo draaide de keuzebaan in het match-sheet op
      // de 185% saturatie van het sheet eromheen in plaats van op de 165% van
      // het thema (#1083).
      for (const eigenschap of ["dekking", "blur", "saturatie"]) {
        const waarde = regels.match(
          new RegExp(`--glas-${eigenschap}:\\s*([^;]+);`),
        );
        expect(waarde, `${variant} zet --glas-${eigenschap} niet`).not.toBeNull();
        expect(
          waarde![1],
          `${variant} moet --glas-${eigenschap} van de basis afleiden`,
        ).toMatch(new RegExp(`var\\(--glas-${eigenschap}-basis\\)`));
      }
    }
  });

  it("geeft een scrollend vlak een verlopende rand en een contour (#1083)", () => {
    // `.glas--scrollbaar` moet ::before/::after uitzetten — absolute lagen
    // schuiven mee met de inhoud — maar de vervanging was één uniforme ring op
    // de zwakste randwaarde, en omdat deze box-shadow die van `.glas` volledig
    // overschrijft verdween ook de buitenhaarlijn. Het sheet was daarmee het
    // enige grote vlak zonder verlopende rand en zonder contour.
    const regels = blok("\n.glas--scrollbaar {");
    // De buitencontour: zonder deze lijn zweeft een licht vlak op een lichte
    // pagina nergens meer in.
    expect(regels).toMatch(/\n\s*0 0 0 1px rgb\(var\(--glas-diep\)/);
    // Twee hoekschaduwen op de sterke randwaarde, waar ::before het licht ook
    // zet: linksboven en rechtsonder.
    expect(aantal(regels, /inset -?\d+px[^,]*var\(--glas-rand-hoog\)/g)).toBe(2);
    // En de flanken op de zwakke waarde.
    expect(regels).toMatch(/inset 0 0 0 1px var\(--glas-rand-laag\)/);
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
