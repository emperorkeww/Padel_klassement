import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { ORNAMENT_VIEWBOX } from "../futKaartOrnamenten";
import { DIVISIE_SLOF } from "./slof";

// De stylesheet als tekst, voor de synctest onderaan. Bewust via node:fs en niet
// via Vite's ?raw: Vitest kortsluit CSS-imports (css: false) op een lege string,
// óók met de raw-query, dus dan zou de test stil niets vergelijken. Zelfde
// aanpak als karton.test.ts en de editie-synctest in lib/utils/futKaartCanvas.test.ts
// — inclusief het pad als variabele: met een letterlijke string herschrijft Vite
// `new URL(…, import.meta.url)` tot een asset-URL, en die is geen file://.
const lees = (pad: string) =>
  readFileSync(fileURLToPath(new URL(pad, import.meta.url)), "utf8");
const SLOF_CSS = lees("./slof.css");

const REGISTER = DIVISIE_SLOF.register!;
const VOOR = DIVISIE_SLOF.voor ?? [];
const MOTIEF = DIVISIE_SLOF.motief!;

/* ------------------------------ padmeetkunde ------------------------------ */

type Punt = [number, number];

/** Alle punten van één pad, met de cubics bemonsterd. Slof schrijft bewust
 *  alleen absolute M/L/C/Z (geen bogen), zodat hier geen endpoint- →
 *  centrumomrekening nodig is; élk ander commando gooit, want dat zou stil
 *  verkeerd gemeten worden. */
function padPunten(d: string): Punt[] {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const uit: Punt[] = [];
  let i = 0;
  let cur: Punt = [0, 0];
  let begin: Punt = [0, 0];
  const getal = () => Number(tokens[i++]);
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (cmd === "Z") {
      cur = begin;
      continue;
    }
    if (!"MLC".includes(cmd))
      throw new Error(
        `onverwacht (of relatief) padcommando "${cmd}" in ${d.slice(0, 40)}…`,
      );
    // Herhaalde coördinaten na één commando: M x y x y = M gevolgd door L's.
    let eerste = true;
    while (i < tokens.length && !/[A-Za-z]/.test(tokens[i])) {
      if (cmd === "C") {
        const p1: Punt = [getal(), getal()];
        const p2: Punt = [getal(), getal()];
        const p3: Punt = [getal(), getal()];
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
        cur = p3;
      } else {
        cur = [getal(), getal()];
        if (cmd === "M" && eerste) begin = cur;
        uit.push(cur);
      }
      eerste = false;
    }
  }
  return uit;
}

/** Is deze puntenwolk invariant onder spiegeling om x=50? Sterker dan "de
 *  omhullende staat gecentreerd": een lat die aan één kant is ingeslagen heeft
 *  dezelfde omhullende als een gave lat. */
function spiegelSymmetrisch(punten: readonly Punt[]): boolean {
  return punten.every(([x, y]) =>
    punten.some(
      ([qx, qy]) => Math.abs(qx - (100 - x)) < 0.15 && Math.abs(qy - y) < 0.15,
    ),
  );
}

function grenzen(punten: readonly Punt[]) {
  return {
    xMin: Math.min(...punten.map((p) => p[0])),
    xMax: Math.max(...punten.map((p) => p[0])),
    yMin: Math.min(...punten.map((p) => p[1])),
    yMax: Math.max(...punten.map((p) => p[1])),
  };
}

/** De linkerrand van het vlakke schild (--schild: #fut-schild-vlak, de vorm van
 *  de drie instapdivisies) op hoogte `v`, in kaart-units. De clipPath in
 *  FutKaart.tsx staat in objectBoundingBox-fracties van 100 × 139:
 *    … L 1 0.60 C 1 0.74, 0.955 0.795, 0.865 0.838 L 0.565 0.972 …
 *  Gespiegeld levert de linkerflank dus een cubic van (0 · 83,4) naar
 *  (13,5 · 116,48) en daarna een rechte naar (43,5 · 135,11). Bewust de échte
 *  bezier en niet de rechte benadering: over de taille loopt de kromme ~5 units
 *  bínnen die koorde, en juist daar liggen de stootstrips. */
