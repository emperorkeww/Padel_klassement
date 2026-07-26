import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { ORNAMENT_VIEWBOX } from "../futKaartOrnamenten";
import { DIVISIE_ZILVER } from "./zilver";
import type { DivisieDeel } from "./divisieKaart";

// Het register van "Blaaskaak" leeft op twee plekken: als CSS-tokens in
// zilver.css (de kaart in de DOM) en als `register` in zilver.ts (dezelfde
// kaart op de deel-poster). Deze test leest de stylesheet als tekst in en houdt
// de twee gelijk; lopen ze uiteen, dan wijkt de export af van wat de speler
// ziet. Bewust via node:fs en niet via Vite's ?raw: Vitest kortsluit
// CSS-imports (css: false) op een lege string, óók met de raw-query — dan zou
// de test stil niets vergelijken. Zelfde regime als de synctest in
// futKaartCanvas.test.ts. Het pad loopt via een parameter omdat Vite een
// letterlijke `new URL("./x", import.meta.url)` herschrijft naar een
// asset-URL — dan komt er geen file:-scheme meer uit en faalt fileURLToPath.
const lees = (pad: string) =>
  readFileSync(fileURLToPath(new URL(pad, import.meta.url)), "utf8");
const ZILVER_CSS = lees("./zilver.css");

const REGISTER = DIVISIE_ZILVER.register!;

/* -------------------------------- parsers -------------------------------- */

/** Alle coördinaten uit een pad-string, als [x, y]-paren. De divisie schrijft
 *  bewust alleen M/L/C met absolute getallen (geen A-commando's), dus elk
 *  getallenpaar is écht een punt. */
function punten(pad: string): [number, number][] {
  const getallen = pad.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  const uit: [number, number][] = [];
  for (let i = 0; i + 1 < getallen.length; i += 2)
    uit.push([getallen[i], getallen[i + 1]]);
  return uit;
}

function grenzen(paden: readonly string[]) {
  const p = paden.flatMap(punten);
  return {
    xMin: Math.min(...p.map((q) => q[0])),
    xMax: Math.max(...p.map((q) => q[0])),
    yMin: Math.min(...p.map((q) => q[1])),
    yMax: Math.max(...p.map((q) => q[1])),
  };
}

/** Eén CSS-blok, ontdaan van commentaar — anders leest een regex een kleur uit
 *  de toelichting i.p.v. uit de declaratie. */
function blok(selector: string): string {
  const kaal = ZILVER_CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  const m = new RegExp(
    `${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`,
  ).exec(kaal);
  expect(m, `blok ${selector} ontbreekt in zilver.css`).not.toBeNull();
  return m![1];
}

function token(naam: string): string {
  const m = new RegExp(`${naam}:\\s*([^;]+);`).exec(blok(".fut-kaart--zilver"));
  expect(m, `${naam} ontbreekt in .fut-kaart--zilver`).not.toBeNull();
  return m![1].replace(/\s+/g, " ").trim();
}

