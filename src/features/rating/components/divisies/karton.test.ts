import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { ORNAMENT_VIEWBOX } from "../futKaartOrnamenten";
import { DIVISIE_KARTON } from "./karton";

// De stylesheet als tekst, voor de synctest onderaan. Bewust via node:fs en niet
// via Vite's ?raw: Vitest kortsluit CSS-imports (css: false) op een lege string,
// óók met de raw-query, dus dan zou de test stil niets vergelijken. Zelfde
// aanpak als de editie-synctest in lib/utils/futKaartCanvas.test.ts — inclusief
// het pad als variabele: met een letterlijke string herschrijft Vite
// `new URL(…, import.meta.url)` tot een asset-URL, en die is geen file://.
const lees = (pad: string) =>
  readFileSync(fileURLToPath(new URL(pad, import.meta.url)), "utf8");
const KARTON_CSS = lees("./karton.css");

const REGISTER = DIVISIE_KARTON.register!;
const VOOR = DIVISIE_KARTON.voor ?? [];
const MOTIEF = DIVISIE_KARTON.motief!;

/* ----------------------------- padmeetkunde ------------------------------ */

type Punt = [number, number];

/** Eén boog uit een A-commando, bemonsterd. De endpoint- → centrumomrekening
 *  komt uit de SVG-spec (F.6.5) en is hier geen luxe: zonder het middelpunt weet
 *  je niet waar een boog bólt, en juist de bolling van het aanzuigrooster moet
 *  binnen de schildpunt blijven. Een naïeve "lees alle getallen als x/y-paren"
 *  zou bovendien de radii en de twee vlaggen als coördinaten meelezen. */
function boogPunten(
  x0: number,
  y0: number,
  rx: number,
  ry: number,
  graden: number,
  groot: boolean,
  klok: boolean,
  x1: number,
  y1: number,
  stappen = 24,
): Punt[] {
  const phi = (graden * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x0 - x1) / 2;
  const dy = (y0 - y1) / 2;
  const xa = cos * dx + sin * dy;
  const ya = -sin * dx + cos * dy;
  let a = Math.abs(rx);
  let b = Math.abs(ry);
  const lambda = (xa * xa) / (a * a) + (ya * ya) / (b * b);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    a *= s;
    b *= s;
  }
  const teller = a * a * b * b - a * a * ya * ya - b * b * xa * xa;
  const noemer = a * a * ya * ya + b * b * xa * xa;
  const f = (groot === klok ? -1 : 1) * Math.sqrt(Math.max(0, teller / noemer));
  const cxa = (f * (a * ya)) / b;
  const cya = (f * -(b * xa)) / a;
  const cx = cos * cxa - sin * cya + (x0 + x1) / 2;
  const cy = sin * cxa + cos * cya + (y0 + y1) / 2;
  const hoek = (ux: number, uy: number, vx: number, vy: number) => {
    const n = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    const c = Math.min(1, Math.max(-1, (ux * vx + uy * vy) / n));
    return (ux * vy - uy * vx < 0 ? -1 : 1) * Math.acos(c);
  };
  const ux = (xa - cxa) / a;
  const uy = (ya - cya) / b;
  const start = hoek(1, 0, ux, uy);
  let sweep = hoek(ux, uy, (-xa - cxa) / a, (-ya - cya) / b);
  if (!klok && sweep > 0) sweep -= 2 * Math.PI;
  if (klok && sweep < 0) sweep += 2 * Math.PI;
  const uit: Punt[] = [];
  for (let i = 0; i <= stappen; i++) {
    const t = start + (sweep * i) / stappen;
    const px = a * Math.cos(t);
    const py = b * Math.sin(t);
    uit.push([cos * px - sin * py + cx, sin * px + cos * py + cy]);
  }
  return uit;
}

/** Alle punten van één pad, bogen en bezierkrommen bemonsterd. De divisiedelen
 *  schrijven alleen absolute M/L/C/A/Z; een relatief commando zou stil verkeerd
 *  gemeten worden, dus dat gooit hier. */