const TAILLE: readonly Punt[] = [
  [0, 83.4],
  [0, 102.86],
  [4.5, 110.5],
  [13.5, 116.48],
];
const RAND_SAMPLES: Punt[] = [];
for (let s = 0; s <= 400; s++) {
  const t = s / 400;
  const u = 1 - t;
  RAND_SAMPLES.push([
    u ** 3 * TAILLE[0][0] +
      3 * u * u * t * TAILLE[1][0] +
      3 * u * t * t * TAILLE[2][0] +
      t ** 3 * TAILLE[3][0],
    u ** 3 * TAILLE[0][1] +
      3 * u * u * t * TAILLE[1][1] +
      3 * u * t * t * TAILLE[2][1] +
      t ** 3 * TAILLE[3][1],
  ]);
}
function schildLinkerrand(v: number): number {
  if (v <= 83.4) return 0;
  if (v >= 135.11) return 43.5;
  if (v >= 116.48) return 13.5 + ((v - 116.48) / (135.11 - 116.48)) * 30;
  let best = 0;
  let d = Infinity;
  for (const [x, y] of RAND_SAMPLES)
    if (Math.abs(y - v) < d) {
      d = Math.abs(y - v);
      best = x;
    }
  return best;
}

/** De crest is de énige groep die de bovenrand doorsnijdt; al het andere ligt
 *  ín de plaat. Afgeleid uit de meetkunde i.p.v. uit een index, zodat een
 *  herschikking van de delen dit niet stil omdraait. */
const CREST = VOOR.filter((deel) => grenzen(padPunten(deel.d)).yMin < 0);
const OP_DE_PLAAT = VOOR.filter((deel) => !CREST.includes(deel));
/** De strips zijn de gespiegelde delen, het doel de rest onder de taille. */
const STRIPS = OP_DE_PLAAT.filter((deel) => deel.spiegel);
const DOEL = OP_DE_PLAAT.filter((deel) => !deel.spiegel);

