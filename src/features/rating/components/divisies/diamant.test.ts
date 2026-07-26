import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { DIAMANT_TEST, DIVISIE_DIAMANT } from "./diamant";
import { ORNAMENT_VIEWBOX, type Streng } from "../futKaartOrnamenten";

// De stylesheets als tekst, voor de synctest onderaan. Bewust via node:fs en
// niet via Vite's ?raw: Vitest kortsluit CSS-imports (css: false) op een lege
// string, óók met de raw-query, dus dan zou de test stil niets vergelijken.
// Zelfde truc als de editie-synctest in futKaartCanvas.test.ts.
const lees = (pad: string) =>
  readFileSync(fileURLToPath(new URL(pad, import.meta.url)), "utf8");
const DIAMANT_CSS = lees("./diamant.css");
const FUT_CSS = lees("../FutKaart.css");

const REGISTER = DIVISIE_DIAMANT.register!;

/* ------------------------------- geometrie ------------------------------- */

/** Alle coördinaten uit een pad-string, als [x, y]-paren. Diamant schrijft
 *  alleen absolute M/L/C met platte getallen — de boog-helper zet cirkelbogen
 *  bewust om in cubics i.p.v. een A-commando, juist zodat dit klopt. */
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

/** De linkerrand van het schild op hoogte `v`, in kaart-units. Volgt de
 *  gedeelde onderkant uit FutKaartDefs: rechte zijkant tot de taille op
 *  v=0.60·139, dan naar (0.135, 0.838) en zo naar de punt op (0.5, 1). Een
 *  ornament is "buiten de kaart" wanneer het links van deze rand ligt.
 *  Letterlijk dezelfde helper als futKaartOrnamenten.test.ts. */
function schildLinkerrand(v: number): number {
  const t = v / 139;
  if (t <= 0.6) return 0;
  if (t <= 0.838) return ((t - 0.6) / 0.238) * 13.5;
  if (t <= 0.972) return 13.5 + ((t - 0.838) / 0.134) * 30;
  return 43.5 + ((t - 0.972) / 0.028) * 6.5;
}

const alleStrengPaden = (s: Streng) => [
  s.omtrek,
  s.highlight,
  s.schaduw,
  ...s.ribbels,
  ...s.ribbelGlans,
];

/** Elk pad dat de kaart tekent: beide ornamentlagen én het watermerk. */
const ALLE_DELEN = [
  ...(DIVISIE_DIAMANT.achter ?? []),
  ...(DIVISIE_DIAMANT.voor ?? []),
];
const ALLE_PADEN = [
  ...ALLE_DELEN.map((d) => d.d),
  ...DIVISIE_DIAMANT.motief!.paden.map((p) => p.d),
];