function padPunten(d: string): Punt[] {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const uit: Punt[] = [];
  let i = 0;
  let cur: Punt = [0, 0];
  let begin: Punt = [0, 0];
  const getal = () => Number(tokens[i++]);
  const bezier = (p1: Punt, p2: Punt, p3: Punt) => {
    for (let s = 1; s <= 16; s++) {
      const t = s / 16;
      const u = 1 - t;
      uit.push([
        u ** 3 * cur[0] +
          3 * u * u * t * p1[0] +
          3 * u * t * t * p2[0] +
          t ** 3 * p3[0],
        u ** 3 * cur[1] +
          3 * u * u * t * p1[1] +
          3 * u * t * t * p2[1] +
          t ** 3 * p3[1],
      ]);
    }
  };
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (cmd === "Z" || cmd === "z") {
      cur = begin;
      continue;
    }
    if (!"MLCA".includes(cmd))
      throw new Error(
        `onverwacht (of relatief) padcommando "${cmd}" in ${d.slice(0, 40)}…`,
      );
    // Herhaalde coördinaten na één commando: M x y x y = M gevolgd door L's.
    let eerste = true;
    while (i < tokens.length && !/[A-Za-z]/.test(tokens[i])) {
      if (cmd === "M" || cmd === "L") {
        cur = [getal(), getal()];
        if (cmd === "M" && eerste) begin = cur;
        uit.push(cur);
      } else if (cmd === "C") {
        const p1: Punt = [getal(), getal()];
        const p2: Punt = [getal(), getal()];
        const p3: Punt = [getal(), getal()];
        bezier(p1, p2, p3);
        cur = p3;
      } else {
        const rx = getal();
        const ry = getal();
        const rot = getal();
        const groot = getal() === 1;
        const klok = getal() === 1;
        const eind: Punt = [getal(), getal()];
        uit.push(
          ...boogPunten(
            cur[0],
            cur[1],
            rx,
            ry,
            rot,
            groot,
            klok,
            eind[0],
            eind[1],
          ),
        );
        cur = eind;
      }
      eerste = false;
    }
  }
  return uit;
}

function grenzen(punten: readonly Punt[]) {
  return {
    xMin: Math.min(...punten.map((p) => p[0])),
    xMax: Math.max(...punten.map((p) => p[0])),
    yMin: Math.min(...punten.map((p) => p[1])),
    yMax: Math.max(...punten.map((p) => p[1])),
  };
}

/** De linkerrand van het schild op hoogte `v`, in kaart-units — dezelfde
 *  onderkant als in futKaartOrnamenten.test.ts (die is voor élke schildvorm
 *  gelijk; alleen de bovenrand wisselt, en de instapdivisies dragen daar de
 *  vlakke variant). Links van deze rand ligt een ornament búiten de kaart. */
function schildLinkerrand(v: number): number {
  const t = v / 139;
  if (t <= 0.6) return 0;
  if (t <= 0.838) return ((t - 0.6) / 0.238) * 13.5;
  if (t <= 0.972) return 13.5 + ((t - 0.838) / 0.134) * 30;
  return 43.5 + ((t - 0.972) / 0.028) * 6.5;
}

/** De crest is de énige groep die de bovenrand doorsnijdt; al het andere zit ín
 *  de plaat gestanst (referentie #710 §8). Afgeleid uit de meetkunde i.p.v. uit
 *  een index, zodat een herschikking van de delen dit niet stil omdraait. */
const CREST = VOOR.filter((deel) => grenzen(padPunten(deel.d)).yMin < 0);
const GESTANST = VOOR.filter((deel) => !CREST.includes(deel));