/** De kleur/positie-paren uit één gradient in een `background`-declaratie. */
function stops(css: string, gradient: RegExp): [number, string][] {
  const body = gradient.exec(css)?.[1] ?? "";
  return [
    ...body.matchAll(/(#[0-9a-f]{6}|rgba?\([^)]*\))\s+(-?[\d.]+)%/gi),
  ].map((m) => [Number(m[2]) / 100, m[1].replace(/\s+/g, " ")]);
}

const ALLE_DELEN: readonly DivisieDeel[] = [
  ...(DIVISIE_ZILVER.achter ?? []),
  ...(DIVISIE_ZILVER.voor ?? []),
];

/* ------------------------------- geometrie ------------------------------- */

describe("Blaaskaak-ornament (#710)", () => {
  it("bevat geen enkele NaN — ook niet in de berekende delen", () => {
    // De veeg, de streepjeslijnen en de pijlpunten komen uit deelberekeningen
    // (bouwStreng, cubic-sampling, een genormaliseerde richtingsvector). Eén
    // deling door nul en het pad wordt stil onzichtbaar i.p.v. te crashen.
    for (const { d } of ALLE_DELEN)
      expect(d, `NaN in ${d.slice(0, 48)}…`).not.toMatch(/NaN/);
    for (const { d } of DIVISIE_ZILVER.motief!.paden)
      expect(d, `NaN in motief ${d.slice(0, 48)}…`).not.toMatch(/NaN/);
  });

  it("past binnen de ornament-viewBox, ook ná spiegeling", () => {
    // De ornamentlaag is de énige die buiten de schildclip valt; loopt een pad
    // buiten de viewBox, dan snijdt de browser hem stil af — en dan verdwijnt
    // precies het uitsteeksel dat de divisie herkenbaar maakt.
    const [vx, vy, vw, vh] = ORNAMENT_VIEWBOX.split(" ").map(Number);
    const g = grenzen(ALLE_DELEN.map((d) => d.d));
    expect(Math.min(g.xMin, 100 - g.xMax)).toBeGreaterThan(vx);
    expect(Math.max(g.xMax, 100 - g.xMin)).toBeLessThan(vx + vw);
    expect(g.yMin).toBeGreaterThan(vy);
    expect(g.yMax).toBeLessThan(vy + vh);
  });

  it("houdt de gespiegelde delen links van de as", () => {
    // `spiegel` tekent hetzelfde pad nóg eens om x=50. Een deel dat de as al
    // zelf passeert, botst dan met zijn eigen spiegelbeeld: buizen die elkaar
    // kruisen, schreeuwstreepjes die door het medaillon lopen. De crest en de
    // resonator staan juist wél op de as en spiegelen daarom niet — die
    // bouwen hun symmetrie in het pad zelf.
    for (const deel of ALLE_DELEN.filter((d) => d.spiegel)) {
      const g = grenzen([deel.d]);
      expect(g.xMax, `${deel.d.slice(0, 40)}… kruist de as`).toBeLessThan(50);
    }
    // En andersom: de niet-gespiegelde delen die op de as staan, zijn zélf
    // symmetrisch — anders hangt de crest scheef in de inkeping.
    const opDeAs = ALLE_DELEN.filter((d) => !d.spiegel);
    expect(opDeAs.length).toBeGreaterThan(0);
    const g = grenzen(opDeAs.map((d) => d.d));
    expect(50 - g.xMin).toBeCloseTo(g.xMax - 50, 0);
  });

  it("laat de crest écht buiten de schildrand uitsteken", () => {
    // Hele punt van de `voor`-laag: deze vormen liggen vóór de kaart omdat ze
    // over de rand heen horen te vallen. Blijft alles binnen het schild, dan
    // had het net zo goed achter de kaart gekund en is de extra laag zinloos.
    const metVulling = (id: string) =>
      DIVISIE_ZILVER.voor!.find((d) => d.vulling === `url(#${id})`)!;
    // De crest komt boven de bovenrand (v=0) uit; wie hem terugtrekt tot in de
    // inkeping, kan hem net zo goed in de `achter`-laag zetten.
    expect(grenzen([metVulling("fut-div-zilver-crest").d]).yMin).toBeLessThan(-4);
    // Het medaillon steekt door de schildpunt-flank: op v=134 loopt de rand van
    // u≈41,7 tot u≈58,3, en de ring is daar breder.
    const ring = grenzen([metVulling("fut-div-zilver-medaille").d]);
    expect(ring.xMin).toBeLessThan(41.7);
    expect(ring.xMax).toBeGreaterThan(58.3);
  });

  it("houdt het watermerk binnen zijn eigen 100×100-viewBox", () => {
    // Het motief heeft een andere doos dan de ornamentlaag (FutKaartMotief
    // rendert op "0 0 100 100"); een tactische pijl die eruit loopt, wordt
    // afgesneden i.p.v. mee-geschaald.
    const g = grenzen(DIVISIE_ZILVER.motief!.paden.map((p) => p.d));
    expect(g.xMin).toBeGreaterThanOrEqual(0);
    expect(g.xMax).toBeLessThanOrEqual(100);
    expect(g.yMin).toBeGreaterThanOrEqual(0);
    expect(g.yMax).toBeLessThanOrEqual(100);
  });
});

/* ------------------------------ CSS ↔ register ------------------------------ */

describe("het zilver-register spiegelt zilver.css", () => {
  it("vlak-, inkt- en lijntokens", () => {
    expect([token("--kaart-hi"), token("--kaart-mid"), token("--kaart-lo")]).toEqual(
      [...REGISTER.vlak],
    );
    expect(token("--kaart-ink")).toBe(REGISTER.ink);
    expect(token("--kaart-ink-soft")).toBe(REGISTER.inkSoft);
    expect(token("--kaart-lijn")).toBe(REGISTER.lijn);
  });

  it("frame, liner en keyline", () => {
    expect(
      stops(blok(".fut-kaart--zilver .fut-kaart__zijde"), /linear-gradient\(([^;]*)\)/s),
    ).toEqual(REGISTER.frame.map((s) => [...s]));
    expect(blok(".fut-kaart--zilver .fut-kaart__liner").match(/#[0-9a-f]{6}/i)![0]).toBe(
      REGISTER.liner,
    );
    expect(
      blok(".fut-kaart--zilver .fut-kaart__keyline").match(/#[0-9a-f]{6}/i)![0],
    ).toBe(REGISTER.keyline);
  });

  it("topgloed: de kaart overschrijft de basisgloed en het canvas volgt", () => {
    // De gloed zit in de background-shorthand en heeft dus geen eigen token;
    // wie hem herijkt, moet de hele regel aanraken. Deze assertie vangt af dat
    // dat alleen in de DOM gebeurt.
    const vlak = blok(".fut-kaart--zilver .fut-kaart__vlak");
    expect(/radial-gradient\([^)]*\)?[^,]*,\s*(rgba\([^)]*\))/.exec(vlak)?.[1]).toBe(
      REGISTER.glow,
    );
    // En de vlak-gradient blijft op de basisstops staan, want het register zet
    // geen eigen vlakMid.
    expect(REGISTER.vlakMid).toBeUndefined();
    expect(vlak).toContain("var(--kaart-mid) 56%");
  });

  it("sheen: dezelfde baanbreedte, dezelfde kleur op de #664-kalibratie", () => {
    const baan = stops(
      blok(".fut-kaart--zilver .fut-kaart__vlak::before"),
      /linear-gradient\(([^;]*)\)/s,
    );
    expect(baan).toHaveLength(1);
    const [offset, kleur] = baan[0];
    expect(offset).toBe(0.5);
    // De CSS zet de flanken op 0.5 ± sheenSpreiding.
    const rand = blok(".fut-kaart--zilver .fut-kaart__vlak::before").match(
      /transparent (\d+)%/g,
    );
    expect(rand).toEqual([
      `transparent ${(0.5 - REGISTER.sheenSpreiding!) * 100}%`,
      `transparent ${(0.5 + REGISTER.sheenSpreiding!) * 100}%`,
    ]);
    // Zelfde tint, maar op de ~0,875-kalibratie van #664: de canvas-baan loopt
    // over een kortere as en komt bij gelijke alpha dus feller uit.
    const alpha = (k: string) => Number(/,\s*([\d.]+)\)$/.exec(k)![1]);
    expect(kleur.replace(/,\s*[\d.]+\)$/, ")")).toBe(
      REGISTER.sheen!.replace(/,\s*[\d.]+\)$/, ")"),
    );
    expect(alpha(REGISTER.sheen!) / alpha(kleur)).toBeCloseTo(0.875, 2);
  });

  it("echo en binnenlijnen", () => {
    const echo = token("--kaart-echo");
    const [dx, dy, kleur] = REGISTER.echo![0];
    expect(echo).toContain(`* ${dx})`);
    expect(echo).toContain(`* ${dy})`);
    expect(echo).toContain(kleur);
    const binnenlijn = token("--kaart-binnenlijn");
    for (const [spreiding, lijnKleur] of REGISTER.binnenlijn!)
      expect(binnenlijn).toContain(`inset 0 0 0 ${spreiding}px ${lijnKleur}`);
  });

  it("blijft van de andere kaartvarianten af", () => {
    // Elke regel in dit bestand hoort op .fut-kaart--zilver te staan; een
    // selector zonder die klasse zou stil ook Wannabe of de GOAT hertinten.
    const selectors = [
      ...ZILVER_CSS.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{/g),
    ]
      .map((m) => m[1].trim())
      .filter((s) => !s.startsWith("@"));
    expect(selectors.length).toBeGreaterThan(5);
    for (const selector of selectors)
      expect(selector, `selector zonder --zilver: ${selector}`).toContain(
        ".fut-kaart--zilver",
      );
    // En beweging blijft achter de bewegingsvoorkeur.
    expect(/animation:/.test(ZILVER_CSS)).toBe(true);
    const media = /@media \(prefers-reduced-motion: no-preference\) \{([\s\S]*?)\n\}/.exec(
      ZILVER_CSS,
    );
    expect(media, "animatie zonder prefers-reduced-motion-gate").not.toBeNull();
    expect(media![1]).toContain("animation:");
  });
});

describe("de divisietitel past op de veldmaat", () => {
  it("Blaaskaak III blijft binnen de langste regel die de zetting al aankan", () => {
    // De compact-zetting in FutKaart.css is gekalibreerd op de langste
    // divisietitel van de negen ("Sletje van de baan III"). Zolang deze titel
    // korter is, kan hij op 116px niet als eerste gaan ellipsen — een
    // hernoeming naar iets langers zou dat stil wél doen.
    const langste = `${DIVISIE_ZILVER.naam} III`;
    expect(langste).toBe("Blaaskaak III");
    expect(langste.length).toBeLessThan("Sletje van de baan III".length);
  });
});