describe("diamant-ornament (#710)", () => {
  it("bevat geen enkele NaN", () => {
    // De rails en de crestboog komen uit generatoren (bouwStreng, de
    // cubic-boog, de streepjes-knipper); één deling door nul daarin levert een
    // pad op dat de browser stil overslaat i.p.v. een fout.
    for (const pad of [
      ...ALLE_PADEN,
      ...DIAMANT_TEST.rails.flatMap(alleStrengPaden),
    ])
      expect(pad, `NaN in ${pad.slice(0, 40)}…`).not.toMatch(/NaN/);
  });

  it("past binnen de ornament-viewBox, ook ná spiegeling", () => {
    // De ornamentlaag is de énige die buiten de schildclip valt; loopt een pad
    // buiten de viewBox, dan snijdt de browser hem stil af — en de rails staan
    // met opzet náást de kaart, dus dat is hier geen theoretisch risico.
    const [vx, vy, vw, vh] = ORNAMENT_VIEWBOX.split(" ").map(Number);
    const g = grenzen([
      ...ALLE_DELEN.map((d) => d.d),
      ...DIAMANT_TEST.rails.flatMap(alleStrengPaden),
    ]);
    expect(Math.min(g.xMin, 100 - g.xMax)).toBeGreaterThan(vx);
    expect(Math.max(g.xMax, 100 - g.xMin)).toBeLessThan(vx + vw);
    expect(g.yMin).toBeGreaterThan(vy);
    expect(g.yMax).toBeLessThan(vy + vh);
  });

  it("gespiegelde delen blijven aan hun eigen kant van de as", () => {
    // `spiegel: true` tekent hetzelfde pad nóg een keer om x=50 geklapt. Kruist
    // zo'n deel de as, dan overlappen de twee helften in het midden van de
    // kaart — precies waar de inkt staat. Elk gespiegeld deel moet dus volledig
    // links van x=50 blijven; de crest en het medaillon staan wél op de as en
    // worden juist niet gespiegeld.
    for (const deel of ALLE_DELEN.filter((d) => d.spiegel)) {
      const g = grenzen([deel.d]);
      expect(g.xMax, `${deel.d.slice(0, 30)}… kruist de as`).toBeLessThan(50);
    }
    for (const deel of ALLE_DELEN.filter((d) => !d.spiegel)) {
      const g = grenzen([deel.d]);
      expect(50 - g.xMin, `${deel.d.slice(0, 30)}… staat scheef`).toBeCloseTo(
        g.xMax - 50,
        1,
      );
    }
  });

  it("de rails liggen náást het schild, met een gat waar het derde stuk hoort", () => {
    // De ornamentlaag ligt achter de kaart: een rail die binnen de schildrand
    // blijft, is onzichtbaar. En het gat is het thema — loopt de onderste rail
    // door tot tegen de bovenste, dan is het frame gewoon af.
    const [boven, onder] = DIAMANT_TEST.rails;
    const gBoven = grenzen(alleStrengPaden(boven));
    const gOnder = grenzen(alleStrengPaden(onder));
    expect(gBoven.xMin).toBeLessThan(schildLinkerrand(gBoven.yMin) - 1);
    expect(gOnder.yMin - gBoven.yMax).toBeGreaterThan(15);
    // De stomp ligt in dat gat, maar verder naar buiten: hij mag de rails niet
    // raken, anders sluit het frame alsnog.
    const gStomp = grenzen([DIAMANT_TEST.railStomp]);
    expect(gStomp.yMin).toBeGreaterThan(gBoven.yMax);
    expect(gStomp.yMax).toBeLessThan(gOnder.yMin);
    expect(gStomp.xMax).toBeLessThan(Math.min(gBoven.xMin, gOnder.xMin));
  });

  it("crest en medaillon steken écht buiten het schild uit", () => {
    // Beide staan in de vóór-laag, en die laag is alleen zinvol als de vorm
    // buiten de schildrand valt: achter het schild zou de crest in de inkeping
    // verdwijnen en het medaillon onder de punt.
    const crest = grenzen([DIAMANT_TEST.crestBoog]);
    expect(crest.yMin).toBeLessThan(-14);
    const med = grenzen([DIAMANT_TEST.medRuit]);
    expect(med.yMax).toBeGreaterThan(145);
    // …en van élk vóór-deel ligt minstens één punt buiten de kaartdoos, anders
    // had de hele laag ook áchter het schild gekund.
    const buiten = (DIVISIE_DIAMANT.voor ?? []).filter((d) =>
      punten(d.d).some(([, y]) => y < 0 || y > 139),
    );
    expect(buiten.length).toBeGreaterThan(0);
  });

  it("het watermerk blijft binnen zijn eigen 100×100-doos", () => {
    // Het motief heeft een andere viewBox dan de ornamentlaag; buiten die doos
    // clipt de svg in het vlak.
    const g = grenzen(DIVISIE_DIAMANT.motief!.paden.map((p) => p.d));
    expect(g.xMin).toBeGreaterThanOrEqual(0);
    expect(g.xMax).toBeLessThanOrEqual(100);
    expect(g.yMin).toBeGreaterThanOrEqual(0);
    expect(g.yMax).toBeLessThanOrEqual(100);
  });

  it("de kroon is links dicht en rechts onafgemaakt", () => {
    // Het hele thema in één toets: links één doorlopende polylijn, rechts
    // meerdere losse streepjes. Zijn ze even lang, dan is de kroon af.
    const lijnen = DIVISIE_DIAMANT.motief!.paden.filter(
      (p) => p.breedte === 1.7,
    );
    const heel = lijnen.filter((p) => p.alpha == null);
    const gestippeld = lijnen.filter((p) => p.alpha != null);
    expect(heel.length).toBe(1);
    expect(gestippeld.length).toBeGreaterThan(1);
  });
});