describe("Sletje-van-de-baan-ornament (#710)", () => {
  it("levert geen enkel pad met een NaN erin", () => {
    // De stootstrips komen uit `bouwStreng` (genormaliseerde normalen), de
    // inslagster uit sin/cos: één deling door nul en de browser slikt het pad
    // stil in zijn geheel i.p.v. te klagen.
    for (const deel of [...VOOR, ...MOTIEF.paden]) {
      expect(deel.d, `NaN in ${deel.d.slice(0, 40)}…`).not.toMatch(/NaN/);
      for (const [x, y] of padPunten(deel.d))
        expect(
          Number.isFinite(x) && Number.isFinite(y),
          `niet-eindig punt in ${deel.d.slice(0, 40)}…`,
        ).toBe(true);
    }
  });

  it("houdt élk deel binnen de ornament-viewBox, ook ná spiegeling", () => {
    // De ornamentlaag is de énige die buiten de schildclip valt; loopt een pad
    // buiten de viewBox, dan snijdt de browser hem stil af — en dan verdwijnt
    // precies het uitsteeksel dat de divisie herkenbaar maakt.
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
    expect(STRIPS.length).toBeGreaterThan(0);
    for (const deel of STRIPS) {
      const g = grenzen(padPunten(deel.d));
      expect(g.xMax, `${deel.d.slice(0, 30)}… raakt de as`).toBeLessThan(50);
    }
  });

  it("zet de kegelcrest symmetrisch op de as", () => {
    // De crest wordt niet gespiegeld en moet dus uit zichzelf symmetrisch zijn,
    // anders hangt hij scheef op een kaart waar verder alles gecentreerd staat.
    expect(CREST).toHaveLength(4); // plaat, bies, kegel, band
    for (const deel of CREST)
      expect(
        spiegelSymmetrisch(padPunten(deel.d)),
        `${deel.d.slice(0, 30)}… staat scheef`,
      ).toBe(true);
  });

  it("de crest snijdt de bovenrand en komt er echt bovenuit", () => {
    // Zonder deze twee eigenschappen is de vóór-laag zinloos: een ornament dat
    // binnen het schild blijft, had net zo goed in het vlak gekund. Bovendien
    // draagt de instapdivisie de vlakke schildvorm, die geen inkeping heeft —
    // de crest brengt zijn eigen inkeping mee door de rand te doorsnijden.
    const g = grenzen(CREST.flatMap((deel) => padPunten(deel.d)));
    expect(g.yMin).toBeLessThan(-6);
    expect(g.yMax).toBeGreaterThan(0);
    // En hij blijft ruim boven het eloblok, dat rond v=16,2 begint.
    expect(g.yMax).toBeLessThan(12);
  });

  it("houdt de stootstrips binnen de schildrand én links van de tekstkolom", () => {
    // Twee dingen tegelijk: een strip die búiten de rand valt hangt los naast de
    // kaart (de vóór-laag wordt niet geclipt), en een strip die tot ín de
    // tekstkolom loopt legt rubber over de naamplaat. Die kolom begint op u=13,5
    // (5,5 units randstapel + 8 units vlakpadding van 9%).
    for (const deel of STRIPS) {
      const punten = padPunten(deel.d);
      expect(grenzen(punten).xMax, deel.d.slice(0, 30)).toBeLessThan(13.5);
      for (const [x, y] of punten) {
        expect(y, `${deel.d.slice(0, 30)}… boven de kaart`).toBeGreaterThan(0);
        expect(
          x,
          `${deel.d.slice(0, 30)}… valt op v=${y.toFixed(1)} buiten de rand`,
        ).toBeGreaterThan(schildLinkerrand(y) - 0.05);
      }
    }
    // En ze liggen écht langs de ónderste zijkanten: pas onder de schildtaille
    // (v=83,4), waar de rand naar binnen begint te lopen.
    const g = grenzen(STRIPS.flatMap((deel) => padPunten(deel.d)));
    expect(g.yMin).toBeGreaterThan(83.4);
    expect(g.yMax).toBeLessThan(116.48);
  });

  it("zet het oefendoel in de punt, mét de inslag buiten het midden", () => {
    // "Eén slag buiten het midden" is het ornament: een gecentreerde inslag zou
    // een mikpunt zijn i.p.v. een gebruiksspoor. Het doel mag dus juist níet
    // symmetrisch zijn — vandaar dat deze test het tegenovergestelde van de
    // crest-test hierboven eist.
    expect(DOEL.length).toBeGreaterThan(0);
    const g = grenzen(DOEL.flatMap((deel) => padPunten(deel.d)));
    // Onder de onderste tekstregel (die rond v=112 eindigt) en binnen de punt.
    expect(g.yMin).toBeGreaterThan(112);
    for (const deel of DOEL)
      for (const [x, y] of padPunten(deel.d))
        expect(
          x,
          `${deel.d.slice(0, 30)}… valt op v=${y.toFixed(1)} buiten de punt`,
        ).toBeGreaterThan(schildLinkerrand(y));
    // De bal is het énige gekromde pad van het doel (frame, net en glans zijn
    // rechte lijnen), dus hij is zonder index te vinden. Zijn middelpunt ligt
    // buiten de as — één slag, naast het midden.
    const bal = DOEL.filter((deel) => deel.d.includes("C"));
    expect(bal).toHaveLength(1);
    const b = grenzen(padPunten(bal[0].d));
    const balX = (b.xMin + b.xMax) / 2;
    expect(balX).toBeCloseTo(54.4, 1);
    expect(balX).toBeGreaterThan(52);
    // De vier klapstreepjes liggen als ster om die bal heen, op 2,2 tot 3,5 units
    // van het middelpunt — dus niet ergens los in het net.
    const ster = DOEL.filter((deel) => {
      const g = grenzen(padPunten(deel.d));
      return g.xMax - g.xMin < 3 && g.yMax - g.yMin < 3 && !deel.d.includes("C");
    });
    expect(ster).toHaveLength(4);
    for (const [x, y] of ster.flatMap((deel) => padPunten(deel.d))) {
      const r = Math.hypot(x - balX, y - (b.yMin + b.yMax) / 2);
      expect(r, `streepje op ${r.toFixed(2)} van de inslag`).toBeGreaterThan(2);
      expect(r).toBeLessThan(4);
    }
    // En de bovenlat is ingeslagen: het frame — het breedste deel van het doel —
    // is met opzet níet spiegelsymmetrisch. Precies het omgekeerde van de
    // crest-test hierboven, en het verschil tussen "gedeukt" en "scheef".
    const frame = DOEL.reduce((groot, deel) => {
      const d = grenzen(padPunten(deel.d));
      const b = grenzen(padPunten(groot.d));
      return d.xMax - d.xMin > b.xMax - b.xMin ? deel : groot;
    });
    expect(spiegelSymmetrisch(padPunten(frame.d))).toBe(false);
    // De deuk zit aan de kant van de inslag, niet ertegenover: het laagste punt
    // van de bovenlat ligt rechts van de as.
    const lat = padPunten(frame.d).filter(([, y]) => y < 126);
    const diepste = lat.reduce((a, b) => (b[1] > a[1] ? b : a));
    expect(diepste[0]).toBeGreaterThan(50);
  });

  it("verwijst alleen naar gradients die deze divisie zelf meebrengt", () => {
    const ids = new Set((DIVISIE_SLOF.gradienten ?? []).map((g) => g.id));
    for (const id of ids) expect(id.startsWith("fut-div-slof-")).toBe(true);
    for (const deel of VOOR) {
      const ref = /^url\(#(.+)\)$/.exec(deel.vulling ?? "");
      if (ref)
        expect(ids.has(ref[1]), `onbekende gradient ${ref[1]}`).toBe(true);
    }
    // Het rubber is een platte vulling: een mat profiel heeft geen verloop, en
    // twee gradients is het minste van de hertekende divisies.
    expect(ids.size).toBe(2);
  });

  it("houdt het watermerk in zijn eigen viewBox én boven de naamplaat", () => {
    // Het motief heeft een andere doos dan de ornamentlaag (0 0 100 100); loopt
    // een baanlijn erbuiten, dan knipt de svg hem af. En de onderkant is een
    // contrast-eis: met breedte 1 / positie 0,5 is de doos zo breed als het vlak
    // (~90 units) en hangt hij van v≈24 tot v≈114, dus y=72 ligt op v≈89 — net
    // bóven de naamplaat (die rond v=93 begint). Zakt de etsing
    // lager, dan staat de divisietitel weer op een onvoorspelbare achtergrond,
    // en dát is precies waarom deze kaart hertekend moest worden.
    const g = grenzen(MOTIEF.paden.flatMap((p) => padPunten(p.d)));
    expect(g.xMin).toBeGreaterThanOrEqual(0);
    expect(g.xMax).toBeLessThanOrEqual(100);
    expect(g.yMin).toBeGreaterThanOrEqual(0);
    expect(g.yMax).toBeLessThanOrEqual(72);
    expect(MOTIEF.breedte).toBe(1);
    expect(MOTIEF.positie).toBe(0.5);
  });

  it("tekent de baan in de verhouding van een echte padelbaan", () => {
    // 20 × 10 m, dus 2:1. Loopt dat scheef, dan leest het watermerk als een
    // willekeurig raster i.p.v. als de baan waarop deze speler wordt gebruikt.
    const buiten = MOTIEF.paden[0];
    const g = grenzen(padPunten(buiten.d));
    expect((g.xMax - g.xMin) / (g.yMax - g.yMin)).toBeCloseTo(2, 2);
    // En de servicelijnen staan op 3 m van de achterwand: 3 × 4,5 units.
    const verticaal = MOTIEF.paden
      .filter((p) => /^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+$/.test(p.d))
      .map((p) => padPunten(p.d))
      .filter(([a, b]) => a[0] === b[0] && Math.abs(a[1] - b[1]) > 40)
      .map(([a]) => a[0]);
    expect(verticaal.sort((a, b) => a - b)).toEqual([18.5, 50, 81.5]);
  });
});

/* ---------------------- CSS ↔ register-synctest (#710) --------------------- */

// De kleuren staan twee keer: als CSS-tokens (de kaart in de DOM) en als
// literals in het `register` (de deel-poster, die bewust niet van de live tokens
// leest — #125). Lopen ze uiteen, dan wijkt de export af van wat de speler ziet.

const ontdaan = SLOF_CSS.replace(/\/\*[\s\S]*?\*\//g, "");

/** Het `{ … }`-blok achter één selector. */
function blok(selector: string): string {
  const m = new RegExp(
    `${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`,
  ).exec(ontdaan);
  expect(m, `blok ${selector} niet gevonden in slof.css`).not.toBeNull();
  return m![1];
}

const token = (inhoud: string, naam: string) =>
  new RegExp(`${naam}:\\s*([^;]+);`).exec(inhoud)?.[1].trim() ?? null;

describe("slof.css spiegelt het register", () => {
  it("selecteert uitsluitend binnen .fut-kaart--slof, op 0,1,0", () => {
    // Harde eis (#710): een divisiebestand mag geen andere kaartvariant raken,
    // en de dubbele basisklasse (.fut-kaart.fut-kaart--slof) is voorbehouden aan
    // de editieregisters — die moeten van élke divisie kunnen winnen. Er staat
    // ook een test op in lib/utils/futKaartCanvas.test.ts; deze houdt het bij de
    // divisie zelf, waar de fout gemaakt wordt.
    for (const m of ontdaan.matchAll(/([^{}]+)\{/g)) {
      const sel = m[1].trim();
      if (sel.startsWith("@") || /^[\d%,\s]+$/.test(sel)) continue;
      expect(sel).toContain(".fut-kaart--slof");
      expect(sel).not.toContain(".fut-kaart.fut-kaart--slof");
    }
  });

  it("inkt, lijn en vlak-gradient", () => {
    const b = blok(".fut-kaart--slof");
    expect([
      token(b, "--kaart-hi"),
      token(b, "--kaart-mid"),
      token(b, "--kaart-lo"),
    ]).toEqual([...REGISTER.vlak]);
    expect(token(b, "--kaart-ink")).toBe(REGISTER.ink);
    expect(token(b, "--kaart-ink-soft")).toBe(REGISTER.inkSoft);
    expect(token(b, "--kaart-lijn")).toBe(REGISTER.lijn);
  });

  it("het contrast tegen de donkerste vlak-stop haalt AA of beter", () => {
    // De reden dat deze divisie nog aan de beurt was: op de generieke ladder
    // stond de divisietitel grijs-op-grijs. Gerekend op --kaart-lo, de
    // ongunstigste plek op het vlak; het CSS-commentaar documenteert dezelfde
    // getallen én de meting op de hoogtes waar de inkt écht staat.
    const kanaal = (hex: string, i: number) =>
      parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    const lum = (hex: string) =>
      [0.2126, 0.7152, 0.0722].reduce((som, w, i) => {
        const c = kanaal(hex, i);
        return som + w * (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      }, 0);
    const ratio = (a: string, b: string) => {
      const [hoog, laag] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (hoog + 0.05) / (laag + 0.05);
    };
    const lo = REGISTER.vlak[2];
    // Tekst: AA vraagt 4,5:1. De inkt haalt zelfs AAA (7:1).
    expect(ratio(REGISTER.ink, lo)).toBeGreaterThanOrEqual(7);
    expect(ratio(REGISTER.inkSoft, lo)).toBeGreaterThanOrEqual(4.5);
    // Haarlijnen zijn niet-tekstueel (3:1) en staan bovendien hoger op het vlak,
    // waar de gradient nog licht is: daar halen ze 3,36:1 tot 4,23:1.
    expect(ratio(REGISTER.lijn, REGISTER.vlak[1])).toBeGreaterThanOrEqual(3);
  });

  it("frame-gradient en liner", () => {
    const stops = [
      ...blok(".fut-kaart--slof .fut-kaart__zijde").matchAll(
        /(#[0-9a-f]{6})\s+([\d.]+)%/g,
      ),
    ].map(([, kleur, pct]) => [Number(pct) / 100, kleur]);
    expect(stops).toEqual(REGISTER.frame.map((s) => [...s]));
    // Twee stops, dus geen enkel glanspunt: de simpelste omlijsting van de
    // ladder (de metaalladder heeft er vier, de Stofzuiger ook).
    expect(stops).toHaveLength(2);
    expect(
      token(blok(".fut-kaart--slof .fut-kaart__liner"), "background"),
    ).toBe(REGISTER.liner);
  });

  it("géén echo, binnenlijn, eigen keyline of beweging", () => {
    // De vier middelen die deze kaart bewust níet gebruikt — samen zijn ze "de
    // dunste en eenvoudigste omlijsting van alle divisies". Zelfs de Stofzuiger
    // één trede hoger houdt nog één binnenlijn en een trage waas.
    const b = blok(".fut-kaart--slof");
    expect(token(b, "--kaart-echo")).toBeNull();
    expect(REGISTER.echo).toBeUndefined();
    expect(token(b, "--kaart-binnenlijn")).toBeNull();
    expect(REGISTER.binnenlijn).toBeUndefined();
    expect(ontdaan).not.toContain("fut-kaart__keyline");
    expect(REGISTER.keyline).toBeUndefined();
    // Geen animatie: beton en rubber bewegen niet, en daarmee staat de kaart
    // per constructie in dezelfde stand als de (stilstaande) deel-poster.
    expect(ontdaan).not.toContain("animation");
    expect(ontdaan).not.toContain("@keyframes");
  });

  it("topgloed, sheen-baan en satijn", () => {
    const vlak = blok(".fut-kaart--slof .fut-kaart__vlak");
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
        blok(".fut-kaart--slof .fut-kaart__vlak::before"),
      )!;
    expect(sheen[2]).toBe(REGISTER.sheen);
    // sheenSpreiding is de halve breedte van de baan rond 50%.
    expect(Number(sheen[1]) / 100).toBeCloseTo(0.5 - REGISTER.sheenSpreiding!, 5);
    expect(Number(sheen[3]) / 100).toBeCloseTo(0.5 + REGISTER.sheenSpreiding!, 5);

    const satijn = blok(".fut-kaart--slof .fut-kaart__vlak::after");
    expect(Number(/rgba\(255, 255, 255, ([\d.]+)\)/.exec(satijn)![1])).toBe(
      REGISTER.satijnAlpha,
    );
    // Geen stralenkrans: die zou als repeating-conic-gradient in dit ::after
    // staan (zie het premium-blok in FutKaart.css).
    expect(satijn).not.toContain("conic");
    expect(REGISTER.stralen).toBe(false);
  });
});

describe("de divisietitel past zonder afkapping", () => {
  it("houdt de langste titel van de ladder in zijn eigen zetting", () => {
    // "Sletje van de baan III" is met 22 tekens de langste divisietitel van de
    // negen en past in de gedeelde zetting (0.063 × --fut-kw, 0,05em tracking)
    // op géén enkele kaartmaat: gemeten 79,3 px in 69,7 px op de veldmaat. Deze
    // divisie zet daarom één stap strakker. Wordt de titel korter of de zetting
    // ruimer, dan hoort die uitzondering te verdwijnen — en dat merk je hier.
    const langste = `${DIVISIE_SLOF.naam} III`;
    expect(langste).toBe("Sletje van de baan III");
    expect(langste.length).toBe(22);
    const regel = blok(".fut-kaart--slof .fut-kaart__divisie");
    const factor = Number(
      /font-size:\s*calc\(var\(--fut-kw\) \* ([\d.]+)\)/.exec(regel)![1],
    );
    expect(factor).toBeLessThan(0.063);
    expect(factor).toBeGreaterThanOrEqual(0.055);
    // Tracking eraf — óók de stand waarin de deel-poster de regel tekent, want
    // canvas kent geen letter-spacing.
    expect(token(regel, "letter-spacing")).toBe("0");
    // En de zetting blijft op één modifier staan: geen dubbele basisklasse, dus
    // een editie kan er nog steeds bovenop.
    expect(ontdaan).not.toContain(".fut-kaart.fut-kaart--slof");
    // De naam komt uit de bestaande data (TIER_BANDEN in tiers.ts) en wordt hier
    // niet hertaald: de kaart zet de titel dynamisch uit `tier.label`.
    expect(DIVISIE_SLOF.key).toBe("slof");
  });
});