describe("Stofzuiger-ornament (#710)", () => {
  it("levert geen enkel pad met een NaN erin", () => {
    // Het rooster rekent met een wortel en de banen met bezier-fracties: één
    // negatieve wortel en de browser slikt het pad stil in zijn geheel.
    for (const deel of [...VOOR, ...MOTIEF.paden]) {
      expect(deel.d, `NaN in ${deel.d.slice(0, 40)}…`).not.toMatch(/NaN/);
      for (const [x, y] of padPunten(deel.d))
        expect(
          Number.isFinite(x) && Number.isFinite(y),
          `niet-eindig punt in ${deel.d.slice(0, 40)}…`,
        ).toBe(true);
    }
  });

  it("houdt élk voor-deel binnen de ornament-viewBox, ook ná spiegeling", () => {
    // De ornamentlaag is de énige die buiten de schildclip valt; loopt een pad
    // buiten de viewBox, dan snijdt de browser hem stil af.
    const [vx, vy, vw, vh] = ORNAMENT_VIEWBOX.split(" ").map(Number);
    for (const deel of VOOR) {
      const g = grenzen(padPunten(deel.d));
      const kop = deel.d.slice(0, 30);
      expect(Math.min(g.xMin, 100 - g.xMax), kop).toBeGreaterThan(vx);
      expect(Math.max(g.xMax, 100 - g.xMin), kop).toBeLessThan(vx + vw);
      expect(g.yMin, kop).toBeGreaterThan(vy);
      expect(g.yMax, kop).toBeLessThan(vy + vh);
    }
  });

  it("laat geen gespiegeld deel over de as heen lopen", () => {
    // `spiegel: true` tekent het deel nóg een keer om x=50. Kruist het origineel
    // die as, dan overlappen de twee helften elkaar en ontstaat er in het midden
    // een dubbele, donkere vorm die niemand heeft getekend.
    const gespiegeld = VOOR.filter((deel) => deel.spiegel);
    expect(gespiegeld.length).toBeGreaterThan(0);
    for (const deel of gespiegeld) {
      const g = grenzen(padPunten(deel.d));
      expect(g.xMax, `${deel.d.slice(0, 30)}… raakt de as`).toBeLessThan(50);
    }
  });

  it("zet de delen óp de as zelf symmetrisch neer", () => {
    // Crest en aanzuigrooster staan op x=50 en worden dus niet gespiegeld: ze
    // moeten uit zichzelf symmetrisch zijn, anders staat het ornament scheef op
    // een kaart waar verder alles in het midden hangt.
    for (const deel of VOOR.filter((d) => !d.spiegel)) {
      const g = grenzen(padPunten(deel.d));
      expect(
        g.xMin + g.xMax,
        `${deel.d.slice(0, 30)}… staat scheef`,
      ).toBeCloseTo(100, 1);
    }
  });

  it("de bezemcrest snijdt de bovenrand en komt er echt bovenuit", () => {
    // Zonder deze twee eigenschappen is de vóór-laag zinloos: een ornament dat
    // binnen het schild blijft, had net zo goed in het vlak gekund. De crest
    // moet de bovenrand (v=0) dus kruisen én er meetbaar bovenuit steken.
    expect(CREST).toHaveLength(4); // plaat, bies, bezem, sprieten
    const g = grenzen(CREST.flatMap((deel) => padPunten(deel.d)));
    expect(g.yMin).toBeLessThan(-6);
    expect(g.yMin).toBeGreaterThan(-14);
    expect(g.yMax).toBeGreaterThan(0);
    // En hij blijft ruim boven het eloblok, dat rond v=15,6 begint.
    expect(g.yMax).toBeLessThan(12);
  });

  it("drukt de rest van het ornament ín de kaartrand, niet erbuiten", () => {
    // De referentie (#710 §8) laat élk ornament ín de plaat gestanst zien —
    // dat is wat deze divisie eenvoudiger maakt dan de Ballenraper erboven.
    // Alles behalve de crest moet dus binnen de schildrand blijven.
    expect(GESTANST.length).toBeGreaterThan(0);
    // Kwart-unit speling: `bouwStreng` zet de omtrek van een zuiggroef loodrecht
    // op de centerlijn, en bij een steile aanzet duwt die haakse offset de
    // buitenste punten een fractie over de rand. Dat is ~0,1 px op de veldmaat —
    // geen ornament dat naast de kaart hangt, en dát is wat deze test bewaakt.
    for (const deel of GESTANST) {
      for (const [x, y] of padPunten(deel.d)) {
        expect(y, `${deel.d.slice(0, 30)}… boven de kaart`).toBeGreaterThan(0);
        expect(
          x,
          `${deel.d.slice(0, 30)}… valt op v=${y.toFixed(1)} buiten de rand`,
        ).toBeGreaterThan(schildLinkerrand(y) - 0.25);
      }
    }
  });

  it("verwijst alleen naar gradients die deze divisie zelf meebrengt", () => {
    const ids = new Set((DIVISIE_KARTON.gradienten ?? []).map((g) => g.id));
    for (const id of ids) expect(id.startsWith("fut-div-karton-")).toBe(true);
    for (const deel of VOOR) {
      const ref = /^url\(#(.+)\)$/.exec(deel.vulling ?? "");
      if (ref)
        expect(ids.has(ref[1]), `onbekende gradient ${ref[1]}`).toBe(true);
    }
  });

  it("houdt het watermerk binnen zijn eigen 100 × 100-viewBox", () => {
    // Het motief heeft een andere doos dan de ornamentlaag; loopt een baan
    // erbuiten, dan knipt de svg hem af en stopt de baan midden in het vlak.
    const g = grenzen(MOTIEF.paden.flatMap((p) => padPunten(p.d)));
    expect(g.xMin).toBeGreaterThanOrEqual(0);
    expect(g.xMax).toBeLessThanOrEqual(100);
    expect(g.yMin).toBeGreaterThanOrEqual(0);
    expect(g.yMax).toBeLessThanOrEqual(100);
  });

  it("laat élke baan op hetzelfde zuigpunt uitkomen", () => {
    // De grap van de divisie: alle ballen worden naar één speler getrokken. Een
    // baan die net naast het punt eindigt, maakt er een decoratieve waaier van.
    const eindpunten = MOTIEF.paden
      .filter((p) => p.d.includes(" C "))
      .map((p) => padPunten(p.d).at(-1)!)
      // De stofvegen eindigen bewust niet op het zuigpunt.
      .filter(([, y]) => y > 85);
    expect(eindpunten.length).toBeGreaterThanOrEqual(7);
    for (const [x, y] of eindpunten) {
      expect(x).toBeCloseTo(52, 5);
      expect(y).toBeCloseTo(92, 5);
    }
  });
});

/* ---------------------- CSS ↔ register-synctest (#710) --------------------- */

// De kleuren staan twee keer: als CSS-tokens (de kaart in de DOM) en als
// literals in het `register` (de deel-poster, die bewust niet van de live tokens
// leest — #125). Lopen ze uiteen, dan wijkt de export af van wat de speler ziet.

const ontdaan = KARTON_CSS.replace(/\/\*[\s\S]*?\*\//g, "");

/** Het `{ … }`-blok achter één selector. */
function blok(selector: string): string {
  const m = new RegExp(
    `${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`,
  ).exec(ontdaan);
  expect(m, `blok ${selector} niet gevonden in karton.css`).not.toBeNull();
  return m![1];
}

const token = (inhoud: string, naam: string) =>
  new RegExp(`${naam}:\\s*([^;]+);`).exec(inhoud)?.[1].trim() ?? null;

describe("karton.css spiegelt het register", () => {
  it("selecteert uitsluitend binnen .fut-kaart--karton", () => {
    // Harde eis (#710): een divisiebestand mag geen andere kaartvariant raken.
    for (const m of ontdaan.matchAll(/([^{}]+)\{/g)) {
      const sel = m[1].trim();
      if (sel.startsWith("@") || /^[\d%,\s]+$/.test(sel)) continue;
      expect(sel).toContain(".fut-kaart--karton");
    }
  });

  it("inkt, lijn en vlak-gradient", () => {
    const b = blok(".fut-kaart--karton");
    expect([
      token(b, "--kaart-hi"),
      token(b, "--kaart-mid"),
      token(b, "--kaart-lo"),
    ]).toEqual([...REGISTER.vlak]);
    expect(token(b, "--kaart-ink")).toBe(REGISTER.ink);
    expect(token(b, "--kaart-ink-soft")).toBe(REGISTER.inkSoft);
    expect(token(b, "--kaart-lijn")).toBe(REGISTER.lijn);
  });

  it("binnenlijn, en geen echo of eigen keyline", () => {
    const b = blok(".fut-kaart--karton");
    const lijnen = [
      ...(token(b, "--kaart-binnenlijn") ?? "").matchAll(
        /inset 0 0 0 ([\d.]+)px (rgba\([^)]*\))/g,
      ),
    ].map(([, px, kleur]) => [Number(px), kleur]);
    expect(lijnen).toEqual(REGISTER.binnenlijn?.map((l) => [...l]));
    // De twee mechanismen die dit register bewust níet gebruikt: geen tweede
    // silhouet en geen eigen keyline (die valt terug op de gedeelde mix).
    expect(token(b, "--kaart-echo")).toBeNull();
    expect(REGISTER.echo).toBeUndefined();
    expect(ontdaan).not.toContain("fut-kaart__keyline");
    expect(REGISTER.keyline).toBeUndefined();
  });

  it("frame-gradient en liner", () => {
    const stops = [
      ...blok(".fut-kaart--karton .fut-kaart__zijde").matchAll(
        /(#[0-9a-f]{6})\s+([\d.]+)%/g,
      ),
    ].map(([, kleur, pct]) => [Number(pct) / 100, kleur]);
    expect(stops).toEqual(REGISTER.frame.map((s) => [...s]));
    expect(
      token(blok(".fut-kaart--karton .fut-kaart__liner"), "background"),
    ).toBe(REGISTER.liner);
  });

  it("topgloed, sheen-baan en satijn", () => {
    const vlak = blok(".fut-kaart--karton .fut-kaart__vlak");
    expect(/radial-gradient\([\s\S]*?,\s*(rgba\([^)]*\))/.exec(vlak)![1]).toBe(
      REGISTER.glow,
    );
    // De middenstop van de vlak-gradient is de canvas-default (0.56); staat in
    // de CSS iets anders, dan hoort `vlakMid` in het register te staan.
    expect(
      Number(/var\(--kaart-mid\)\s+(\d+)%/.exec(vlak)![1]) / 100,
    ).toBeCloseTo(REGISTER.vlakMid ?? 0.56, 5);

    const sheen =
      /transparent (\d+)%,\s*(rgba\([^)]*\)) 50%,\s*transparent (\d+)%/.exec(
        blok(".fut-kaart--karton .fut-kaart__vlak::before"),
      )!;
    expect(sheen[2]).toBe(REGISTER.sheen);
    // sheenSpreiding is de halve breedte van de baan rond 50%.
    expect(Number(sheen[1]) / 100).toBeCloseTo(
      0.5 - REGISTER.sheenSpreiding!,
      5,
    );
    expect(Number(sheen[3]) / 100).toBeCloseTo(
      0.5 + REGISTER.sheenSpreiding!,
      5,
    );

    const satijn = blok(".fut-kaart--karton .fut-kaart__vlak::after");
    expect(Number(/rgba\(255, 255, 255, ([\d.]+)\)/.exec(satijn)![1])).toBe(
      REGISTER.satijnAlpha,
    );
    // Geen stralenkrans: die zou als repeating-conic-gradient in dit ::after
    // staan (zie het premium-blok in FutKaart.css).
    expect(satijn).not.toContain("conic");
    expect(REGISTER.stralen).toBe(false);
  });

  it("zet beweging alleen achter een bewegingsvoorkeur", () => {
    const media = /@media \(prefers-reduced-motion: no-preference\)/.exec(
      ontdaan,
    );
    expect(media).not.toBeNull();
    // De animatie mag nergens vóór dat blok staan, anders draait hij ook voor
    // wie beweging heeft uitgezet.
    expect(ontdaan.indexOf("animation:")).toBeGreaterThan(media!.index);
  });
});