/* ------------------------ CSS ↔ register-synctest ------------------------ */

// De kleuren staan twee keer: als CSS-tokens (de kaart in de DOM) en als
// literals in het `register` van diamant.ts (de deel-poster, die bewust niet
// van de live tokens leest — #125). Lopen ze uiteen, dan wijkt de export af van
// wat de speler ziet. Deze test leest diamant.css in en vergelijkt de twee.

/** Het `.fut-kaart--diamant { … }`-blok met de kleurtokens. */
function tokenBlok(): string {
  const m = /\.fut-kaart--diamant\s*\{([^}]*)\}/.exec(DIAMANT_CSS);
  expect(
    m,
    "blok .fut-kaart--diamant niet gevonden in diamant.css",
  ).not.toBeNull();
  return m![1];
}

/** Waarde van één custom property, met de regeleinden van Prettier eruit. */
function token(naam: string): string | null {
  const m = new RegExp(`${naam}:\\s*([^;]+);`).exec(tokenBlok());
  return m ? m[1].trim().replace(/\s+/g, " ") : null;
}

/** Het `{ … }` van een regel op een subelement van de kaart. */
function regel(selector: string): string {
  const m = new RegExp(
    `\\.fut-kaart--diamant ${selector.replace(/[.:]/g, "\\$&")}\\s*\\{([^}]*)\\}`,
  ).exec(DIAMANT_CSS);
  expect(
    m,
    `regel voor ${selector} niet gevonden in diamant.css`,
  ).not.toBeNull();
  return m![1];
}

/** De stylesheet zonder zijn `@media (prefers-reduced-motion: no-preference)`-
 *  blokken; nesting telt mee, dus dit knipt echt het hele at-rule weg. */
function zonderBewegingsblok(css: string): string {
  const merk = "@media (prefers-reduced-motion: no-preference)";
  let uit = "";
  let i = 0;
  for (;;) {
    const start = css.indexOf(merk, i);
    if (start < 0) return uit + css.slice(i);
    uit += css.slice(i, start);
    let diepte = 0;
    let j = css.indexOf("{", start);
    for (; j < css.length; j++) {
      if (css[j] === "{") diepte++;
      else if (css[j] === "}" && --diepte === 0) break;
    }
    i = j + 1;
  }
}

