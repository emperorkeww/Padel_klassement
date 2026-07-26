// Divisiekaart "Bankvuller" (brons, #710) — geometrie van de ornamentlaag en de
// synchroniciteit tussen `register` in brons.ts en het `.fut-kaart--brons`-blok
// in brons.css.
//
// Waarom deze twee dingen in één bestand: ze bewaken hetzelfde risico vanuit
// twee kanten. De divisiekaart wordt door twéé tekenaars gelezen — FutKaart.tsx
// zet hem in de DOM, futKaartCanvas.ts op de deel-poster — en beide falen
// stil. Een pad met een NaN erin verdwijnt zonder foutmelding, een deel buiten
// de ornament-viewBox wordt door de browser afgesneden, een `url(#…)` naar een
// niet-bestaande gradient levert op canvas transparant, en een kleur die alleen
// in de CSS wordt bijgesteld laat de poster stil afwijken van wat de speler
// ziet. Niets daarvan is met het oog te zien zonder er expliciet naar te zoeken.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
// `URL` uit node:url en niet de globale: onder jsdom is die laatste jsdom's
// eigen implementatie, en dan struikelt fileURLToPath over het file:-schema.
import { fileURLToPath, URL } from "node:url";
import { DIVISIE_BRONS } from "./brons";
import type { DivisieDeel } from "./divisieKaart";
import { ORNAMENT_VIEWBOX } from "../futKaartOrnamenten";
import { tierFor } from "@/features/rating/tiers";

// Via node:fs en niet via Vite's ?raw: Vitest kortsluit CSS-imports (css: false)
// op een lege string — dezelfde reden als de synctest in futKaartCanvas.test.ts.
// Het pad gaat als variabele naar `new URL`: bij een letterlijke string herkent
// Vite het asset-idioom en herschrijft het naar een http://-dev-server-URL,
// waarna fileURLToPath afketst op het schema.
const lees = (pad: string) =>
  readFileSync(fileURLToPath(new URL(pad, import.meta.url)), "utf8");
const CSS = lees("./brons.css");

const REGISTER = DIVISIE_BRONS.register!;
const ACHTER = DIVISIE_BRONS.achter ?? [];
const VOOR = DIVISIE_BRONS.voor ?? [];
const DELEN: readonly DivisieDeel[] = [...ACHTER, ...VOOR];

/* -------------------------------- helpers -------------------------------- */

/** Alle coördinaten uit een pad-string, als [x, y]-paren. De module schrijft
 *  bewust alleen absolute M/L/C (zie de `cirkel`-helper daar: bogen zouden hun
 *  zeven parameters in dit stelsel meetellen), dus dit dekt de hele laag. */
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

/** De linkerrand van het schild op hoogte `v`, in kaart-units — dezelfde
 *  benadering als in futKaartOrnamenten.test.ts (gedeelde onderkant uit
 *  FutKaartDefs: rechte zijkant tot de taille op v=0.60·139, dan naar
 *  (0.135, 0.838) en zo naar de punt). Links hiervan ligt een ornament écht
 *  naast de kaart. */
function schildLinkerrand(v: number): number {
  const t = v / 139;
  if (t <= 0.6) return 0;
  if (t <= 0.838) return ((t - 0.6) / 0.238) * 13.5;
  if (t <= 0.972) return 13.5 + ((t - 0.838) / 0.134) * 30;
  return 43.5 + ((t - 0.972) / 0.028) * 6.5;
}

/** Het `<selector> { … }`-blok uit brons.css. Geen genest haakje in dit
 *  bestand, dus `[^}]*` volstaat. */
function blok(selector: string): string {
  const m = new RegExp(
    `${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`,
  ).exec(CSS);
  expect(m, `blok "${selector}" niet gevonden in brons.css`).not.toBeNull();
  return m![1];
}

/** Waarde van één declaratie binnen een blok, met de regelafbrekingen van
 *  Prettier platgeslagen. */
function decl(blokTekst: string, naam: string): string {
  const m = new RegExp(`${naam}:\\s*([^;]+);`).exec(blokTekst);
  expect(m, `declaratie "${naam}" niet gevonden`).not.toBeNull();
  return m![1].trim().replace(/\s+/g, " ");
}

/** Alle rgba()-kleuren uit een blok, in volgorde. */
const rgbas = (blokTekst: string) =>
  (blokTekst.match(/rgba?\([^)]*\)/g) ?? []).map((s) =>
    s.replace(/\s+/g, " "),
  );

/** Alpha van een rgba()-string. */
const alpha = (kleur: string) =>
  Number(/rgba?\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/.exec(kleur)?.[1] ?? "1");

