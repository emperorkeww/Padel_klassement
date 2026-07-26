import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { kaartSkin, mix, rgba, schildVorm, type KaartEditie } from "./futKaartCanvas";

// De stylesheets als tekst, voor de synctest onderaan. Bewust via node:fs en
// niet via Vite's ?raw: Vitest kortsluit CSS-imports (css: false) op een lege
// string, óók met de raw-query, dus dan zou de test stil niets vergelijken.
const lees = (pad: string) =>
  readFileSync(fileURLToPath(new URL(pad, import.meta.url)), "utf8");
const FUT_CSS = lees("../../features/rating/components/FutKaart.css");
const FUT_TSX = lees("../../features/rating/components/FutKaart.tsx");
const INDEX_CSS = lees("../../app/index.css");
// De Schandpaal (#682) en, sinds #644, de schande-hero op het dashboard delen
// het kraftpapier van de pias letterlijk — de vezeltegel-pariteitstest onderaan
// bewaakt dat (#705).
const SCHANDPAAL_CSS = lees("../../features/standings/components/Schandpaal.css");
const DASHBOARD_CSS = lees("../../features/dashboard/Dashboard.css");

const EDITIES: KaartEditie[] = [
  "icon",
  "kampioen",
  "inform",
  "onfire",
  "pias",
  "piet",
];

describe("mix / rgba", () => {
  it("mixt hexkleuren zoals color-mix(in srgb, a p, b 1-p)", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("rgb(128, 128, 128)");
    expect(mix("#ff0000", "#00ff00", 1)).toBe("rgb(255, 0, 0)");
    expect(mix("#ff0000", "#00ff00", 0)).toBe("rgb(0, 255, 0)");
  });

  it("slikt zijn eigen uitvoer (#666): een mix van een mix blijft licht", () => {
    // Regressie op de #664-keyline: mix() gaf een rgb()-string terug die de
    // hex-parser als NaN las, waardoor `mix(lijn, "#fff8e8", 0.75)` op élke
    // niet-special poster rgb(64, 62, 58) opleverde — een bijna zwarte lijn.
    const lijn = mix("#3b6ce8", "#a8987a", 0.55);
    expect(lijn).toBe("rgb(108, 128, 183)");
    expect(mix(lijn, "#fff8e8", 0.75)).toBe("rgb(145, 158, 195)");
  });

  it("leest ook rgba() en vervangt de alpha", () => {
    expect(rgba("rgba(240, 199, 102, 0.45)", 0.55)).toBe(
      "rgba(240, 199, 102, 0.55)",
    );
    expect(mix("rgba(255, 255, 255, 0.4)", "#000000", 0.5)).toBe(
      "rgb(128, 128, 128)",
    );
  });

  it("weigert een onbekende notatie i.p.v. stil zwart te tekenen", () => {
    expect(() => mix("rebeccapurple", "#ffffff", 0.5)).toThrow(/notatie/);
  });
});

/** Gemiddelde kanaalwaarde — genoeg om "licht" van "donker" te scheiden.
 *  Slikt beide notaties die de registers gebruiken (hex en rgb/rgba). */
function helderheid(kleur: string): number {
  const kanalen = kleur.startsWith("#")
    ? [
        parseInt(kleur.slice(1, 3), 16),
        parseInt(kleur.slice(3, 5), 16),
        parseInt(kleur.slice(5, 7), 16),
      ]
    : kleur.match(/\d+/g)!.slice(0, 3).map(Number);
  return (kanalen[0] + kanalen[1] + kanalen[2]) / 3;
}

