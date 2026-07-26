import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { ORNAMENT_VIEWBOX } from "../futKaartOrnamenten";
import { DIVISIE_PLATINA } from "./platina";
import type { DivisieDeel } from "./divisieKaart";

// De stylesheets als tekst. Bewust via node:fs en niet via Vite's ?raw: Vitest
// kortsluit CSS-imports (css: false) op een lege string, óók met de raw-query,
// dus dan zou de synctest onderaan stil niets vergelijken (zelfde truc als
// futKaartCanvas.test.ts).
const lees = (pad: string) =>
  readFileSync(fileURLToPath(new URL(pad, import.meta.url)), "utf8");
const CSS = lees("./platina.css");
const FUT_CSS = lees("../FutKaart.css");

/* ------------------------------- geometrie ------------------------------- */

type Punt = [number, number];

/** Punten op een cirkelboog (rx = ry, geen rotatie) van `p0` naar `p1`, in de
 *  eindpunt-parametrisatie van SVG. Nodig omdat een boog buiten zijn eindpunten
 *  uitbolt: de cirkels en vesica's van deze divisie zijn uit twee halve bogen
 *  gebouwd, dus met alleen de ankerpunten zou een medaillon nul hoog lijken. */
function boog(p0: Punt, p1: Punt, R: number, laf: number, sf: number): Punt[] {
  const dx = (p0[0] - p1[0]) / 2;
  const dy = (p0[1] - p1[1]) / 2;
  const d2 = dx * dx + dy * dy;
  // SVG schaalt een te kleine radius op tot de boog past; doe hetzelfde.
  const r = Math.max(R, Math.sqrt(d2));
  const f = Math.sqrt(Math.max(0, (r * r - d2) / d2)) * (laf !== sf ? 1 : -1);
  const cx = f * dy + (p0[0] + p1[0]) / 2;
  const cy = -f * dx + (p0[1] + p1[1]) / 2;
  const a0 = Math.atan2(p0[1] - cy, p0[0] - cx);
  let da = Math.atan2(p1[1] - cy, p1[0] - cx) - a0;
  if (sf === 1 && da <= 0) da += 2 * Math.PI;
  if (sf === 0 && da >= 0) da -= 2 * Math.PI;
  const uit: Punt[] = [];
  for (let i = 0; i <= 24; i++) {
    const a = a0 + (da * i) / 24;
    uit.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return uit;
}

function bezier(p0: Punt, c1: Punt, c2: Punt, p1: Punt): Punt[] {
  const uit: Punt[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const u = 1 - t;
    uit.push([
      u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0],
      u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1],
    ]);
  }
  return uit;
}

/** Alle punten óp een pad. De divisiemodule schrijft M/L/C/A absoluut plus de
 *  relatieve h/v van de vierkante fittingen; elk ánder commando is een teken
 *  dat een vorm is herschreven zonder deze test bij te werken, dus dat gooit. */
