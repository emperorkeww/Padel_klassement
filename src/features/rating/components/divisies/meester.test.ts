import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { ORNAMENT_VIEWBOX } from "../futKaartOrnamenten";
import { DIVISIE_MEESTER } from "./meester";
import type { DivisieDeel } from "./divisieKaart";

// De stylesheets als tekst, voor de synctest onderaan. Bewust via node:fs en
// niet via Vite's ?raw: Vitest kortsluit CSS-imports (css: false) op een lege
// string, óók met de raw-query, dus dan zou de test stil niets vergelijken.
// Zelfde truc als de editie-synctest in futKaartCanvas.test.ts.
const lees = (pad: string) =>
  readFileSync(fileURLToPath(new URL(pad, import.meta.url)), "utf8");
const MEESTER_CSS = lees("./meester.css");
const FUT_CSS = lees("../FutKaart.css");
/** Dezelfde stylesheet zonder commentaar — de toelichtingen hieronder nóemen
 *  regels die dit bestand juist níet mag declareren (--schild, ::after), dus
 *  een "staat er niet in"-check moet naar de code kijken, niet naar het
 *  verhaal erboven. */
const MEESTER_REGELS = MEESTER_CSS.replace(/\/\*[\s\S]*?\*\//g, "");

const REGISTER = DIVISIE_MEESTER.register!;
const ACHTER = DIVISIE_MEESTER.achter ?? [];
const VOOR = DIVISIE_MEESTER.voor ?? [];
const DELEN: readonly DivisieDeel[] = [...ACHTER, ...VOOR];

/* ------------------------------- padmeetkunde ------------------------------ */

/** Punten op een pad. Anders dan de generieke ornamenttest leest deze parser
 *  per commando i.p.v. de getallen op een rij: de medaille en de motiefringen
 *  staan als `A`-bogen in het pad (`DivisieDeel` kent alleen paden, en een
 *  cirkel als polylijn zou op de veldmaat kantig worden), en daar zijn de
 *  zeven parameters géén x/y-paren.
 *
 *  `omhullend` telt een boog mee als het vierkant eindpunt ± r: ruimer dan de
 *  boog zelf, dus elke "past binnen"-uitspraak blijft conservatief waar — wat
 *  zó past, past écht. Zonder die vlag komen alleen de punten terug die écht
 *  op het pad liggen; dát is wat de symmetriecheck nodig heeft. */
function punten(pad: string, omhullend = false): [number, number][] {
  const uit: [number, number][] = [];
  for (const [, cmd, rest] of pad.matchAll(/([MLCAZ])([^MLCAZ]*)/gi)) {
    const n = rest.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
    if (cmd.toUpperCase() === "A") {
      // rx ry rotatie grootBoog sweep x y — per zeventallen.
      for (let i = 0; i + 6 < n.length; i += 7) {
        const [rx, ry, , , , x, y] = n.slice(i, i + 7);
        uit.push([x, y]);
        if (omhullend) uit.push([x - rx, y - ry], [x + rx, y + ry]);
      }
    } else {
      for (let i = 0; i + 1 < n.length; i += 2) uit.push([n[i], n[i + 1]]);
    }
  }
  return uit;
}

function grenzen(paden: readonly string[]) {
  const p = paden.flatMap((d) => punten(d, true));
  return {
    xMin: Math.min(...p.map((q) => q[0])),
    xMax: Math.max(...p.map((q) => q[0])),
    yMin: Math.min(...p.map((q) => q[1])),
    yMax: Math.max(...p.map((q) => q[1])),
  };
}

/** De linkerrand van het schild op hoogte `v`, in kaart-units — dezelfde
 *  benadering als futKaartOrnamenten.test.ts: rechte zijkant tot de taille op
 *  v = 0,60 · 139, dan naar (0,135 · 100 · 0,838 · 139) en zo naar de punt.
 *  Een deel ligt "buiten de kaart" wanneer het links van deze rand valt. */
function schildLinkerrand(v: number): number {
  const t = v / 139;
  if (t <= 0.6) return 0;
  if (t <= 0.838) return ((t - 0.6) / 0.238) * 13.5;
  if (t <= 0.972) return 13.5 + ((t - 0.838) / 0.134) * 30;
  return 43.5 + ((t - 0.972) / 0.028) * 6.5;
}

/* --------------------------------- geometrie -------------------------------- */

describe("Forever second — ornamentgeometrie (#710)", () => {
  it("bevat geen enkele NaN, in geen enkel pad", () => {
    // De tak, de blaadjes en de bracket-spiegeling zijn gegenereerd; één
    // ongedefinieerde tussenstap levert een pad op dat de browser stil laat
    // vallen i.p.v. te klagen. Vandaar dat dit het eerste is wat we meten.
    for (const deel of DELEN)
      expect(deel.d, `NaN in ${deel.d.slice(0, 40)}…`).not.toMatch(/NaN/);
    for (const pad of DIVISIE_MEESTER.motief!.paden)
      expect(pad.d, `NaN in motief ${pad.d.slice(0, 40)}…`).not.toMatch(/NaN/);
    // En de gradient-assen, die dezelfde kaart-units delen.
    for (const g of DIVISIE_MEESTER.gradienten ?? [])
      for (const getal of g.as) expect(Number.isFinite(getal)).toBe(true);
  });

  it("past binnen de ornament-viewBox, ook ná spiegeling", () => {
    // De ornamentlaag is de énige laag die buiten de schildclip valt; loopt een
    // pad buiten de viewBox, dan snijdt de browser hem stil af — en de poster
    // niet, dus dan lopen kaart en export uiteen precies waar het opvalt.
    const [vx, vy, vw, vh] = ORNAMENT_VIEWBOX.split(" ").map(Number);
    const g = grenzen(DELEN.map((d) => d.d));
    expect(Math.min(g.xMin, 100 - g.xMax)).toBeGreaterThan(vx);
    expect(Math.max(g.xMax, 100 - g.xMin)).toBeLessThan(vx + vw);
    expect(g.yMin).toBeGreaterThan(vy);
    expect(g.yMax).toBeLessThan(vy + vh);
  });

  it("houdt élk gespiegeld deel links van de as", () => {
    // `spiegel: true` tekent het deel én zijn spiegelbeeld om u=50. Een deel
    // dat de as passeert overlapt daar dus zijn eigen kopie: de lauwertakken
    // zouden een gesloten krans vormen (een overwinningskrans — precies het
    // signaal dat deze divisie níet mag geven) en het lint zou verdubbelen.
    for (const deel of DELEN.filter((d) => d.spiegel)) {
      const g = grenzen([deel.d]);
      expect(g.xMax, `${deel.d.slice(0, 34)}… kruist de as`).toBeLessThan(50);
    }
    // En de twee takken houden een zichtbaar gat: de binnenste punten liggen
    // op u≈49,8 (het lint) en de takken zelf blijven nog een stuk verder weg.
    const takken = grenzen([
      DIVISIE_MEESTER.voor!.find((d) => d.d.includes("Z"))!.d,
    ]);
    expect(takken.xMax).toBeLessThan(50);
  });

  it("de delen op de as zijn zélf symmetrisch — op het geschreven cijfer na", () => {
    // Crest en medaille dragen geen `spiegel`-vlag: zij staan op u=50 en
    // moeten die symmetrie dus in het pad zelf hebben. Een handmatige tik in
    // één helft valt op de kaart meteen op — de plaquette staat scheef.
    const symmetrisch = (pad: string) => {
      const p = punten(pad);
      return p.every(([x, y]) =>
        p.some(
          (q) => Math.abs(q[0] - (100 - x)) < 0.35 && Math.abs(q[1] - y) < 0.35,
        ),
      );
    };
    const opDeAs = VOOR.filter((d) => !d.spiegel);
    expect(opDeAs.length).toBeGreaterThan(3);
    const scheef = opDeAs.filter((d) => !symmetrisch(d.d));
    // Precies één uitzondering, en met reden: de `2` in de medaille is een
    // geschreven cijfer, en een glyph is nooit zijn eigen spiegelbeeld. Die
    // moet dan wél gecentreerd op de as staan, anders hangt het cijfer scheef
    // in de schijf.
    expect(scheef.map((d) => d.d.slice(0, 12))).toEqual(["M 46.6 120.8"]);
    const g = grenzen([scheef[0].d]);
    expect((g.xMin + g.xMax) / 2).toBeCloseTo(50, 0);
  });

  it("de vóór-laag steekt écht buiten de schildrand uit", () => {
    // De `voor`-laag bestaat alleen omdat een crest in de bovenrand of een
    // medaillon in de punt achter het schild half zou verdwijnen. Steekt er
    // niets uit, dan is die extra laag zinloos en horen de delen achter de
    // kaart. Drie richtingen, elk met zijn eigen bewijs:
    const g = grenzen(VOOR.map((d) => d.d));
    // …boven de kaart (de `II`-crest komt met zijn top uit de inkeping),
    expect(g.yMin).toBeLessThan(-1.5);
    // …onder de schildpunt (de zwaluwstaart van het lint),
    expect(g.yMax).toBeGreaterThan(141);
    // …en naast de zijrand (kapiteel en buitenste lauwerblaadjes).
    expect(g.xMin).toBeLessThan(-1);

    // Bovendien: minstens één deel valt op zijn eigen hoogte links van de
    // échte schildrand. Onder de taille buigt die naar binnen, dus daar is
    // "buiten de kaart" iets anders dan u < 0.
    const buiten = VOOR.flatMap((d) => punten(d.d)).filter(
      ([x, y]) => y > 83 && x < schildLinkerrand(y) - 1,
    );
    expect(buiten.length).toBeGreaterThan(10);
  });

  it("het bracket-watermerk blijft in zijn eigen 100 × 100-viewBox", () => {
    // Het motief rekent in zijn eigen stelsel (zie divisieKaart.ts) en wordt
    // door de CSS op het vlak geschaald: buiten de doos = stil weggeknipt.
    const g = grenzen(DIVISIE_MEESTER.motief!.paden.map((p) => p.d));
    expect(g.xMin).toBeGreaterThanOrEqual(0);
    expect(g.xMax).toBeLessThanOrEqual(100);
    expect(g.yMin).toBeGreaterThanOrEqual(0);
    expect(g.yMax).toBeLessThanOrEqual(100);
    // En beide bracket-helften zijn elkaars spiegelbeeld — het beeld wijst van
    // twee kanten naar dezelfde laatste wedstrijd.
    const p = grenzen(DIVISIE_MEESTER.motief!.paden.map((q) => q.d));
    expect(100 - p.xMax).toBeCloseTo(p.xMin, 5);
  });

  it("elke `url(#…)`-vulling verwijst naar een gradient die bestaat", () => {
    // De gradients staan in `gradienten` en worden door FutDivisieDefs als
    // <defs> gerenderd; een typefout in een id levert in de DOM een zwart vlak
    // op en op canvas juist niet — precies het soort verschil dat pas op de
    // gedeelde poster opvalt.
    const ids = new Set((DIVISIE_MEESTER.gradienten ?? []).map((g) => g.id));
    for (const deel of DELEN) {
      const m = /^url\(#(.+)\)$/.exec(deel.vulling ?? "");
      if (!m) continue;
      expect(ids.has(m[1]), `onbekende gradient ${m[1]}`).toBe(true);
    }
    // Andersom telt ook: een ongebruikte gradient is dode <defs> in élke kaart.
    const gebruikt = new Set(
      DELEN.map((d) => /^url\(#(.+)\)$/.exec(d.vulling ?? "")?.[1]).filter(
        Boolean,
      ),
    );
    for (const id of ids) expect(gebruikt.has(id), `${id} ongebruikt`).toBe(true);
  });
});

/* --------------------------- CSS ↔ register-synctest -------------------------- */

// De kleuren staan twee keer: als CSS-tokens (de kaart in de DOM) en als
// literals in het `register` (de deel-poster, die bewust niet van de live
// tokens leest — #125). Lopen ze uiteen, dan wijkt de export af van wat de
// speler ziet. Deze test leest meester.css in en houdt de twee gelijk.

/** Het `.fut-kaart--meester { … }`-blok met de kleurtokens. */
const TOKENBLOK = (() => {
  const m = /\.fut-kaart--meester\s*\{([^}]*)\}/.exec(MEESTER_CSS);
  expect(m, "blok .fut-kaart--meester niet gevonden in meester.css").not.toBeNull();
  return m![1];
})();

const token = (naam: string): string | null =>
  new RegExp(`${naam}:\\s*([^;]+);`).exec(TOKENBLOK)?.[1].trim() ?? null;

/** De waarde van één CSS-property binnen een selectorblok, met alle witruimte
 *  genormaliseerd — de gradients staan meerregelig in de bron. */
function regel(selector: string, prop: string): string {
  const blok = new RegExp(
    `${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`,
  ).exec(MEESTER_CSS);
  expect(blok, `${selector} niet gevonden in meester.css`).not.toBeNull();
  const m = new RegExp(`${prop}:\\s*([^;]+);`).exec(blok![1]);
  expect(m, `${prop} niet gevonden in ${selector}`).not.toBeNull();
  return m![1].replace(/\s+/g, " ").trim();
}

/** De getallen uit een lijst kleur/offset-paren, in bronvolgorde. */
const stops = (waarde: string) => [
  ...waarde.matchAll(/(#[0-9a-f]{6}|rgba?\([^)]*\)|transparent)\s+([\d.]+)%/gi),
].map(([, kleur, offset]) => [Number(offset) / 100, kleur] as const);

describe("Forever second — meester.css spiegelt het register (#710)", () => {
  it("inkt, zachte inkt en lijn", () => {
    expect(REGISTER.ink).toBe(token("--kaart-ink"));
    expect(REGISTER.inkSoft).toBe(token("--kaart-ink-soft"));
    expect(REGISTER.lijn).toBe(token("--kaart-lijn"));
  });

  it("vlak-gradient (hi/mid/lo)", () => {
    expect([...REGISTER.vlak]).toEqual([
      token("--kaart-hi"),
      token("--kaart-mid"),
      token("--kaart-lo"),
    ]);
    // Geen eigen --kaart-mid-positie in de CSS, dus de canvas-kant moet ook op
    // de gedeelde 56% blijven staan (kaartSkin vult die default in).
    expect(REGISTER.vlakMid).toBeUndefined();
  });

  it("frame-gradient, liner en keyline", () => {
    expect(stops(regel(".fut-kaart--meester .fut-kaart__zijde", "background"))).toEqual(
      REGISTER.frame.map(([o, k]) => [o, k]),
    );
    expect(regel(".fut-kaart--meester .fut-kaart__liner", "background")).toBe(
      REGISTER.liner,
    );
    expect(regel(".fut-kaart--meester .fut-kaart__keyline", "background")).toBe(
      REGISTER.keyline,
    );
  });

  it("de glansbaan: zelfde stops, zelfde spreiding", () => {
    const baan = stops(
      regel(".fut-kaart--meester .fut-kaart__vlak::before", "background"),
    );
    expect(baan.map(([o]) => o)).toEqual([0.4, 0.5, 0.6]);
    // `sheenSpreiding` ís de afstand van de kern naar de doorzichtige flanken.
    expect(REGISTER.sheenSpreiding).toBeCloseTo(baan[1][0] - baan[0][0], 6);
    expect(REGISTER.sheenSpreiding).toBeCloseTo(baan[2][0] - baan[1][0], 6);
    // De kleur is dezelfde, de dekking niet: de canvas-baan loopt over een
    // kortere gradient-as en leest daardoor breder en feller, dus #664 heeft
    // hem op 0,875 × de CSS-waarde gekalibreerd (0,32 → 0,28 in BASIS_SHEEN).
    // Diezelfde factor hoort hier te gelden, anders staat de poster feller dan
    // de kaart.
    const kern = /rgba\((\d+), (\d+), (\d+), ([\d.]+)\)/.exec(baan[1][1])!;
    const canvas = /rgba\((\d+), (\d+), (\d+), ([\d.]+)\)/.exec(REGISTER.sheen!)!;
    expect(canvas.slice(1, 4)).toEqual(kern.slice(1, 4));
    expect(Number(canvas[4])).toBeCloseTo(
      Math.round(Number(kern[4]) * 0.875 * 100) / 100,
      6,
    );
  });

  it("gloed: de gedeelde radial van .fut-kaart__vlak, letterlijk overgenomen", () => {
    // Deze kaart wil precies de basiswaarde, dus meester.css declareert hem
    // bewust niet — maar het register moet hem dan wél letterlijk kopiëren.
    // Verandert de gedeelde gloed in FutKaart.css, dan valt dat hier om.
    const basis = /120% 55% at 50% -6%,\s*(rgba\([^)]*\))/.exec(FUT_CSS);
    expect(basis, "gedeelde vlak-gloed niet gevonden in FutKaart.css").not.toBeNull();
    expect(REGISTER.glow).toBe(basis![1]);
    expect(MEESTER_CSS).not.toContain("--kaart-glow");
  });

  it("echo-contour en binnenlijnen", () => {
    // --kaart-echo is één drop-shadow(dx dy 0 kleur) met dx/dy als fractie van
    // de kaartbreedte; het register schrijft precies diezelfde fracties.
    const echo = /drop-shadow\(\s*calc\(var\(--fut-kw\) \* ([\d.]+)\)\s*calc\(var\(--fut-kw\) \* ([\d.]+)\)\s*0\s*(rgba\([^)]*\))/.exec(
      token("--kaart-echo") ?? "",
    );
    expect(echo, "--kaart-echo niet in de verwachte vorm").not.toBeNull();
    expect(REGISTER.echo).toEqual([
      [Number(echo![1]), Number(echo![2]), echo![3]],
    ]);

    // --kaart-binnenlijn somt smal → breed op (de eerste inset wint); het
    // register houdt diezelfde volgorde en drawKaartVlak keert hem om.
    const lijnen = [
      ...(token("--kaart-binnenlijn") ?? "").matchAll(
        /inset 0 0 0 ([\d.]+)px (rgba\([^)]*\))/g,
      ),
    ].map(([, spreiding, kleur]) => [Number(spreiding), kleur] as const);
    expect(lijnen.length).toBe(3);
    expect(REGISTER.binnenlijn).toEqual(lijnen);
    expect(lijnen.map(([s]) => s)).toEqual([...lijnen.map(([s]) => s)].sort((a, b) => a - b));
  });

  it("stralenkrans en schildvorm blijven bij FutKaart.css", () => {
    // Beide staan daar in een gedeelde selectorlijst met platina en diamant.
    // Het register zet `stralen: true` omdat de poster geen CSS leest; zou
    // meester.css ze hier hérdeclareren, dan waren er twee bronnen.
    expect(REGISTER.stralen).toBe(true);
    expect(FUT_CSS).toMatch(
      /\.fut-kaart--meester \.fut-kaart__vlak::after,?\s*\{|\.fut-kaart--meester \.fut-kaart__vlak::after \{/,
    );
    expect(MEESTER_REGELS).not.toContain("__vlak::after");
    expect(MEESTER_REGELS).not.toContain("--schild");
    // Geen eigen weefsel: het satijn/de krans uit FutKaart.css moet blijven
    // staan, anders tekent de poster een textuur die de kaart niet heeft.
    expect(REGISTER.textuur).toBeUndefined();
    expect(REGISTER.satijnAlpha).toBeUndefined();
  });

  it("selecteert uitsluitend op .fut-kaart--meester", () => {
    // Deze divisie deelt zijn stylesheet-bundel met acht andere (index.css);
    // een selector zonder de modifier zou stil élke kaart herkleuren.
    for (const [, kop] of MEESTER_REGELS.matchAll(/([^{}]+)\{/g)) {
      if (kop.trim().startsWith("@")) continue; // het @media-blok zelf
      for (const sel of kop.split(","))
        expect(sel.trim(), `selector zonder divisie-modifier: ${sel.trim()}`).toMatch(
          /^\.fut-kaart--meester\b/,
        );
    }
  });

  it("zet beweging achter de bewegingsvoorkeur", () => {
    // De glansbaan schuift; dat mag alleen wanneer de gebruiker beweging niet
    // heeft afgezet. Buiten het @media-blok mag er dus geen animation staan.
    const media = /@media \(prefers-reduced-motion: no-preference\) \{([\s\S]*?)\n\}/.exec(
      MEESTER_CSS,
    );
    expect(media, "geen @media-blok voor bewegingsvoorkeur").not.toBeNull();
    expect(media![1]).toContain("animation:");
    expect(MEESTER_CSS.replace(media![0], "")).not.toContain("animation");
    // En de keyframes komen uit FutKaart.css — geen tweede definitie hier.
    expect(MEESTER_CSS).toContain("fut-kaart-shimmer");
    expect(MEESTER_CSS).not.toContain("@keyframes");
  });
});