describe("kaartSkin", () => {
  it("kleurt de divisieladder uit de tierkleur", () => {
    const goud = kaartSkin("goud", null);
    expect(goud.kleuren.vlak[0][1]).toBe(mix("#d4a017", "#fdfbf6", 0.2));
    expect(goud.ink).toBe(mix("#d4a017", "#1d1508", 0.52));
    // Zonder editie valt --editie-kleur terug op --kaart-ink.
    expect(goud.editieKleur).toBe(goud.ink);
  });

  it.each([null, "legende" as const, ...EDITIES])(
    "keyline is de lijnkleur op-gemixt naar warm wit (register: %s)",
    (register) => {
      // Dát is wat de keyline ís: color-mix(--kaart-lijn 75%, #fff8e8), dus
      // altijd lichter dan de lijn zelf. Vóór #666 kwam er op de tierkaarten
      // rgb(64, 62, 58) uit — donkerder dan élke lijnkleur.
      const skin =
        register === "legende"
          ? kaartSkin("legende", null)
          : kaartSkin("goud", register);
      expect(helderheid(skin.kleuren.keyline!)).toBeGreaterThan(
        helderheid(skin.lijn),
      );
    },
  );

  it("geeft de special-toptiers hun eigen donkere register", () => {
    expect(kaartSkin("legende", null).kleuren.liner).toBe("#140609");
    expect(kaartSkin("dictator", null).kleuren.liner).toBe("#140409");
    expect(kaartSkin("dictator", null).kleuren.vlak[0][1]).toBe("#7d1a33");
  });

  it("GOAT en dictator zijn niet langer één skin in twee tinten (#710)", () => {
    // De kern van #710: tot dan verschilden de twee alleen in drie kleuren.
    // Nu moeten frame-recept, liner, keyline, sheen én textuur uiteenlopen —
    // in grijstinten herkenbaar, niet enkel in kleur.
    const goat = kaartSkin("legende", null).kleuren;
    const dictator = kaartSkin("dictator", null).kleuren;
    expect(goat.liner).not.toBe(dictator.liner);
    expect(goat.keyline).not.toBe(dictator.keyline);
    expect(goat.sheen).not.toBe(dictator.sheen);
    // Beide hebben een eigen textuur en een eigen ornament: GOAT ruilt de
    // gedeelde stralenkrans in voor een medaillon met ijl satijn, de dictator
    // voor brokaat met een gouden propaganda-zonnestraal.
    expect(goat.stralen).toBe(false);
    expect(goat.textuur).toBeUndefined(); // satijn, maar ijler
    expect(goat.satijnAlpha).toBe(0.035);
    expect(dictator.stralen).toBe(true);
    expect(dictator.stralenKleur).toMatch(/240, 199, 102/);
    expect(dictator.textuur).toBe("brokaat");
    expect(goat.ornament).toBe("goat");
    expect(dictator.ornament).toBe("dictator");
    expect(goat.motief?.paden.length).toBeGreaterThan(0);
    expect(dictator.motief?.paden.length).toBeGreaterThan(0);
    expect(goat.motief?.paden).not.toBe(dictator.motief?.paden);
    // De rand-mechanismen (#710 §6) staan bij beide, maar met een eigen
    // recept: één zachte offset-echo bij de GOAT, een gesloten donkere ring
    // bij de dictator.
    expect(goat.frameRibbels).toBe(true);
    expect(dictator.frameRibbels).toBeUndefined();
    expect(goat.echo).toHaveLength(1);
    expect(dictator.echo).toHaveLength(3);
    expect(goat.binnenlijn).toHaveLength(3);
    expect(dictator.binnenlijn).toHaveLength(3);
  });

  it("houdt de toptier-glans in één regime: beide vast (#710)", () => {
    // Tot #710 draaide de dictator op --dictator-gold (thema-afhankelijk) en
    // de GOAT op een vaste hex, waardoor alleen de dictator-poster in dark
    // mode afweek. Beide registers staan nu op vaste waarden: de GOAT nog via
    // de glans-mix, de dictator op eigen antiekgouden hexen.
    expect(kaartSkin("legende", null).ink).toBe(mix("#f7869f", "#ffffff", 0.8));
    expect(kaartSkin("dictator", null).ink).toBe("#f2dda2");
  });

  it("laat een editie het GOAT-motief winnen maar de hoorns staan (#710)", () => {
    // Vastgelegd gedrag: het motief hoort bij het vlak-register en verdwijnt
    // onder een editie-skin; het ornament hangt aan de tier, dus een GOAT met
    // In-Form houdt zijn hoorns. Spiegel van FutKaart.tsx.
    const informGoat = kaartSkin("legende", "inform").kleuren;
    expect(informGoat.motief).toBeUndefined();
    expect(informGoat.ornament).toBe("goat");
    expect(informGoat.vlak[0][1]).toBe("#232c44");
  });

  it("laat de editie de kleuren van de divisie overschrijven", () => {
    // Zelfde cascade als de CSS: het editie-blok staat ná het special-blok.
    const iconGoud = kaartSkin("goud", "icon");
    const iconGoat = kaartSkin("legende", "icon");
    expect(iconGoud.kleuren.vlak[0][1]).toBe("#fff6fa");
    expect(iconGoat.kleuren.vlak[0][1]).toBe("#fff6fa");
    expect(iconGoat.ink).toBe("#8c2f5a");
    expect(iconGoat.editieKleur).toBe("#c2447c");
  });

  it("houdt de stralenkrans bij de divisie, niet bij de editie", () => {
    expect(kaartSkin("diamant", null).kleuren.stralen).toBe(true);
    expect(kaartSkin("diamant", "icon").kleuren.stralen).toBe(true);
    expect(kaartSkin("brons", "icon").kleuren.stralen).toBe(false);
    // GOAT en dictator vielen met #710 uit het premium-blok: ze hebben een
    // eigen ::after (ijl satijn met medaillon, respectievelijk brokaat) en
    // houden die ook onder een editie — editie-blokken raken ::after niet aan.
    expect(kaartSkin("legende", null).kleuren.stralen).toBe(false);
    expect(kaartSkin("legende", "inform").kleuren.stralen).toBe(false);
    expect(kaartSkin("legende", "inform").kleuren.satijnAlpha).toBe(0.035);
    expect(kaartSkin("dictator", "inform").kleuren.stralen).toBe(false);
    expect(kaartSkin("dictator", "inform").kleuren.textuur).toBe("brokaat");
    // Maar de pias en de Piet zetten hun eigen weefsel en winnen wél.
    expect(kaartSkin("dictator", "pias").kleuren.textuur).toBe("confetti");
  });

  it("zet bij de schand-edities stralen én satijn uit voor hun eigen weefsel", () => {
    // Spiegel van de `background: none`-regel ná het premium-blok in de CSS.
    const pias = kaartSkin("diamant", "pias");
    const piet = kaartSkin("meester", "piet");
    expect(pias.kleuren.stralen).toBe(false);
    expect(pias.kleuren.textuur).toBe("confetti");
    expect(piet.kleuren.stralen).toBe(false);
    expect(piet.kleuren.textuur).toBe("speelkaart");
    // En geen radiale topgloed: die hebben ze in de CSS niet.
    expect(pias.kleuren.glow).toBe("rgba(255, 255, 255, 0)");
    // Mat materiaal (#705): ook geen witte specular-baan. De pias draagt een
    // warme waas op 6% over een brede spreiding (de 30/50/70-::before in de
    // CSS), de Piet niets — hand-gespiegeld, net als de gradient-stops.
    expect(pias.kleuren.sheen).toBe("rgba(255, 240, 214, 0.06)");
    expect(pias.kleuren.sheenSpreiding).toBe(0.2);
    expect(piet.kleuren.sheen).toBe("rgba(255, 255, 255, 0)");
  });

  it("geeft de shimmer-edities hun bredere sheen-baan", () => {
    expect(kaartSkin("goud", "inform").kleuren.sheenSpreiding).toBe(0.12);
    expect(kaartSkin("goud", "onfire").kleuren.sheenSpreiding).toBe(0.12);
    expect(kaartSkin("goud", "kampioen").kleuren.sheenSpreiding).toBeUndefined();
  });
});