describe("diamant.css spiegelt het register (#710)", () => {
  it("inkt, zachte inkt en lijn", () => {
    expect(REGISTER.ink).toBe(token("--kaart-ink"));
    expect(REGISTER.inkSoft).toBe(token("--kaart-ink-soft"));
    expect(REGISTER.lijn).toBe(token("--kaart-lijn"));
  });

  it("vlak-gradient (hi/mid/lo) en de middenstop", () => {
    expect([...REGISTER.vlak]).toEqual([
      token("--kaart-hi"),
      token("--kaart-mid"),
      token("--kaart-lo"),
    ]);
    // Zonder vlakMid tekent de poster de middenstop op 56% — precies waar de
    // gedeelde .fut-kaart__vlak-gradient in FutKaart.css hem zet.
    expect(REGISTER.vlakMid).toBeUndefined();
    expect(FUT_CSS).toContain("var(--kaart-mid) 56%");
  });

  it("frame-gradient: vier stops op dezelfde offsets", () => {
    const stops = [
      ...regel(".fut-kaart__zijde").matchAll(/(#[0-9a-f]{6})\s+(\d+)%/g),
    ];
    expect(stops.map((s) => [Number(s[2]) / 100, s[1]])).toEqual(
      REGISTER.frame.map(([o, k]) => [o, k]),
    );
  });

  it("liner", () => {
    expect(regel(".fut-kaart__liner")).toContain(REGISTER.liner);
  });

  it("echo-contour: offsets als fractie van de kaartbreedte", () => {
    const echo = token("--kaart-echo")!;
    const m =
      /drop-shadow\(\s*calc\(var\(--fut-kw\) \* ([\d.]+)\) calc\(var\(--fut-kw\) \* ([\d.]+)\) 0 (rgba\([^)]*\))/.exec(
        echo,
      );
    expect(m, `--kaart-echo onleesbaar: ${echo}`).not.toBeNull();
    expect(REGISTER.echo).toEqual([[Number(m![1]), Number(m![2]), m![3]]]);
  });

  it("binnenlijnen: dezelfde spreidingen in dezelfde volgorde", () => {
    const lijnen = [
      ...token("--kaart-binnenlijn")!.matchAll(
        /inset 0 0 0 ([\d.]+)px (rgba\([^)]*\))/g,
      ),
    ];
    expect(lijnen.map((l) => [Number(l[1]), l[2]])).toEqual(
      REGISTER.binnenlijn!.map(([s, k]) => [s, k]),
    );
  });

  it("geen stralenkrans, maar het basissatijn terug", () => {
    // FutKaart.css zet de premium-krans wél voor deze tier; diamant.css moet
    // hem overschrijven, anders tekent de DOM een zon die de poster niet kent.
    expect(REGISTER.stralen).toBe(false);
    const na = regel(".fut-kaart__vlak::after");
    expect(na).not.toContain("conic");
    expect(na).toContain("repeating-linear-gradient");
    // En geen eigen weefsel: dan zou het register een `textuur` moeten dragen.
    expect(REGISTER.textuur).toBeUndefined();
    expect(REGISTER.satijnAlpha).toBeUndefined();
  });

  it("gloed en sheen blijven die van de basiskaart", () => {
    // Het register neemt de gedeelde topgloed letterlijk over en laat `sheen`
    // weg; diamant.css mag dus geen eigen vlak-achtergrond of sheen-gradient
    // zetten, anders wijkt de poster af zonder dat het register dat weet.
    expect(FUT_CSS).toContain(REGISTER.glow);
    expect(REGISTER.sheen).toBeUndefined();
    for (const [, , blok] of DIAMANT_CSS.matchAll(
      /\.fut-kaart__vlak(::before)?\s*\{([^}]*)\}/g,
    ))
      expect(blok).not.toContain("background");
  });

  it("beweging staat achter prefers-reduced-motion", () => {
    // Alles wat animeert hoort in het no-preference-blok; anders beweegt de
    // kaart ook voor wie dat heeft uitgezet. Haal dat blok weg en er mag geen
    // animatie overblijven — en er moet er wél één ín zitten, anders bewaakt
    // deze test niets.
    expect(DIAMANT_CSS).toContain("animation:");
    expect(zonderBewegingsblok(DIAMANT_CSS)).not.toContain("animation:");
  });

  it("raakt geen enkele andere kaartvariant", () => {
    // Elke selector in dit bestand moet op .fut-kaart--diamant hangen; één
    // vergeten prefix en de divisie herkleurt de hele stapel.
    for (const [, selector] of DIAMANT_CSS.matchAll(
      /(?:^|\n)([^@\n/][^{\n]*)\{/g,
    ))
      expect(
        selector.trim(),
        `${selector.trim()} is niet op diamant beperkt`,
      ).toContain(".fut-kaart--diamant");
  });
});