/** Een lengte uit --kaart-echo: `calc(var(--fut-kw) * f)` levert de fractie f,
 *  een kale `0` levert 0 — beide vormen komen in een drop-shadow voor. */
const fractie = (deel: string) => {
  const c = /calc\(var\(--fut-kw\)\s*\*\s*(-?[\d.]+)\)/.exec(deel);
  return c ? Number(c[1]) : Number(deel);
};

const BASIS = blok(".fut-kaart--brons");
const VLAK = blok(".fut-kaart--brons .fut-kaart__vlak");

/* ------------------------------- geometrie ------------------------------- */

describe("Bankvuller-ornament (#710)", () => {
  it("bevat geen NaN — niet in een pad, niet in een kleur", () => {
    // Eén verkeerd getal in een generator (`stiksel` rekent met lengtes en kan
    // door nul delen) levert "NaN" ín de padstring; de browser en canvas laten
    // het pad dan zonder klacht weg.
    for (const deel of DELEN) {
      expect(deel.d, `NaN in ${deel.d.slice(0, 40)}…`).not.toMatch(/NaN/);
      expect(deel.d.length).toBeGreaterThan(0);
    }
    for (const pad of DIVISIE_BRONS.motief?.paden ?? [])
      expect(pad.d).not.toMatch(/NaN/);
    for (const g of DIVISIE_BRONS.gradienten ?? []) {
      expect(g.as.some(Number.isNaN)).toBe(false);
      for (const [offset, kleur] of g.stops) {
        expect(Number.isFinite(offset)).toBe(true);
        expect(kleur).not.toMatch(/NaN/);
      }
    }
  });

  it("houdt élk deel binnen de ornament-viewBox, ook ná spiegeling", () => {
    // De ornamentlaag is de énige die buiten de schildclip valt; loopt een pad
    // buiten de viewBox, dan snijdt de browser hem stil af — en op de poster
    // gebeurt dat niet, dus DOM en export zouden verschillen.
    const [vx, vy, vw, vh] = ORNAMENT_VIEWBOX.split(" ").map(Number);
    for (const deel of DELEN) {
      const g = grenzen([deel.d]);
      const xMin = deel.spiegel ? Math.min(g.xMin, 100 - g.xMax) : g.xMin;
      const xMax = deel.spiegel ? Math.max(g.xMax, 100 - g.xMin) : g.xMax;
      const waar = deel.d.slice(0, 32);
      expect(xMin, `${waar}… links buiten de viewBox`).toBeGreaterThan(vx);
      expect(xMax, `${waar}… rechts buiten de viewBox`).toBeLessThan(vx + vw);
      expect(g.yMin, `${waar}… boven de viewBox`).toBeGreaterThan(vy);
      expect(g.yMax, `${waar}… onder de viewBox`).toBeLessThan(vy + vh);
    }
  });

  it("laat geen gespiegeld deel over de as heen lopen", () => {
    // `spiegel` tekent het deel nog eens om x=50. Kruist de helft die as, dan
    // overlapt hij zijn eigen spiegelbeeld: de latten worden dan een gesloten
    // band over het vlak en de stiksels lopen dubbel door het midden.
    for (const deel of DELEN.filter((d) => d.spiegel)) {
      const g = grenzen([deel.d]);
      expect(g.xMax, `${deel.d.slice(0, 32)}… kruist x=50`).toBeLessThan(50);
    }
    // En de stikselnaad stopt vóór de punt, zodat daar een V-opening blijft in
    // plaats van een kruis van twee draden.
    const naad = VOOR.find((d) => d.spiegel && d.contour === "#e3c08a");
    expect(naad).toBeDefined();
    expect(grenzen([naad!.d]).xMax).toBeLessThan(46);
  });

  it("houdt de delen op de as symmetrisch — op het stoeltje na", () => {
    // Delen zonder `spiegel` staan op x=50 en worden dus maar één keer
    // getekend: die moeten zélf symmetrisch zijn, anders staat de crest of het
    // medaillon scheef in de kaart. De gevulde vormen toetsen we puntsgewijs;
    // het stoeltje in de crest is een zijaanzicht en mág asymmetrisch zijn, dus
    // dat blijft bij een bounding-box-check.
    for (const deel of DELEN.filter((d) => !d.spiegel)) {
      const g = grenzen([deel.d]);
      expect(
        (g.xMin + g.xMax) / 2,
        `${deel.d.slice(0, 32)}… staat niet op de as`,
      ).toBeCloseTo(50, 0);
      if (!deel.vulling) continue;
      const p = punten(deel.d);
      for (const [x, y] of p) {
        const spiegel = p.some(
          (q) => Math.abs(q[0] - (100 - x)) < 0.25 && Math.abs(q[1] - y) < 0.25,
        );
        expect(
          spiegel,
          `${deel.d.slice(0, 24)}…: (${x}, ${y}) mist zijn spiegelbeeld`,
        ).toBe(true);
      }
    }
  });

  it("laat de leren tab écht naast het schild uitsteken", () => {
    // De `voor`-laag bestaat om vormen te dragen die achter het schild half
    // zouden verdwijnen. Blijft élk deel binnen de schildrand, dan is de laag
    // zinloos en had alles in `achter` gekund. Onder de taille buigt die rand
    // naar binnen, dus "buiten de kaart" is daar iets anders dan u<0.
    const buiten = VOOR.flatMap((deel) =>
      punten(deel.d).filter(([x, y]) => x < schildLinkerrand(y) - 1),
    );
    expect(buiten.length).toBeGreaterThan(4);
    // En de crest komt bóven de bovenrand uit, in de inkeping.
    expect(Math.min(...VOOR.map((d) => grenzen([d.d]).yMin))).toBeLessThan(-4);
  });

  it("verwijst alleen naar gradients die ook echt bestaan", () => {
    // `drawDivisieOrnament` valt bij een onbekend id stil terug op transparant:
    // op de poster verdwijnt de vorm dan, in de DOM blijft hij staan.
    const ids = new Set((DIVISIE_BRONS.gradienten ?? []).map((g) => g.id));
    for (const deel of DELEN) {
      const m = /^url\(#([^)]+)\)$/.exec(deel.vulling ?? "");
      if (m) expect(ids, `onbekende gradient ${m[1]}`).toContain(m[1]);
    }
    // Andersom net zo goed: een ongebruikte gradient is dode data.
    const gebruikt = new Set(
      DELEN.map((d) => /^url\(#([^)]+)\)$/.exec(d.vulling ?? "")?.[1]).filter(
        Boolean,
      ),
    );
    for (const id of ids) expect(gebruikt, `${id} wordt nergens gebruikt`).toContain(id);
  });

  it("houdt het motief binnen zijn eigen 0 0 100 100-viewBox", () => {
    const g = grenzen((DIVISIE_BRONS.motief?.paden ?? []).map((p) => p.d));
    expect(g.xMin).toBeGreaterThanOrEqual(0);
    expect(g.xMax).toBeLessThanOrEqual(100);
    expect(g.yMin).toBeGreaterThanOrEqual(0);
    expect(g.yMax).toBeLessThanOrEqual(100);
  });

  it("past met zijn langste divisietitel op de veldmaat", () => {
    // .fut-kaart__divisie is op 116px gekalibreerd voor "Eeuwige belofte III"
    // (#664); blijft de langste titel van deze band daaronder, dan ellipst hij
    // op de veldmaat niet. Uit de band gerekend i.p.v. één rating: het
    // sub-niveau bepaalt de lengte, en dat is III bij de ondergrens.
    const labels = [810, 850, 890].map((r) => tierFor(r)!.label);
    const langste = labels.reduce((a, b) => (b.length > a.length ? b : a));
    expect(langste).toBe("Bankvuller III");
    expect(langste.length).toBeLessThan("Eeuwige belofte III".length);
  });
});

/* --------------------------- register ↔ brons.css --------------------------- */

describe("het brons-register spiegelt brons.css", () => {
  it("kleurtokens: vlak, inkt en lijn", () => {
    expect([
      decl(BASIS, "--kaart-hi"),
      decl(BASIS, "--kaart-mid"),
      decl(BASIS, "--kaart-lo"),
    ]).toEqual([...REGISTER.vlak]);
    expect(decl(BASIS, "--kaart-ink")).toBe(REGISTER.ink);
    expect(decl(BASIS, "--kaart-ink-soft")).toBe(REGISTER.inkSoft);
    expect(decl(BASIS, "--kaart-lijn")).toBe(REGISTER.lijn);
  });

  it("frame, liner en keyline", () => {
    const stops = [
      ...blok(".fut-kaart--brons .fut-kaart__zijde").matchAll(
        /(#[0-9a-f]{3,8})\s+([\d.]+)%/g,
      ),
    ].map((m) => [Number(m[2]) / 100, m[1]]);
    expect(stops).toEqual(REGISTER.frame.map(([o, k]) => [o, k]));
    expect(decl(blok(".fut-kaart--brons .fut-kaart__liner"), "background")).toBe(
      REGISTER.liner,
    );
    expect(
      decl(blok(".fut-kaart--brons .fut-kaart__keyline"), "background"),
    ).toBe(REGISTER.keyline);
  });

  it("topgloed en de middenstop van het vlak", () => {
    // De canvas-glow gebruikt vaste geometrie (middelpunt op 50% / −6% van het
    // vlak, straal 0.55·hoogte); alleen de kleur komt uit het register, dus die
    // moet hier letterlijk gelijk zijn. De ellipsmaten checken we mee: wijkt de
    // CSS daarvan af, dan valt het licht op de poster ergens anders.
    expect(VLAK).toContain("120% 55% at 50% -6%");
    expect(rgbas(VLAK)[0]).toBe(REGISTER.glow);
    // vlakMid staat niet in het register, dus de canvas neemt zijn default 0.56.
    const mid = /var\(--kaart-mid\)\s+([\d.]+)%/.exec(VLAK)?.[1];
    expect(Number(mid) / 100).toBe(REGISTER.vlakMid ?? 0.56);
  });

  it("glansbaan: kleur én breedte", () => {
    const before = blok(".fut-kaart--brons .fut-kaart__vlak::before");
    expect(rgbas(before)[0]).toBe(REGISTER.sheen);
    // Zonder sheenSpreiding tekent de canvas de baan op 0.5 ± 0.08; de CSS moet
    // dus op 42%/58% blijven staan, anders is de baan op de poster smaller of
    // breder dan in de DOM.
    const spreiding = REGISTER.sheenSpreiding ?? 0.08;
    expect(before).toContain(`transparent ${50 - spreiding * 100}%`);
    expect(before).toContain(`transparent ${50 + spreiding * 100}%`);
  });

  it("satijnweefsel, op de #664-kalibratie", () => {
    // De canvas-stroke leest feller dan de CSS-band; #664 stelde daarvoor een
    // vaste ~0.875-factor vast (sheen 0.32 → 0.28). Dit is dus bewust géén
    // gelijke waarde, en juist daarom het waard om vast te leggen.
    const css = alpha(rgbas(blok(".fut-kaart--brons .fut-kaart__vlak::after"))[0]);
    expect(css).toBeCloseTo(0.035, 3);
    expect(REGISTER.satijnAlpha).toBeCloseTo(css * 0.875, 2);
  });

  it("echo-contour en binnenlijnen", () => {
    const echo = decl(BASIS, "--kaart-echo");
    const kleur = /rgba?\([^)]*\)/.exec(echo)![0];
    const offsets = (
      echo
        .slice(0, echo.indexOf(kleur))
        .match(/calc\(var\(--fut-kw\)\s*\*\s*-?[\d.]+\)|-?\d+(?:\.\d+)?/g) ?? []
    ).map(fractie);
    expect([[offsets[0], offsets[1], kleur]]).toEqual(
      REGISTER.echo!.map(([dx, dy, k]) => [dx, dy, k]),
    );

    const lijnen = [
      ...decl(BASIS, "--kaart-binnenlijn").matchAll(
        /inset 0 0 0 ([\d.]+)px (rgba?\([^)]*\))/g,
      ),
    ].map((m) => [Number(m[1]), m[2]]);
    expect(lijnen).toEqual(REGISTER.binnenlijn!.map(([s, k]) => [s, k]));
  });

  it("houdt beweging achter prefers-reduced-motion — en heeft die niet nodig", () => {
    // De referentie eist expliciet dat deze kaart niet luxueus wordt: een
    // shimmer of stralenkrans maakt van de bank alsnog een troon. Vandaar dat
    // hier niets beweegt. Zet iemand er later tóch beweging in, dan moet die
    // binnen een no-preference-mediablok staan — deze test dwingt die plaatsing
    // af in plaats van beweging botweg te verbieden.
    const buitenMedia = CSS.replace(
      /@media \(prefers-reduced-motion: no-preference\)\s*\{[\s\S]*?\n\}/g,
      "",
    );
    expect(buitenMedia).not.toMatch(/(animation|transition)[\w-]*\s*:/);
    expect(REGISTER.stralen ?? false).toBe(false);
  });

  it("raakt geen andere kaartvariant", () => {
    // Het bestand wordt na FutKaart.css geïmporteerd (divisies/index.css), dus
    // een selector zonder --brons zou stilletjes élke kaart hertinten.
    for (const regel of CSS.split("\n")) {
      const sel = /^([.#][^{]*)\{/.exec(regel.trim());
      if (sel) expect(sel[1]).toContain(".fut-kaart--brons");
    }
  });
});