/* ----------------------- CSS ↔ canvas-synctest (#666) ---------------------- */

// De kleuren staan twee keer in de codebase: als CSS-tokens (voor de live
// kaart) en als literals hierboven (voor de poster, die bewust niet van de
// live tokens leest — #125). Deze test leest de CSS in en vergelijkt de
// tokendeclaraties, zodat een herijking van een editie niet stil alleen in de
// DOM landt. Bewust beperkt tot de platte tokens: de gradient-stops van
// .fut-kaart__zijde/__vlak betrouwbaar parsen kost meer dan het oplevert —
// die staan met een verwijzing naar dit bestand in FutKaart.css.

/** Waarde van een custom property binnen één CSS-blok, met de
 *  --bigdaddy-*-indirectie van de Icon-editie meteen opgelost. */
function token(blok: string, naam: string): string | null {
  const m = new RegExp(`${naam}:\\s*([^;]+);`).exec(blok);
  if (!m) return null;
  const waarde = m[1].trim();
  const ref = /^var\((--[\w-]+)\)$/.exec(waarde);
  if (!ref) return waarde;
  const root = new RegExp(`${ref[1]}:\\s*([^;]+);`).exec(INDEX_CSS);
  return root ? root[1].trim() : null;
}

/** Het `.fut-kaart--<editie> { … }`-blok met de kleurtokens. */
function editieBlok(editie: KaartEditie): string {
  const m = new RegExp(`\\.fut-kaart--${editie}\\s*\\{([^}]*)\\}`).exec(FUT_CSS);
  expect(m, `blok .fut-kaart--${editie} niet gevonden in FutKaart.css`).not.toBeNull();
  return m![1];
}