function punten(pad: string): Punt[] {
  const chunks = pad.match(/[MLCAZhvz][^MLCAZhvz]*/g) ?? [];
  const uit: Punt[] = [];
  let cur: Punt = [0, 0];
  let start: Punt = [0, 0];
  for (const chunk of chunks) {
    const cmd = chunk[0];
    const n = (chunk.slice(1).match(/-?\d*\.?\d+/g) ?? []).map(Number);
    switch (cmd) {
      case "M":
        cur = [n[0], n[1]];
        start = cur;
        uit.push(cur);
        break;
      case "L":
        for (let i = 0; i + 1 < n.length; i += 2) {
          cur = [n[i], n[i + 1]];
          uit.push(cur);
        }
        break;
      case "C":
        for (let i = 0; i + 5 < n.length; i += 6) {
          const eind: Punt = [n[i + 4], n[i + 5]];
          uit.push(...bezier(cur, [n[i], n[i + 1]], [n[i + 2], n[i + 3]], eind));
          cur = eind;
        }
        break;
      case "A":
        expect(n[0], `boog met rx ≠ ry in ${pad.slice(0, 32)}…`).toBe(n[1]);
        uit.push(...boog(cur, [n[5], n[6]], n[0], n[3], n[4]));
        cur = [n[5], n[6]];
        break;
      case "h":
        cur = [cur[0] + n[0], cur[1]];
        uit.push(cur);
        break;
      case "v":
        cur = [cur[0], cur[1] + n[0]];
        uit.push(cur);
        break;
      case "Z":
      case "z":
        cur = start;
        break;
      default:
        throw new Error(`onbekend padcommando "${cmd}" in ${pad.slice(0, 32)}…`);
    }
  }
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
 *  gedeelde onderkant als futKaartOrnamenten.test.ts (die is voor élke
 *  bovenrand gelijk, dus ook voor de `fut-schild-punt` van platina): rechte
 *  zijkant tot de taille op v = 0.60·139, dan naar (13,5 · 0,838) en zo naar de
 *  punt op (50 · 139). Een ornament is "buiten de kaart" wanneer het links van
 *  deze rand ligt. */
function schildLinkerrand(v: number): number {
  const t = v / 139;
  if (t <= 0.6) return 0;
  if (t <= 0.838) return ((t - 0.6) / 0.238) * 13.5;
  if (t <= 0.972) return 13.5 + ((t - 0.838) / 0.134) * 30;
  return 43.5 + ((t - 0.972) / 0.028) * 6.5;
}

const ACHTER = DIVISIE_PLATINA.achter ?? [];
const VOOR = DIVISIE_PLATINA.voor ?? [];
const ALLE: readonly DivisieDeel[] = [...ACHTER, ...VOOR];

describe("Glazenwasser-divisie (#710): ornamentgeometrie", () => {
  it("levert geen enkel pad met NaN", () => {
    // Crest, medaillon en raster rekenen met wortels en delingen (vesica,
    // vesicaHalfBreed); één negatieve discriminant en de browser tekent stil
    // niets — een NaN in een pad is geen fout, alleen een gat.
    for (const deel of ALLE)
      expect(deel.d, `NaN in ${deel.d.slice(0, 40)}…`).not.toMatch(/NaN/);
    for (const pad of DIVISIE_PLATINA.motief?.paden ?? [])
      expect(pad.d, `NaN in motief ${pad.d.slice(0, 40)}…`).not.toMatch(/NaN/);
  });

  it("past binnen de ornament-viewBox, ook ná spiegeling", () => {
    // De ornamentlaag is de énige die buiten de schildclip valt; loopt een pad
    // buiten de viewBox, dan snijdt de browser hem stil af — en het canvas
    // niet, dus dan wijkt de deel-poster af van wat de speler ziet.
    const [vx, vy, vw, vh] = ORNAMENT_VIEWBOX.split(" ").map(Number);
    for (const deel of ALLE) {
      const g = grenzen([deel.d]);
      const links = deel.spiegel ? Math.min(g.xMin, 100 - g.xMax) : g.xMin;
      const rechts = deel.spiegel ? Math.max(g.xMax, 100 - g.xMin) : g.xMax;
      expect(links, `${deel.d.slice(0, 32)}… links buiten de doos`).toBeGreaterThan(vx);
      expect(rechts, `${deel.d.slice(0, 32)}… rechts buiten de doos`).toBeLessThan(
        vx + vw,
      );
      expect(g.yMin, `${deel.d.slice(0, 32)}… boven de doos`).toBeGreaterThan(vy);
      expect(g.yMax, `${deel.d.slice(0, 32)}… onder de doos`).toBeLessThan(vy + vh);
    }
  });

  it("gespiegelde delen blijven links van de as", () => {
    // `spiegel` tekent het deel er nog eens bij als x → 100 − x. Kruist het
    // origineel de as, dan overlappen de twee helften elkaar in het midden van
    // de kaart: een klem die dwars over de avatar loopt. Marge van 1 unit,
    // zodat een halve contourbreedte er nog bij kan.
    for (const deel of ALLE.filter((d) => d.spiegel)) {
      const g = grenzen([deel.d]);
      expect(g.xMax, `${deel.d.slice(0, 32)}… kruist de as`).toBeLessThan(49);
    }
  });

  it("de delen die op de as staan zijn zelf symmetrisch", () => {
    // Crest en medaillon worden níet gespiegeld gerenderd, dus hun symmetrie
    // moet uit de constructie komen (zeshoek/vesica rekenen links en rechts uit
    // één halve breedte). Dit vangt een handmatige tik in zo'n padstring.
    for (const deel of ALLE.filter((d) => !d.spiegel)) {
      const p = punten(deel.d);
      // Losse fittingen staan náást de as; alleen de as-vormen toetsen we.
      const g = grenzen([deel.d]);
      if (Math.abs(50 - g.xMin - (g.xMax - 50)) > 0.3) continue;
      for (const [x, y] of p) {
        const spiegel = p.some(
          (q) => Math.abs(q[0] - (100 - x)) < 0.3 && Math.abs(q[1] - y) < 0.3,
        );
        expect(
          spiegel,
          `${deel.d.slice(0, 24)}…: (${x}, ${y}) mist zijn spiegelbeeld`,
        ).toBe(true);
      }
    }
  });

  it("de vóór-laag steekt écht buiten de schildrand uit", () => {
    // Een `voor`-deel dat volledig binnen het schild valt, had net zo goed in
    // `achter` gekund: de laag bestaat juist voor vormen die daar half achter
    // zouden verdwijnen. Minstens één deel moet dus over de rand hangen.
    const buiten = VOOR.filter((deel) =>
      punten(deel.d).some(
        ([x, y]) => y < 0 || y > 139 || x < schildLinkerrand(y) || x > 100,
      ),
    );
    expect(buiten.length).toBeGreaterThan(2);

    // En de twee dragende vormen elk op hun eigen manier: de raamcrest komt
    // bóven de bovenrand uit (opgemeten uit de referentie: bovenpunt v≈−9,6,
    // de inkeping van fut-schild-punt duikt tot v≈8), het glasmedaillon hangt
    // ónder de schildpunt (v=139) als los paneel.
    expect(grenzen(VOOR.map((d) => d.d)).yMin).toBeLessThan(-8);
    expect(grenzen(VOOR.map((d) => d.d)).yMax).toBeGreaterThan(141);
  });

  it("de veegbogen liggen buiten de schildrand, niet over de inkt", () => {
    // De veegbogen staan in `achter` en hun centerlijnen lopen nét buiten de
    // schildrand (platina.ts): wat je ziet is de buitenflank die van achter de
    // kaart vandaan komt. Ligt een boog volledig binnen het schild, dan is hij
    // onzichtbaar — en zou hij verleiden om hem naar `voor` te verplaatsen,
    // waar hij wél over de divisieregel kan vallen.
    for (const deel of ACHTER) {
      const buiten = punten(deel.d).filter(([x, y]) => x < schildLinkerrand(y));
      expect(
        buiten.length,
        `${deel.d.slice(0, 32)}… blijft achter de kaart`,
      ).toBeGreaterThan(8);
    }
  });

  it("het wandmotief blijft binnen zijn 100×100-viewBox", () => {
    const g = grenzen((DIVISIE_PLATINA.motief?.paden ?? []).map((p) => p.d));
    expect(g.xMin).toBeGreaterThanOrEqual(0);
    expect(g.xMax).toBeLessThanOrEqual(100);
    expect(g.yMin).toBeGreaterThanOrEqual(0);
    expect(g.yMax).toBeLessThanOrEqual(100);
  });
});

/* ----------------------- CSS ↔ register-synctest (#710) --------------------- */

// De kleuren staan twee keer: als CSS-tokens (de kaart in de DOM) en als
// literals in het `register` van platina.ts (de deel-poster, die bewust niet
// van de live tokens leest — #125). Lopen ze uiteen, dan wijkt de export af van
// wat de speler ziet. Deze test leest platina.css in en vergelijkt regel voor
// regel.

const REG = DIVISIE_PLATINA.register!;
const plat = (s: string) => s.replace(/\s+/g, " ").trim();

/** Het blok achter een selector uit platina.css. */
function blok(selector: string): string {
  const m = new RegExp(
    `${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`,
  ).exec(CSS);
  expect(m, `blok ${selector} niet gevonden in platina.css`).not.toBeNull();
  return m![1];
}

/** Waarde van één declaratie binnen een blok, op één regel genormaliseerd. */
function decl(blok: string, naam: string): string {
  const m = new RegExp(`${naam}:\\s*([^;]+);`).exec(blok);
  expect(m, `${naam} niet gevonden`).not.toBeNull();
  return plat(m![1]);
}

/** De `<kleur> <offset>%`-stops uit een gradient-declaratie. */
function stops(waarde: string): [number, string][] {
  return [...waarde.matchAll(/(#[0-9a-f]{6}|rgba?\([^)]*\))\s+([\d.]+)%/g)].map(
    (m) => [Number(m[2]) / 100, m[1]],
  );
}

describe("het platina-register spiegelt platina.css", () => {
  it("inkt, zachte inkt en lijn", () => {
    const b = blok(".fut-kaart--platina");
    expect(REG.ink).toBe(decl(b, "--kaart-ink"));
    expect(REG.inkSoft).toBe(decl(b, "--kaart-ink-soft"));
    expect(REG.lijn).toBe(decl(b, "--kaart-lijn"));
  });

  it("vlak-gradient (hi/mid/lo)", () => {
    const b = blok(".fut-kaart--platina");
    expect(REG.vlak).toEqual([
      decl(b, "--kaart-hi"),
      decl(b, "--kaart-mid"),
      decl(b, "--kaart-lo"),
    ]);
    // Geen eigen --kaart-mid-positie: de 56% van de basisregel in FutKaart.css
    // blijft staan, dus het register mag `vlakMid` niet zetten.
    expect(REG.vlakMid).toBeUndefined();
  });

  it("frame, liner en keyline", () => {
    expect(stops(decl(blok(".fut-kaart--platina .fut-kaart__zijde"), "background"))).toEqual(
      REG.frame.map(([o, k]) => [o, k]),
    );
    expect(REG.liner).toBe(
      decl(blok(".fut-kaart--platina .fut-kaart__liner"), "background"),
    );
    expect(REG.keyline).toBe(
      decl(blok(".fut-kaart--platina .fut-kaart__keyline"), "background"),
    );
  });

  it("echo-contour en binnenlijnen", () => {
    const b = blok(".fut-kaart--platina");
    const echo =
      /calc\(var\(--fut-kw\) \* ([\d.]+)\) calc\(var\(--fut-kw\) \* ([\d.]+)\) 0 (rgba\([^)]*\))/.exec(
        decl(b, "--kaart-echo"),
      );
    expect(echo, "--kaart-echo niet in de drop-shadow(dx dy 0 kleur)-vorm").not.toBeNull();
    expect(REG.echo).toEqual([[Number(echo![1]), Number(echo![2]), echo![3]]]);

    // Volgorde smal → breed, precies zoals de CSS de insets somt.
    const lijnen = [
      ...decl(b, "--kaart-binnenlijn").matchAll(
        /inset 0 0 0 ([\d.]+)px (rgba\([^)]*\))/g,
      ),
    ].map((m) => [Number(m[1]), m[2]]);
    expect(REG.binnenlijn).toEqual(lijnen);
  });

  it("sheen: dezelfde witwaarde als de basiskaart, alleen breder", () => {
    // platina.css zet geen eigen sheen-kleur, dus het register laat `sheen`
    // leeg en de canvas valt terug op BASIS_SHEEN. Alleen de spreiding wijkt
    // af, en die moet aan beide kanten van 50% even groot zijn.
    const s = stops(decl(blok(".fut-kaart--platina .fut-kaart__vlak::before"), "background"));
    expect(REG.sheen).toBeUndefined();
    expect(s).toHaveLength(1);
    expect(s[0][0]).toBe(0.5);
    const [links, rechts] = [
      ...decl(
        blok(".fut-kaart--platina .fut-kaart__vlak::before"),
        "background",
      ).matchAll(/transparent ([\d.]+)%/g),
    ].map((m) => Number(m[1]) / 100);
    expect(0.5 - links).toBeCloseTo(REG.sheenSpreiding!, 5);
    expect(rechts - 0.5).toBeCloseTo(REG.sheenSpreiding!, 5);
  });

  it("topgloed: ongewijzigd, dus platina.css laat het vlak met rust", () => {
    // Het register moet dezelfde gloed dragen als de basisregel in
    // FutKaart.css; zou platina.css hem overschrijven, dan stond die waarde
    // hier en liep de poster erop achter.
    expect(CSS).not.toMatch(/\.fut-kaart__vlak\s*\{/);
    const basis = /\.fut-kaart__vlak\s*\{([^}]*)\}/.exec(FUT_CSS)![1];
    expect(REG.glow).toBe(/radial-gradient\([^)]*\)?,\s*(rgba\([^)]*\))/.exec(basis)![1]);
  });

  it("satijn ijler dan de basis, en geen stralenkrans", () => {
    // Het gedeelde premium-blok in FutKaart.css zet stralen voor platina; de
    // ::after hier overschrijft dat met alleen het weefsel. De canvas-alpha
    // ligt op ~0,875 van de CSS-alpha (dezelfde kalibratie als de sheen).
    const after = decl(
      blok(".fut-kaart--platina .fut-kaart__vlak::after"),
      "background",
    );
    expect(after).not.toMatch(/conic/);
    expect(REG.stralen).toBe(false);
    const alpha = Number(/rgba\(255, 255, 255, ([\d.]+)\)/.exec(after)![1]);
    expect(REG.satijnAlpha!).toBeCloseTo(alpha * 0.875, 3);
    expect(FUT_CSS).toMatch(/\.fut-kaart--platina \.fut-kaart__vlak::after,/);
  });

  it("raakt alleen de eigen variant", () => {
    // Parallel werk aan de andere acht divisies (#710): elke selector in dit
    // bestand hoort op .fut-kaart--platina te staan, anders lekt het register
    // naar kaarten van een andere divisie.
    const selectors = [...CSS.matchAll(/(^|\})\s*([^{}@]+)\{/g)]
      .map((m) => plat(m[2]))
      .filter((s) => s && !s.startsWith("/*"));
    expect(selectors.length).toBeGreaterThan(0);
    for (const s of selectors)
      expect(s, `selector zonder --platina: ${s}`).toMatch(/\.fut-kaart--platina\b/);
  });

  it("beweging staat achter prefers-reduced-motion", () => {
    // Alles wat animeert hoort in het no-preference-blok; een animation buiten
    // die media-query negeert de systeemvoorkeur.
    const zonderMedia = CSS.replace(
      /@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\n\}/g,
      "",
    );
    expect(zonderMedia).not.toMatch(/animation:/);
    expect(CSS).toMatch(/animation: fut-kaart-shimmer/);
  });
});