/** Het `.fut-kaart--<key> { … }`-blok dát `prop` declareert. De toptiers
 *  hebben er twee: de divisie→tierkleur-mapping en, verderop, hun eigen
 *  register — `editieBlok` zou altijd de eerste pakken. */
function tierBlok(key: string, prop: string): string {
  for (const m of FUT_CSS.matchAll(
    new RegExp(`\\.fut-kaart--${key}\\s*\\{([^}]*)\\}`, "g"),
  ))
    if (m[1].includes(prop)) return m[1];
  throw new Error(`blok .fut-kaart--${key} met ${prop} niet gevonden`);
}

describe("editie-registers spiegelen FutKaart.css", () => {
  it.each(EDITIES)("%s: inkt, lijn en editie-kleur", (editie) => {
    const blok = editieBlok(editie);
    const skin = kaartSkin("goud", editie);
    expect(skin.ink).toBe(token(blok, "--kaart-ink"));
    expect(skin.inkSoft).toBe(token(blok, "--kaart-ink-soft"));
    expect(skin.lijn).toBe(token(blok, "--kaart-lijn"));
    expect(skin.editieKleur).toBe(token(blok, "--editie-kleur"));
  });

  it.each(EDITIES)("%s: vlak-gradient (hi/mid/lo)", (editie) => {
    const blok = editieBlok(editie);
    const hi = token(blok, "--kaart-hi");
    // In-Form en On-Fire zetten geen hi/mid/lo: hun vlak staat als literale
    // gradient in de CSS (donkere registers). Die stops blijven handmatig
    // gespiegeld; hier valt er dus niets te vergelijken.
    if (hi == null) return;
    const stops = kaartSkin("goud", editie).kleuren.vlak.map((s) => s[1]);
    expect(stops).toEqual([
      hi,
      token(blok, "--kaart-mid"),
      token(blok, "--kaart-lo"),
    ]);
  });

  it.each(["pias", "piet"] as const)(
    "%s: mat frame i.p.v. metaal (#705)",
    (editie) => {
      // Twee vlakke stops, geen glanspunten — de frame-tokens staan in het
      // editie-blok en worden hier dus wél uit de CSS gelezen.
      const blok = editieBlok(editie);
      const { kleuren } = kaartSkin("goud", editie);
      expect(kleuren.frame).toEqual([
        [0, token(blok, "--kaart-frame-hi")],
        [1, token(blok, "--kaart-frame-lo")],
      ]);
      if (editie === "pias") {
        expect(kleuren.snijkant).toBe(token(blok, "--kaart-snijkant"));
      } else {
        // De Piet heeft geen aparte snijkant-laag: zijn bone liner ís de
        // witte kern van het kaartkarton.
        expect(kleuren.snijkant).toBeUndefined();
        expect(kleuren.liner).toBe("#efe7d2");
      }
    },
  );

  it("pias-kaart, Schandpaal en hero delen letterlijk dezelfde vezeltegel (#705/#644)", () => {
    // Zelfde papier op kaart, klassement en dashboard-hero: de 28px-SVG-tegel
    // moet in alle drie de stylesheets byte-gelijk zijn, anders lopen de
    // kraftvlakken stil uit elkaar (Schandpaal en hero hebben geen
    // canvas-tegenhanger of eigen synctest).
    const tegel = (css: string, blok: RegExp): string | undefined => {
      const m = blok.exec(css);
      expect(m).not.toBeNull();
      return /url\("(data:image\/svg\+xml[^"]+)"\)/.exec(m![0])?.[1];
    };
    const vanKaart = tegel(
      FUT_CSS,
      /\.fut-kaart--pias \.fut-kaart__vlak\s*\{[^}]*\}/,
    );
    const vanSchandpaal = tegel(SCHANDPAAL_CSS, /\.schandpaal\s*\{[^}]*\}/);
    const vanHero = tegel(DASHBOARD_CSS, /\.hero--pias\s*\{[^}]*\}/);
    expect(vanKaart).toBeDefined();
    expect(vanKaart).toBe(vanSchandpaal);
    expect(vanKaart).toBe(vanHero);
  });

  /** De `--<prefix>-<naam>: #hex`-declaraties binnen één CSS-blok. Alleen hexen:
   *  een rgba()-lijn (In-Form/On-Fire) valt er bewust buiten — die staat op
   *  beide plekken letterlijk en heeft geen indirectie om te controleren. */
  const waarden = (css: string, blok: RegExp, prefix: string) => {
    const m = blok.exec(css);
    expect(m).not.toBeNull();
    const out: Record<string, string> = {};
    for (const v of m![0].matchAll(
      new RegExp(`--${prefix}-([\\w-]+):\\s*(#[0-9a-f]{3,8});`, "g"),
    ))
      out[v[1]] = v[2];
    return out;
  };

  it("de schande-hero's houden de materiaalwaarden van hun FUT-editie (#644)", () => {
    // De hero kopieert de lokale hexen van de kaart-edities (geen gedeelde
    // tokens: dit materiaal is thema-onafhankelijk, zie Dashboard.css). Zonder
    // deze check drijft de hero stil weg zodra de kaart hertint wordt — precies
    // wat #705 met de kaart en De Schandpaal deed.
    const kaartPias = waarden(FUT_CSS, /\.fut-kaart--pias\s*\{[^}]*\}/, "kaart");
    const heroPias = waarden(DASHBOARD_CSS, /\.hero--pias\s*\{[^}]*\}/, "kraft");
    // De hero volgt de póstervariant van De Schandpaal (lichtere --lo, want er
    // staat tekst tot onderaan), maar deelt de rest met de kaart.
    const schandpaal = waarden(SCHANDPAAL_CSS, /\.schandpaal\s*\{[^}]*\}/, "kraft");
    expect(heroPias.hi).toBe(kaartPias.hi);
    expect(heroPias.ink).toBe(kaartPias.ink);
    expect(heroPias.lijn).toBe(kaartPias.lijn);
    // Het stempelrood heet op de kaart --editie-kleur (buiten de --kaart-*-reeks).
    expect(heroPias.stempel).toBe(
      /--editie-kleur:\s*(#[0-9a-f]{3,8});/.exec(
        /\.fut-kaart--pias\s*\{[^}]*\}/.exec(FUT_CSS)![0],
      )![1],
    );
    expect(heroPias.stempel).toBe(schandpaal.stempel);
    expect(heroPias.mid).toBe(schandpaal.mid);
    expect(heroPias.lo).toBe(schandpaal.lo);

    const kaartPiet = waarden(FUT_CSS, /\.fut-kaart--piet\s*\{[^}]*\}/, "kaart");
    const heroPiet = waarden(DASHBOARD_CSS, /\.hero--piet\s*\{[^}]*\}/, "kaart");
    for (const sleutel of ["hi", "mid", "lo", "ink", "lijn"])
      expect(heroPiet[sleutel]).toBe(kaartPiet[sleutel]);
    expect(heroPiet.lak).toBe(kaartPiet["frame-hi"]);
    expect(heroPiet["lak-diep"]).toBe(kaartPiet["frame-lo"]);
  });

  it("de eer-hero's houden de materiaalwaarden van hun FUT-editie (#760)", () => {
    // Zelfde bewaking als bij de schande-hero's hierboven, nu voor de drie
    // edities die de hero sinds #760 óók draagt.
    const kaartKampioen = waarden(
      FUT_CSS,
      /\.fut-kaart--kampioen\s*\{[^}]*\}/,
      "kaart",
    );
    const heroKampioen = waarden(
      DASHBOARD_CSS,
      /\.hero--kampioen\s*\{[^}]*\}/,
      "lauwer",
    );
    for (const sleutel of ["hi", "mid", "ink", "ink-soft", "lijn"])
      expect(heroKampioen[sleutel]).toBe(kaartKampioen[sleutel]);
    expect(heroKampioen.groen).toBe(
      token(editieBlok("kampioen"), "--editie-kleur"),
    );
    // De diepgroene binnenring is de liner van de kaart.
    expect(heroKampioen.diep).toBe(kaartSkin("goud", "kampioen").kleuren.liner);
    // Eén bewuste afwijking (zie Dashboard.css): de donkerste stop is op een
    // hero lichter dan op de kaart, anders zakt de zachte inkt onder AA. Deze
    // assertie legt vast dát het een keuze is — niet dat er iets verlopen is.
    expect(heroKampioen.lo).not.toBe(kaartKampioen.lo);

    // In-Form en On-Fire zetten geen hi/mid/lo op de kaart: hun vlak staat als
    // literale gradient in de CSS. De hero-stops horen dus bij de vlak-stops van
    // het canvas-register, dat diezelfde gradient spiegelt.
    for (const [editie, prefix, inkt, vlakNamen] of [
      ["inform", "inform", "goud", ["navy", "navy-mid", "navy-diep"]],
      ["onfire", "onfire", "ember", ["sintel", "sintel-mid", "sintel-diep"]],
    ] as const) {
      const kaart = waarden(
        FUT_CSS,
        new RegExp(`\\.fut-kaart--${editie}\\s*\\{[^}]*\\}`),
        "kaart",
      );
      const hero = waarden(
        DASHBOARD_CSS,
        new RegExp(`\\.hero--${prefix}\\s*\\{[^}]*\\}`),
        prefix,
      );
      expect(hero[inkt]).toBe(kaart.ink);
      expect(hero[`${inkt}-soft`]).toBe(kaart["ink-soft"]);
      expect(vlakNamen.map((n) => hero[n])).toEqual(
        kaartSkin("goud", editie).kleuren.vlak.map((s) => s[1]),
      );
    }
  });

  it("GOAT: het rand-register staat in de CSS én in de canvas-tabel (#710)", () => {
    // De vier rand-mechanismen van #710 leven op twee plekken: als CSS-vars
    // op .fut-kaart--legende en als velden in kaartSkin(). Zonder deze check
    // kan de een herijkt worden zonder de ander — precies wat #666 voor de
    // kleuren al dichtzette.
    const blok = tierBlok("legende", "--kaart-echo");
    const { kleuren } = kaartSkin("legende", null);

    // Echo: de CSS-calc op --fut-kw draagt dezelfde fracties en kleur als de
    // canvas-offsets (die tegen de kaartbreedte rekenen).
    const echo = /--kaart-echo:([^;]+);/.exec(blok)?.[1] ?? "";
    const [dx, dy, kleur] = kleuren.echo![0];
    expect(echo).toContain(`* ${dx})`);
    expect(echo).toContain(`* ${dy})`);
    expect(echo.replace(/\s+/g, " ")).toContain(kleur);

    // Binnenlijnen: elke inset-schaduw uit de CSS komt als [spreiding, kleur]
    // terug, in dezelfde volgorde (smal → breed).
    const binnenlijn = /--kaart-binnenlijn:([^;]+);/.exec(blok)?.[1] ?? "";
    for (const [spreiding, lijnKleur] of kleuren.binnenlijn!) {
      expect(binnenlijn.replace(/\s+/g, " ")).toContain(
        `inset 0 0 0 ${spreiding}px ${lijnKleur}`,
      );
    }

    // Frame-ribbels en het ijle satijn: aanwezig in de CSS, aan in de tabel.
    const zijde = /\.fut-kaart--legende \.fut-kaart__zijde\s*\{[^}]*\}/.exec(
      FUT_CSS,
    )?.[0];
    expect(zijde).toContain("repeating-conic-gradient");
    expect(kleuren.frameRibbels).toBe(true);
    const after = /\.fut-kaart--legende \.fut-kaart__vlak::after\s*\{[^}]*\}/.exec(
      FUT_CSS,
    )?.[0];
    expect(after, "GOAT mist zijn eigen ::after-textuur").toBeDefined();
    expect(after).not.toContain("conic");

    // En de liner/keyline die het register van de dictator scheiden.
    const liner = /\.fut-kaart--legende \.fut-kaart__liner\s*\{\s*background:\s*([^;]+);/.exec(
      FUT_CSS,
    )?.[1];
    expect(kleuren.liner).toBe(liner);
    const keyline = /\.fut-kaart--legende \.fut-kaart__keyline\s*\{\s*background:\s*([^;]+);/.exec(
      FUT_CSS,
    )?.[1];
    expect(kleuren.keyline).toBe(keyline);
  });

  it("de toptiers draaien allebei op vaste hexen (#710)", () => {
    // Eén regime: geen var(--dictator-*) meer in de kaartregisters, anders
    // wijkt de DOM-kaart in dark mode weer af van de vastgepinde poster. De
    // inkt van elk register moet gelijk zijn aan zijn eigen CSS-token.
    for (const tier of ["legende", "dictator"] as const) {
      const blok = tierBlok(tier, "--sp-glans");
      const glans = /--sp-glans:\s*([^;]+);/.exec(blok)?.[1];
      expect(glans, `${tier}: --sp-glans ontbreekt`).toBeDefined();
      expect(glans, `${tier}: --sp-glans moet een vaste hex zijn`).toMatch(
        /^#[0-9a-f]{6}$/,
      );
      const skin = kaartSkin(tier, null);
      const ink = token(blok, "--kaart-ink")!;
      // De GOAT mixt zijn inkt uit de glans (color-mix in de CSS), de dictator
      // zet antiekgouden hexen rechtstreeks.
      expect(skin.ink).toBe(
        ink.startsWith("#") ? ink : mix(glans!, "#ffffff", 0.8),
      );
      expect(skin.inkSoft).toBe(
        (token(blok, "--kaart-ink-soft") ?? "").startsWith("#")
          ? token(blok, "--kaart-ink-soft")
          : mix(glans!, "#b7a98c", 0.65),
      );
    }
  });

  it("het dictator-register spiegelt zijn CSS-waarden (#710)", () => {
    const blok = tierBlok("dictator", "--kaart-echo");
    const { kleuren } = kaartSkin("dictator", null);
    // Liner, keyline en de drie binnenlijnen komen uit de CSS.
    const liner = /\.fut-kaart--dictator \.fut-kaart__liner\s*\{\s*background:\s*([^;]+);/.exec(
      FUT_CSS,
    )?.[1];
    expect(kleuren.liner).toBe(liner);
    const keyline = /\.fut-kaart--dictator \.fut-kaart__keyline\s*\{\s*background:\s*([^;]+);/.exec(
      FUT_CSS,
    )?.[1];
    expect(kleuren.keyline).toBe(keyline);
    const binnenlijn = /--kaart-binnenlijn:([^;]+);/.exec(blok)?.[1] ?? "";
    for (const [spreiding, kleur] of kleuren.binnenlijn!)
      expect(binnenlijn.replace(/\s+/g, " ")).toContain(
        `inset 0 0 0 ${spreiding}px ${kleur}`,
      );
    // Brokaat en zonnestraal staan in het eigen ::after/vlak-blok, niet in het
    // gedeelde premium-blok.
    const premium = /\.fut-kaart--platina \.fut-kaart__vlak::after[^{]*\{/.exec(
      FUT_CSS,
    )?.[0];
    expect(premium).not.toContain("dictator");
    const after = /\.fut-kaart--dictator \.fut-kaart__vlak::after\s*\{[^}]*\}/.exec(
      FUT_CSS,
    )?.[0];
    expect(after).toContain("45deg");
    expect(kleuren.textuur).toBe("brokaat");
  });

  it("de dictator heeft een eigen schildvorm, de GOAT houdt de kroon-crest (#710)", () => {
    // De allerhoogste tier verschilt nu ook in silhouet — dat is het
    // grijswaarden-criterium uit de issue. De clipPath moet in FutKaart.tsx
    // bestaan, want de CSS verwijst ernaar.
    expect(schildVorm("legende")).toBe("kroon");
    expect(schildVorm("dictator")).toBe("troon");
    const blok = tierBlok("dictator", "--schild");
    expect(blok).toContain("url(#fut-schild-troon)");
    expect(FUT_TSX).toContain('id="fut-schild-troon"');
  });

  it("Big Daddy: rand-register en watermerk staan in de CSS én in de tabel (#710)", () => {
    // Zelfde bewaking als bij de GOAT hierboven, nu voor het icon-register:
    // echo, binnenlijnen en de twee motiefmaten leven op twee plekken.
    const blok = editieBlok("icon");
    const { kleuren } = kaartSkin("goud", "icon");

    const echo = /--kaart-echo:([^;]+);/.exec(blok)?.[1] ?? "";
    const [dx, dy, kleur] = kleuren.echo![0];
    expect(echo).toContain(`* ${dx})`);
    expect(echo).toContain(`* ${dy})`);
    expect(echo.replace(/\s+/g, " ")).toContain(kleur);

    const binnenlijn = /--kaart-binnenlijn:([^;]+);/.exec(blok)?.[1] ?? "";
    expect(kleuren.binnenlijn).toHaveLength(3);
    for (const [spreiding, lijnKleur] of kleuren.binnenlijn!) {
      expect(binnenlijn.replace(/\s+/g, " ")).toContain(
        `inset 0 0 0 ${spreiding}px ${lijnKleur}`,
      );
    }

    // Motiefmaat: de CSS-klasse van het kroon-watermerk draagt dezelfde
    // breedte en positie als het canvas-register.
    const motiefBlok = /\.fut-kaart__motief--kroon\s*\{([^}]*)\}/.exec(FUT_CSS);
    expect(motiefBlok, ".fut-kaart__motief--kroon ontbreekt").not.toBeNull();
    expect(Number(token(motiefBlok![1], "--motief-b"))).toBeCloseTo(
      kleuren.motief!.breedte * 100,
      6,
    );
    expect(
      Number(token(motiefBlok![1], "--motief-pos")!.replace("%", "")),
    ).toBeCloseTo(kleuren.motief!.positie * 100, 6);
    expect(kleuren.motief!.paden.length).toBeGreaterThan(0);

    // Parelmoeren glansbaan: de CSS overschrijft de ::before, de tabel zet een
    // eigen sheen mét spreiding (40/50/60 daar ≡ 0.1 hier).
    const before = /\.fut-kaart--icon \.fut-kaart__vlak::before\s*\{[^}]*\}/.exec(
      FUT_CSS,
    )?.[0];
    expect(before, "Big Daddy mist zijn eigen glansbaan").toBeDefined();
    expect(kleuren.sheenSpreiding).toBe(0.1);
  });

  it("het editie-ornament wint van het tier-ornament (#710)", () => {
    // Vastgelegd gedrag: het ornament hangt normaal aan de tíer (een GOAT houdt
    // zijn hoorns onder In-Form), maar een editie met eigen ornament wint —
    // een Big Daddy die óók GOAT is, draagt kroon en linten, geen bokhoorns.
    expect(kaartSkin("goud", "icon").kleuren.ornament).toBe("bigdaddy");
    expect(kaartSkin("legende", "icon").kleuren.ornament).toBe("bigdaddy");
    expect(kaartSkin("legende", "inform").kleuren.ornament).toBe("goat");
    expect(kaartSkin("goud", "kampioen").kleuren.ornament).toBeUndefined();
    // En het GOAT-medaillon wijkt voor het kroon-watermerk.
    expect(kaartSkin("legende", "icon").kleuren.motief).toBe(
      kaartSkin("goud", "icon").kleuren.motief,
    );
    expect(kaartSkin("legende", "inform").kleuren.motief).toBeUndefined();
  });

  it("dekt élke editie die FutKaart.css kleurt", () => {
    // Vangnet voor een zévende editie: als de CSS er een bijkrijgt zonder dat
    // de canvas-tabel meegroeit, valt dat hier op i.p.v. op de poster.
    const gevonden = new Set(
      [...FUT_CSS.matchAll(/\.fut-kaart--([a-z]+)\s*\{[^}]*--editie-kleur:/g)].map(
        (m) => m[1],
      ),
    );
    expect([...gevonden].sort()).toEqual([...EDITIES].sort());
  });
});