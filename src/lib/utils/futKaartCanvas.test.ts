import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import {
  drawKaartOrnamentVoor,
  drawKaartSchild,
  kaartSkin,
  mix,
  rgba,
  schildVorm,
  type KaartEditie,
} from "./futKaartCanvas";
import {
  KAART_MASTERS,
  type GeladenMaster,
  type MasterNaam,
} from "@/features/rating/components/kaartMasters";
import { GOAT_ICOON } from "@/features/rating/components/futKaartOrnamenten";
import { DIVISIE_KAARTEN } from "@/features/rating/components/divisies";

// De stylesheets als tekst, voor de synctest onderaan. Bewust via node:fs en
// niet via Vite's ?raw: Vitest kortsluit CSS-imports (css: false) op een lege
// string, óók met de raw-query, dus dan zou de test stil niets vergelijken.
const lees = (pad: string) =>
  readFileSync(fileURLToPath(new URL(pad, import.meta.url)), "utf8");
const FUT_CSS = lees("../../features/rating/components/FutKaart.css");
const FUT_TSX = lees("../../features/rating/components/FutKaart.tsx");
const CANVAS_TS = lees("./futKaartCanvas.ts");
const INDEX_CSS = lees("../../app/index.css");
// De Schandpaal (#682) en, sinds #644, de schande-hero op het dashboard delen
// het kraftpapier van de pias letterlijk — de vezeltegel-pariteitstest onderaan
// bewaakt dat (#705).
const SCHANDPAAL_CSS = lees("../../features/standings/components/Schandpaal.css");
// Sinds #771 staat de kaart-CSS van het dashboard in zijn eigen bestand naast de
// component, niet meer in de stylesheet van de hele pagina.
const HERO_CSS = lees("../../features/dashboard/components/DashboardHero.css");

// De negen divisieregisters, als [naam, css]-paren voor de cascadetest.
const DIVISIE_CSS: ReadonlyArray<readonly [string, string]> = [
  "slof",
  "karton",
  "hout",
  "brons",
  "zilver",
  "goud",
  "platina",
  "diamant",
  "meester",
].map((naam) => [
  naam,
  lees(`../../features/rating/components/divisies/${naam}.css`),
]);

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
  it("alle negen basisdivisies dragen nu een eigen register (#710)", () => {
    // Hier stond een test op de generieke ladderformule, met de laatste divisie
    // zónder register als onderwerp — eerst `hout`, daarna `slof`. Met de
    // Ballenraper- en Sletje-kaarten erbij hebben alle negen er een, dus die test
    // had geen onderwerp meer. Dit is de invariant die er in de plaats voor komt:
    // geen divisie valt nog terug op de formule. De formule zélf blijft staan als
    // vangnet voor een tier die niet in het register staat, en de test hieronder
    // bewaakt dat een register de formule echt overrulet.
    expect(DIVISIE_KAARTEN.map((d) => d.key).sort()).toEqual(
      [
        "brons",
        "diamant",
        "goud",
        "hout",
        "karton",
        "meester",
        "platina",
        "slof",
        "zilver",
      ].sort(),
    );
    for (const divisie of DIVISIE_KAARTEN) {
      expect(divisie.register, `${divisie.key} mist zijn register`).toBeTruthy();
      // En het register moet ook echt bij de kaart aankomen.
      expect(kaartSkin(divisie.key, null).kleuren.divisie).toBe(divisie.key);
    }
  });

  it("laat een divisie met eigen register de ladderformule overrulen (#710)", () => {
    // Zeven van de negen basisdivisies zijn hertekend en dragen nu hun eigen
    // materiaal; de formule uit de vorige test raakt hen dus niet meer.
    const goud = kaartSkin("goud", null);
    expect(goud.kleuren.vlak[0][1]).not.toBe(mix("#d4a017", "#fdfbf6", 0.2));
    expect(goud.kleuren.divisie).toBe("goud");
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
    expect(goat.satijnAlpha).toBe(0.04);
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



  it("laat de editie de kleuren van de divisie overschrijven", () => {
    // Zelfde cascade als de CSS: het editie-blok staat ná het special-blok.
    const iconGoud = kaartSkin("goud", "icon");
    const iconGoat = kaartSkin("legende", "icon");
    expect(iconGoud.kleuren.vlak[0][1]).toBe("#f9ccdf");
    expect(iconGoat.kleuren.vlak[0][1]).toBe("#f9ccdf");
    expect(iconGoat.ink).toBe("#8b0f4c");
    expect(iconGoat.editieKleur).toBe("#b81263");
  });

  it("houdt de stralenkrans bij de divisie, niet bij de editie", () => {
    // De gedeelde stralenkrans hoort bij de premium-schildvorm en overleeft de
    // editie. Sinds #710 zet een hertekende divisie hem uit — die brengt zijn
    // eigen textuur mee — dus meten we hem op een tier die nog op de generieke
    // ladder draait: meester heeft de spitse vleugels, hout niet.
    // De Icon viel er met #834 uit: hij brengt sindsdien zelf een matelas-
    // weefsel mee, dus meten we de krans op een editie zonder eigen textuur.
    expect(kaartSkin("meester", "kampioen").kleuren.stralen).toBe(true);
    expect(kaartSkin("hout", "kampioen").kleuren.stralen).toBe(false);
    expect(kaartSkin("meester", "icon").kleuren.stralen).toBe(false);
    // GOAT en dictator vielen met #710 uit het premium-blok: ze hebben een
    // eigen ::after (ijl satijn met medaillon, respectievelijk brokaat) en
    // houden die ook onder een editie — editie-blokken raken ::after niet aan.
    expect(kaartSkin("legende", null).kleuren.stralen).toBe(false);
    expect(kaartSkin("legende", "kampioen").kleuren.stralen).toBe(false);
    expect(kaartSkin("legende", "kampioen").kleuren.satijnAlpha).toBe(0.04);
    expect(kaartSkin("dictator", "kampioen").kleuren.stralen).toBe(false);
    expect(kaartSkin("dictator", "kampioen").kleuren.textuur).toBe("brokaat");
    // Maar wie zijn eigen weefsel meebrengt — pias, Piet en, sinds #710,
    // In-Form met zijn titaniumgroeven — wint wél: dat ::after staat in de CSS
    // ná het toptier- én het premium-blok.
    expect(kaartSkin("dictator", "pias").kleuren.textuur).toBe("confetti");
    expect(kaartSkin("dictator", "inform").kleuren.textuur).toBe("titanium");
    expect(kaartSkin("diamant", "inform").kleuren.stralen).toBe(false);
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

  it("tekent de storm-binnenlaag van In-Form als tweede, vullend motief (#834)", () => {
    // De storm-binnenlaag rijdt als motief2 mee: vullend in kaart-units, net
    // als het pias-motief, en bóvenop het gewone pulse-ring-motief. Zonder dit
    // veld zou de poster de wolk uit het kaartvlak missen die de DOM wél
    // tekent — de uitbraak begint dan nergens.
    const skin = kaartSkin("goud", "inform").kleuren;
    expect(skin.motief2?.vullend).toBe(true);
    expect(skin.motief2?.paden.length).toBeGreaterThan(0);
    // Alleen In-Form heeft een tweede motieflaag.
    expect(kaartSkin("goud", "onfire").kleuren.motief2).toBeUndefined();
    expect(kaartSkin("goud", "pias").kleuren.motief2).toBeUndefined();
  });

  it("geeft de shimmer-edities hun bredere sheen-baan", () => {
    expect(kaartSkin("goud", "kampioen").kleuren.sheenSpreiding).toBeUndefined();
    // In-Form én On Fire ruilden bij #710 de drie-stops-baan in voor een eigen
    // stoplijst — dan is sheenSpreiding dood gewicht.
    expect(kaartSkin("goud", "onfire").kleuren.sheenStops?.length).toBeGreaterThan(3);
    // In-Form:
    // zachte aanloop, gouden piek, witte kern. Dan is sheenSpreiding dood
    // gewicht en moeten de stops zélf oplopen en weer uitdoven.
    const stops = kaartSkin("goud", "inform").kleuren.sheenStops!;
    expect(stops).toHaveLength(6);
    expect(stops[0][0]).toBeLessThan(stops.at(-1)![0]);
    const alpha = (kleur: string) => Number(/([\d.]+)\)$/.exec(kleur)![1]);
    expect(alpha(stops[0][1])).toBe(0);
    expect(alpha(stops.at(-1)![1])).toBe(0);
    expect(Math.max(...stops.map((s) => alpha(s[1])))).toBeLessThan(0.28);
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

  it("de zeven specials delen hun frame-overgangen en layout met de canvas-poster (#834)", () => {
    const gevallen = [
      {
        naam: "Big Daddy",
        blok: editieBlok("icon"),
        skin: kaartSkin("goud", "icon"),
      },
      {
        naam: "GOAT",
        blok: tierBlok("legende", "--kaart-randgloed"),
        skin: kaartSkin("legende", null),
      },
      {
        naam: "El Padelissimo",
        blok: tierBlok("dictator", "--kaart-randgloed"),
        skin: kaartSkin("dictator", null),
      },
      ...(["pias", "piet", "inform", "onfire"] as const).map((editie) => ({
        naam: editie,
        blok: editieBlok(editie),
        skin: kaartSkin("goud", editie),
      })),
    ];

    expect(
      FUT_TSX.match(/className="fut-kaart__randwaas"/g),
      "voor- en achterkant missen hun randwaaslaag",
    ).toHaveLength(2);
    const laag =
      /\.fut-kaart__randwaas\s*\{[\s\S]*?\n\}/.exec(FUT_CSS)?.[0] ?? "";
    expect(laag.match(/radial-gradient/g)).toHaveLength(4);

    for (const { naam, blok, skin } of gevallen) {
      const { kleuren } = skin;
      expect(kleuren.randGloed, `${naam}: canvas-randgloed ontbreekt`).toBeDefined();
      expect(kleuren.randWaas, `${naam}: canvas-randwaas ontbreekt`).toBeDefined();
      // De diktes hoeven niet bij alle specials gelijk te zijn — de GOAT draagt
      // sinds zijn breakout een zwaardere lijst dan de rest, en Big Daddy sinds
      // #834 een zwaardere goud-magenta lijst — maar CSS en canvas moeten wél
      // dezelfde fracties van de kaartbreedte gebruiken, anders wijkt de
      // deel-poster van de kaart af.
      const cssDiktes = (
        [
          "--kaart-frame-dikte",
          "--kaart-liner-dikte",
          "--kaart-keyline-dikte",
        ] as const
      ).map((eigenschap) => {
        const waarde = token(blok, eigenschap) ?? "";
        const fractie = /\*\s*([\d.]+)\)/.exec(waarde);
        expect(fractie, `${naam}: geen kw-fractie in ${eigenschap}`).not.toBeNull();
        return Number(fractie![1]);
      });
      expect(kleuren.randDiktes, `${naam}: zware lijst ontbreekt`).toEqual(
        cssDiktes,
      );
      expect(skin.naamplaat, `${naam}: naamplaatverloop ontbreekt`).toHaveLength(5);

      const [blur, gloed] = kleuren.randGloed!;
      const cssGloed = token(blok, "--kaart-randgloed")?.replace(/\s+/g, " ") ?? "";
      expect(cssGloed, `${naam}: blurfractie`).toContain(`* ${blur})`);
      expect(cssGloed, `${naam}: gloedkleur`).toContain(gloed);

      for (const zijde of ["links", "rechts", "boven", "onder"] as const) {
        expect(
          token(blok, `--kaart-randwaas-${zijde}`),
          `${naam}: ${zijde}`,
        ).toBe(kleuren.randWaas![zijde]);
      }
    }

    expect(kaartSkin("goud", "icon").kleuren.feestFacetten).toBe(true);
    expect(kaartSkin("legende", null).kleuren.achtergrondRingen?.stralen).toEqual([
      0.21, 0.3,
    ]);
  });

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
    const vanHero = tegel(HERO_CSS, /\.hero--pias\s*\{[^}]*\}/);
    expect(vanKaart).toBeDefined();
    expect(vanKaart).toBe(vanSchandpaal);
    expect(vanKaart).toBe(vanHero);
  });

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
    const vanHero = tegel(HERO_CSS, /\.hero--pias\s*\{[^}]*\}/);
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
    const heroPias = waarden(HERO_CSS, /\.hero--pias\s*\{[^}]*\}/, "kraft");
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
    const heroPiet = waarden(HERO_CSS, /\.hero--piet\s*\{[^}]*\}/, "kaart");
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
      HERO_CSS,
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
    // Eén bewuste afwijking (zie DashboardHero.css): de donkerste stop is op een
    // hero lichter dan op de kaart, anders zakt de zachte inkt onder AA. Deze
    // assertie legt vast dát het een keuze is — niet dat er iets verlopen is.
    expect(heroKampioen.lo).not.toBe(kaartKampioen.lo);

    // In-Form en On-Fire zetten geen hi/mid/lo op de kaart: hun vlak staat als
    // literale gradient in de CSS. De hero-stops horen dus bij de vlak-stops van
    // het canvas-register, dat diezelfde gradient spiegelt.
    for (const [editie, prefix, inkt, vlakNamen] of [
      ["inform", "inform", "goud", ["zwart", "zwart-mid", "zwart-diep"]],
      ["onfire", "onfire", "ember", ["sintel", "sintel-mid", "sintel-diep"]],
    ] as const) {
      const kaart = waarden(
        FUT_CSS,
        new RegExp(`\\.fut-kaart--${editie}\\s*\\{[^}]*\\}`),
        "kaart",
      );
      const hero = waarden(
        HERO_CSS,
        new RegExp(`\\.hero--overlay-${prefix}\\s*\\{[^}]*\\}`),
        prefix,
      );
      expect(hero[inkt]).toBe(kaart.ink);
      expect(hero[`${inkt}-soft`]).toBe(kaart["ink-soft"]);
      expect(vlakNamen.map((n) => hero[n])).toEqual(
        kaartSkin("goud", editie).kleuren.vlak.map((s) => s[1]),
      );
    }
  });

  it("de toptier-basis van de dashboardkaart deelt de glansbaan met de kaart (#771)", () => {
    // GOAT en El Padelissimo hebben geen divisieregister; hun basis op het
    // dashboard is de státische stand van de premium glans (#773). De baan komt
    // letterlijk van de kaart — alleen de kracht verschilt (de hero draagt hem
    // op het gewone kaartoppervlak, niet op donker materiaal), en dát is dan ook
    // het enige wat hier mag afwijken.
    for (const [tier, klasse] of [
      ["legende", "goat"],
      ["dictator", "dictator"],
    ] as const) {
      const kaart = new RegExp(
        `\\.fut-kaart--${tier} \\.fut-kaart__glans\\s*\\{([\\s\\S]*?)\\n\\}`,
      ).exec(FUT_CSS);
      expect(kaart, `glansblok van ${tier} niet gevonden`).not.toBeNull();
      const hero = new RegExp(`\\.hero--glans-${klasse}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(
        HERO_CSS,
      );
      expect(hero, `glansblok van ${klasse} niet gevonden in de hero`).not.toBeNull();

      const baan = (blok: string, prefix: string) =>
        new RegExp(`--${prefix}-baan:([\\s\\S]*?);`)
          .exec(blok)?.[1]
          .replace(/\s+/g, " ")
          .trim();
      expect(baan(hero![1], "hero-glans")).toBe(baan(kaart![1], "glans"));
      expect(/--hero-glans-hoek:\s*([^;]+);/.exec(hero![1])?.[1]).toBe(
        /--glans-hoek:\s*([^;]+);/.exec(kaart![1])?.[1],
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

  it("GOAT: diagonale binnenstructuur en de twee ornamentlagen (#772)", () => {
    const { kleuren } = kaartSkin("legende", null);
    const after =
      /\.fut-kaart--legende \.fut-kaart__vlak::after\s*\{[^}]*\}/
        .exec(FUT_CSS)?.[0]
        ?.replace(/\s+/g, " ") ?? "";
    // Twee diagonale banen (#772): het fijne witte satijn plus een bredere
    // getinte baan eronder. De canvas-tabel moet dezelfde tint dragen, anders
    // mist de poster de binnenstructuur van de referentie.
    expect(after.match(/repeating-linear-gradient/g)).toHaveLength(2);
    const [tint] = kleuren.satijnBaan!;
    expect(after).toContain(tint);
    // Beide banen lopen in de sheen-richting; de canvas-hatch rekent met
    // dezelfde ~1,4-schaal (CSS 4/11 px → canvas 5,6/15,4).
    expect(after.match(/115deg/g)).toHaveLength(2);
    expect(kleuren.satijnBaan![1]).toBeCloseTo(4 * 1.4, 5);
    expect(kleuren.satijnBaan![2]).toBeCloseTo(11 * 1.4, 5);

    // Twee ornamentlagen sinds #772: hoorns erachter, baardfiligraan ervóór.
    expect(kleuren.ornament).toBe("goat");
    expect(kleuren.ornamentVoor).toBe("goat");
    expect(FUT_TSX).toContain('id="fut-orn-goat-achter"');
    expect(FUT_TSX).toContain('id="fut-orn-goat-voor"');
    // Beide lagen tekenen één helft en spiegelen die om x=50 — dát is wat de
    // symmetrie garandeert, in de DOM én op canvas.
    const tsx = FUT_TSX.replace(/\s+/g, " ");
    for (const helft of ["fut-orn-goat-helft", "fut-orn-goat-baard-helft"]) {
      expect(FUT_TSX).toContain(`id="${helft}"`);
      expect(tsx, `${helft} wordt niet gespiegeld gebruikt`).toContain(
        `href="#${helft}" transform="translate(100,0) scale(-1,1)"`,
      );
    }

    // Platina rugband: gradient in de defs, en het materiaal dat ernaar wijst.
    expect(FUT_TSX).toContain('id="fut-orn-platina"');
    expect(FUT_TSX).toContain('rugGlans: "url(#fut-orn-platina)"');
  });

  it("GOAT: het divisie-icoon vervangt de emoji in DOM én poster (#772)", () => {
    // 🐐 rendert per platform anders, dus de GOAT draagt een eigen SVG-kop.
    // Beide tekenaars moeten dat weten, anders staat er op de poster alsnog
    // een emoji naast de DOM-kaart met het icoon.
    expect(FUT_TSX).toContain('tier.key === "legende" ? <FutGoatIcoon />');
    expect(GOAT_ICOON.length).toBeGreaterThan(4);
    // Decoratief: de divisieregel draagt de betekenis.
    expect(FUT_TSX).toContain('className="fut-kaart__tier-icoon"');
    expect(FUT_CSS).toContain(".fut-kaart__tier-icoon");
  });
  it("On Fire: rand-, vignet- en glansregister staan in de CSS én in de tabel (#710)", () => {
    // Zelfde bewaking als bij de GOAT hierboven, nu voor de editie: de
    // On-Fire-overlay leeft op twee plekken (CSS-vars op .fut-kaart--onfire en
    // velden in EDITIE_REGISTERS) en mag niet stil uit elkaar lopen.
    const blok = editieBlok("onfire");
    const { kleuren } = kaartSkin("goud", "onfire");

    // Randgloed: drie verschoven silhouetten, met de fracties uit de CSS-calc
    // op --fut-kw en dezelfde kleuren.
    const echo = /--kaart-echo:([^;]+);/.exec(blok)?.[1]?.replace(/\s+/g, " ") ?? "";
    expect(kleuren.echo).toHaveLength(3);
    for (const [dx, dy, kleur] of kleuren.echo!) {
      if (dx !== 0) expect(echo).toContain(`* ${dx})`);
      if (dy !== 0) expect(echo).toContain(`* ${dy})`);
      expect(echo).toContain(kleur);
    }

    // Binnenlijnen: elke inset-schaduw komt als [spreiding, kleur] terug, in
    // dezelfde volgorde (smal → breed).
    const binnenlijn =
      /--kaart-binnenlijn:([^;]+);/.exec(blok)?.[1]?.replace(/\s+/g, " ") ?? "";
    for (const [spreiding, kleur] of kleuren.binnenlijn!)
      expect(binnenlijn).toContain(`inset 0 0 0 ${spreiding}px ${kleur}`);

    // Vignet en hitteglans: de stops van de twee gradients uit het vlak-blok en
    // het ::before-blok, in dezelfde alfa's. De poster bevriest de baan op deze
    // stand, dus dit is precies waar hij op moet uitkomen.
    const vlakBlok =
      /\.fut-kaart--onfire \.fut-kaart__vlak\s*\{[^}]*\}/.exec(FUT_CSS)?.[0] ?? "";
    for (const [, kleur] of kleuren.vignet!)
      if (!kleur.endsWith(" 0)")) expect(vlakBlok.replace(/\s+/g, " ")).toContain(kleur);
    const glans =
      /\.fut-kaart--onfire \.fut-kaart__vlak::before\s*\{[^}]*\}/
        .exec(FUT_CSS)?.[0]
        ?.replace(/\s+/g, " ") ?? "";
    for (const [offset, kleur] of kleuren.sheenStops!)
      if (!kleur.endsWith(" 0)"))
        expect(glans).toContain(`${kleur} ${Math.round(offset * 100)}%`);
    // De piek blijft op 0,27: fellere baan = slechter contrast onder de glans,
    // en dat mocht van #710 niet zakken t.o.v. #632.
    expect(kleuren.sheen).toBe("rgba(255, 190, 112, 0.27)");

    // Groeven i.p.v. satijn, in een eigen ::after-regel (niet in het gedeelde
    // premium-blok), plus de ornament- en motiefkeuze.
    const after =
      /\.fut-kaart--onfire \.fut-kaart__vlak::after\s*\{[^}]*\}/.exec(FUT_CSS)?.[0] ??
      "";
    expect(after).toContain("repeating-radial-gradient");
    expect(kleuren.textuur).toBe("groeven");
    expect(kleuren.ornament).toBe("onfire");
    expect(kleuren.motief?.paden).toHaveLength(4);

    // En de ornamentgroepen waar de DOM-laag naar verwijst, bestaan echt.
    expect(FUT_TSX).toContain('id="fut-orn-onfire-achter"');
    expect(FUT_TSX).toContain('id="fut-orn-onfire-voor"');
  });

  it("On Fire beweegt alleen mét bewegingsvoorkeur, op transform (#710)", () => {
    // De twee animaties (hitteglans, thermische ringen) moeten binnen de
    // prefers-reduced-motion-blokken staan en alleen transform/opacity
    // aanspreken — anders kost de kaart layout-werk per frame, en het
    // klassement toont er tientallen naast elkaar.
    const media = FUT_CSS.slice(
      FUT_CSS.indexOf(".fut-kaart--onfire {"),
    ).match(/@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\n\}/);
    expect(media, "On Fire mist zijn reduced-motion-blok").not.toBeNull();
    const blok = media![0];
    expect(blok).toContain("fut-kaart-hitteglans");
    expect(blok).toContain("fut-kaart-thermiek");
    expect(blok).toContain("translate3d");
    // Geen animatie op een eigenschap die layout of paint forceert.
    expect(blok).not.toMatch(/animation:[^;]*\b(width|height|top|left|filter)\b/);
    // 4–6s uit de referentie-instructies: zwaarder dan In-Forms 2,6s.
    const duur = Number(
      /animation: fut-kaart-hitteglans ([\d.]+)s/.exec(blok)?.[1] ?? "0",
    );
    expect(duur).toBeGreaterThanOrEqual(4);
    expect(duur).toBeLessThanOrEqual(6);
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

  it("dictator en GOAT hebben elk een eigen topsilhouet (#710/#834)", () => {
    // GOAT vervangt de ene ronde kroonbobbel door een vloeiende drievoudige
    // crest; de dictator behoudt zijn hoekige troonprofiel.
    expect(schildVorm("legende")).toBe("goat");
    expect(schildVorm("dictator")).toBe("troon");
    const goatBlok = tierBlok("legende", "--schild");
    expect(goatBlok).toContain("url(#fut-schild-goat)");
    expect(FUT_TSX).toContain('id="fut-schild-goat"');
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


  it("Piet: ornamenten, watermerk en gelaagde rand staan in beide lezers (#710)", () => {
    // De Piet is de eerste editie met een eigen ornamentlaag. Alles wat de DOM
    // erbij kreeg — twee ornamentlagen, het watermerk en de rand-mechanismen —
    // moet ook in de canvas-tabel staan, anders mist de deel-poster de halve
    // kaart. Zelfde bewaking als het GOAT-blok hierboven.
    const blok = editieBlok("piet");
    const { kleuren } = kaartSkin("goud", "piet");

    // Kettingen áchter de kaart, crest/zegel ervóór.
    expect(kleuren.ornament).toBe("piet");
    expect(kleuren.ornamentVoor).toBe("piet");
    // Het watermerk hoort bij het vlak-register en komt dus mét de editie mee
    // (anders dan het GOAT-medaillon, dat er juist onder verdwijnt) — op élke
    // divisie, want de Piet gaat rond in de hele club.
    expect(kleuren.motief?.paden.length).toBeGreaterThan(0);
    expect(kaartSkin("legende", "piet").kleuren.motief).toBe(kleuren.motief);
    expect(kleuren.motief?.breedte).toBe(
      Number(token(blok, "--motief-b")) / 100,
    );
    expect(kleuren.motief?.positie).toBe(
      Number(token(blok, "--motief-pos")!.replace("%", "")) / 100,
    );

    // Echo en binnenlijnen: dezelfde fracties, spreidingen en kleuren als de
    // CSS-vars.
    const echo = /--kaart-echo:([^;]+);/.exec(blok)?.[1] ?? "";
    const [dx, dy, kleur] = kleuren.echo![0];
    expect(echo).toContain(`* ${dx})`);
    expect(echo).toContain(`* ${dy})`);
    expect(echo.replace(/\s+/g, " ")).toContain(kleur);
    const binnenlijn = /--kaart-binnenlijn:([^;]+);/.exec(blok)?.[1] ?? "";
    for (const [spreiding, lijnKleur] of kleuren.binnenlijn!)
      expect(binnenlijn.replace(/\s+/g, " ")).toContain(
        `inset 0 0 0 ${spreiding}px ${lijnKleur}`,
      );

    // Papierraster (fijn linnen + grover raster) en vignette in het vlak: de
    // canvas-spiegel zit in drawSpeelkaart, dus als de CSS-lagen verdwijnen
    // moet dat hier opvallen.
    const vlak = /\.fut-kaart--piet \.fut-kaart__vlak\s*\{[^}]*\}/.exec(FUT_CSS)?.[0];
    expect(vlak).toContain("radial-gradient");
    expect(vlak?.match(/transparent 1px 3px/g)).toHaveLength(2);
    expect(vlak?.match(/transparent 1px 6px/g)).toHaveLength(2);

    // En het klaverteken op de naamplaat (de poster tekent hetzelfde teken in
    // profielPoster.drawKaart).
    const naam = /\.fut-kaart--piet \.fut-kaart__naam::after\s*\{[^}]*\}/.exec(
      FUT_CSS,
    )?.[0];
    expect(naam, "Piet mist het klaverteken naast de naam").toBeDefined();
    expect(naam).toContain("%E2%99%A3");
  });

  it("de ornamentcascade: editie boven tier boven divisie (#710)", () => {
    // Eén test voor de regel die alle acht de kaarten van #710 delen. Een
    // editie mét eigen ornament wint van de tier — in de CSS staat het
    // editie-blok ná het toptier-blok met gelijke specificiteit, en inhoudelijk
    // zegt een editie iets tijdelijkers en zeldzamers over deze speler dan zijn
    // divisie. Een editie zónder eigen ornament laat de tier juist staan.
    for (const [editie, verwacht] of [
      ["icon", "bigdaddy"],
      ["kampioen", "kampioen"],
      ["pias", "pias"],
      ["piet", "piet"],
      ["inform", "inform"],
      ["onfire", "onfire"],
    ] as const) {
      expect(kaartSkin("goud", editie).kleuren.ornament, editie).toBe(verwacht);
      // Ook bovenop een toptier: de GOAT-hoorns wijken voor het editie-ornament.
      expect(kaartSkin("legende", editie).kleuren.ornament, editie).toBe(
        verwacht,
      );
    }
    // Alle zes de edities zijn nu hertekend, dus geen enkele laat het
    // tier-ornament nog staan. Komt er een zevende bij zonder eigen ornament,
    // dan hoort die hier als tegenvoorbeeld terug.

    // Het mótief volgt een ándere regel: dat hoort bij het vlak-register, dus
    // een editie-skin neemt het tier-motief altijd over — met haar eigen
    // watermerk als ze er een heeft, en anders met niets. Het GOAT-medaillon
    // zou op het In-Form-navy vloeken.
    expect(kaartSkin("legende", "onfire").kleuren.motief).toBe(
      kaartSkin("goud", "onfire").kleuren.motief,
    );
    expect(kaartSkin("legende", "icon").kleuren.motief).toBe(
      kaartSkin("goud", "icon").kleuren.motief,
    );
    // En zonder editie hangt alles aan de tier.
    expect(kaartSkin("legende", null).kleuren.ornament).toBe("goat");
    expect(kaartSkin("legende", null).kleuren.motief?.paden.length).toBeGreaterThan(0);
  });

  it("de twee ornamenttabellen staan gelijk in DOM en canvas (#710)", () => {
    // De cascade leeft op twee plekken: EDITIE_ORNAMENT/TIER_ORNAMENT in
    // FutKaart.tsx (voor de DOM) en dezelfde twee in futKaartCanvas.ts (voor
    // de poster). Loopt er één achter, dan tekent de kaart een ander ornament
    // dan de deel-poster — en dat zie je pas op de export. Regressie uit het
    // samenvoegen van #710: On Fire ontbrak in de DOM-tabel, waardoor een
    // GOAT-in-vuur zijn bokhoorns hield i.p.v. de vlamvinnen.
    const tabel = (bron: string, naam: string) => {
      const blok = new RegExp(`const ${naam}[^{]*\\{([^}]*)\\}`).exec(bron);
      expect(blok, `${naam} niet gevonden`).not.toBeNull();
      return [...blok![1].matchAll(/(\w+): "(\w+)"/g)]
        .map((m) => `${m[1]}=${m[2]}`)
        .sort();
    };
    for (const naam of ["EDITIE_ORNAMENT", "TIER_ORNAMENT"]) {
      expect(tabel(FUT_TSX, naam), naam).toEqual(tabel(CANVAS_TS, naam));
    }
  });

  it("elke ornamentlaag verwijst naar een <g> die echt bestaat (#710)", () => {
    // Regressie uit het samenvoegen van de acht kaarten: de kaart bouwde zijn
    // <use href> als `#fut-orn-<naam>-achter`, maar drie defs-groepen heetten
    // nog `#fut-orn-<naam>` zonder achtervoegsel. Een <use> naar een
    // niet-bestaand id rendert stil niets — Big Daddy verloor zo zijn linten en
    // ballonnen, de Kampioen zijn krans, de pias zijn kap. Deze test loopt de
    // ids na die de component samenstelt.
    const ornamenten = [
      "goat",
      "dictator",
      "bigdaddy",
      "kampioen",
      "pias",
      "piet",
      "inform",
      "onfire",
    ] as const;
    for (const o of ornamenten) {
      expect(FUT_TSX, `${o}: achter-laag mist zijn <g>`).toContain(
        `id="fut-orn-${o}-achter"`,
      );
      // Sinds #772 heeft ook de GOAT een vóór-laag: zijn baardfiligraan ligt
      // over de kaartpunt in plaats van erachter.
      expect(FUT_TSX, `${o}: vóór-laag mist zijn <g>`).toContain(
        `id="fut-orn-${o}-voor"`,
      );
    }
    // En de component bouwt de href precies zo op.
    expect(FUT_TSX).toContain("`#fut-orn-${ornament}-achter`");
    expect(FUT_TSX).toContain("`#fut-orn-${ornamentVoor}-voor`");
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
describe("cascade: een editie wint van de tier- én de divisieklasse (#710)", () => {
  // Een kaart draagt altijd twee modifiers tegelijk: zijn tier (of divisie) én
  // zijn editie. Beide zetten dezelfde tokens (--kaart-hi/ink/...), dus alleen
  // de cascade beslist wie wint. Dat ging mis: de negen divisieregisters worden
  // ná FutKaart.css geïmporteerd, en op gelijke specificiteit wint de laatste —
  // waardoor Big Daddy op meester lila werd i.p.v. roze, en In-Form op Forever
  // second donkerpaarse tekst op een donker vlak kreeg. Canvas kende dat
  // probleem niet (kaartSkin geeft het editieregister eerst terug), dus DOM en
  // poster liepen uiteen. De fix is specificiteit: elke editieselector begint
  // met `.fut-kaart.fut-kaart--<editie>` (0,2,0) en wint daarmee van zowel
  // `.fut-kaart--legende` als `.fut-kaart--meester` (0,1,0), ongeacht
  // importvolgorde. Deze test houdt dat vast — een nieuwe editieregel zonder
  // dubbele basisklasse valt hier om, niet pas in een screenshot.
  const zonderCommentaar = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, " ");

  // Alle selectorblokken: de tekst vóór elke `{` die zelf geen declaratie is.
  const selectors = (css: string) =>
    [...zonderCommentaar(css).matchAll(/(^|[{};])([^{};]*?)\{/g)]
      .map((m) => m[2].replace(/\s+/g, " ").trim())
      .filter((s) => s.startsWith("."));

  it.each(EDITIES)("elke %s-regel draagt de dubbele basisklasse", (editie) => {
    const raak = selectors(FUT_CSS).filter((s) =>
      new RegExp(`\\.fut-kaart--${editie}\\b`).test(s),
    );
    expect(raak.length).toBeGreaterThan(0);
    const zwak = raak.filter((s) =>
      new RegExp(`(^|[\\s,])\\.fut-kaart--${editie}\\b`).test(s),
    );
    expect(zwak).toEqual([]);
  });

  it("geen divisieregister trekt de specificiteit mee omhoog", () => {
    // Zou een divisiebestand óók `.fut-kaart.fut-kaart--<divisie>` gaan
    // schrijven, dan staat hij weer gelijk met de editie en beslist de
    // importvolgorde opnieuw. De divisies horen op 0,1,0 te blijven.
    const fout = DIVISIE_CSS.filter(([, css]) =>
      /\.fut-kaart\.fut-kaart--/.test(zonderCommentaar(css)),
    ).map(([naam]) => naam);
    expect(fout).toEqual([]);
  });
});

/* ── Rastermasters op de poster (#895) ────────────────────────────────────
   De registratie zelf wordt in kaartMasters.test.ts tegen de CSS gehouden;
   hier gaat het om wat de canvas ermee dóét: de drie lagen op de goede
   coördinaten, en de vectorlaag die eronder wijkt zoals in FutKaart.tsx. */

// jsdom kent geen Path2D; de vectorlagen bouwen er wel paden mee. Een lege
// huls volstaat: de test kijkt naar wélke aanroepen gebeuren, niet naar de
// vorm die eruit komt.
if (!("Path2D" in globalThis)) {
  (globalThis as { Path2D?: unknown }).Path2D = class {
    constructor(readonly d?: string) {}
  };
}

/** Minimale opnemende 2D-context: alles wat de tekening aanroept wordt
 *  vastgelegd, verlopen krijgen een dummy terug. Genoeg om laagvolgorde en
 *  geometrie te toetsen zonder een echte canvas-implementatie. */
function maakCtx() {
  const calls: { naam: string; args: unknown[] }[] = [];
  const staat: Record<string, unknown> = {};
  const ctx = new Proxy(staat, {
    get(doel, prop: string) {
      if (prop in doel) return doel[prop];
      return (...args: unknown[]) => {
        calls.push({ naam: prop, args });
        if (prop.startsWith("create"))
          return { addColorStop: () => {} } as unknown as CanvasGradient;
        if (prop === "measureText") return { width: 10 };
        return undefined;
      };
    },
    set(doel, prop: string, waarde) {
      doel[prop] = waarde;
      calls.push({ naam: `set:${prop}`, args: [waarde] });
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

/** Een geladen master met een artwork van 1000 × 1390 bronpixels, met de
 *  maskers die zijn registratie belooft. */
function nepMaster(naam: MasterNaam): GeladenMaster {
  const beeld = () =>
    ({ naturalWidth: 1000, naturalHeight: 1390 }) as HTMLImageElement;
  const registratie = KAART_MASTERS[naam];
  return {
    naam,
    registratie,
    master: beeld(),
    voorMaster: registratie.voorBron ? beeld() : null,
    binnenMasker: registratie.binnenMasker ? beeld() : null,
    voorMasker: registratie.voorMasker ? beeld() : null,
  };
}

describe("drawKaartSchild met een rastermaster (#895)", () => {
  const X = 100;
  const Y = 200;
  const W = 560;
  const H = W * 1.39;

  it("tekent de achter- én de binnenlaag op dezelfde registratie", () => {
    const { ctx, calls } = maakCtx();
    const master = nepMaster("goat");
    drawKaartSchild(ctx, X, Y, W, H, "goat", kaartSkin("legende", null).kleuren, master);

    const beelden = calls.filter((c) => c.naam === "drawImage");
    expect(beelden).toHaveLength(2);
    // left −20% van de breedte, top −53% van de hóógte, breedte 140% — en de
    // hoogte volgt de bronverhouding, net als `height: auto` in de CSS.
    for (const beeld of beelden) {
      expect(beeld.args.slice(1)).toEqual([0, 0, 1.4 * W, 1.4 * W * 1.39]);
    }
    const ankers = calls
      .filter((c) => c.naam === "translate")
      .map((c) => c.args);
    expect(ankers).toContainEqual([X - 0.2 * W, Y - 0.53 * H]);
  });

  it("laat de binnenlaag de dekking uit de CSS overnemen", () => {
    const { ctx, calls } = maakCtx();
    drawKaartSchild(
      ctx,
      X,
      Y,
      W,
      H,
      "notch",
      kaartSkin("goud", null).kleuren,
      nepMaster("wannabe"),
    );
    const alphas = calls
      .filter((c) => c.naam === "set:globalAlpha")
      .map((c) => c.args[0]);
    expect(alphas).toContain(0.9);
  });

  it("laat de vectorornamenten staan zolang er géén master geladen is", () => {
    // De terugval is het hele punt: een mislukte download levert de oude
    // poster op, geen kale kaart.
    const { ctx, calls } = maakCtx();
    drawKaartSchild(ctx, X, Y, W, H, "goat", kaartSkin("legende", null).kleuren);
    expect(calls.filter((c) => c.naam === "drawImage")).toHaveLength(0);
    expect(calls.some((c) => c.naam === "fill")).toBe(true);
  });

  it("onderdrukt het vector-ornament dat het master zelf draagt", () => {
    // Het GOAT-monument tekent zijn hoorns met Path2D-vullingen; met master
    // erbij moeten die verdwijnen, precies zoals `ornamentLive` in
    // FutKaart.tsx doet.
    const kleuren = kaartSkin("legende", null).kleuren;
    const zonder = maakCtx();
    drawKaartSchild(zonder.ctx, X, Y, W, H, "goat", kleuren);
    const met = maakCtx();
    drawKaartSchild(met.ctx, X, Y, W, H, "goat", kleuren, nepMaster("goat"));
    const padVullingen = (calls: { naam: string; args: unknown[] }[]) =>
      calls.filter((c) => c.naam === "fill" && c.args.length > 0).length;
    expect(padVullingen(zonder.calls)).toBeGreaterThan(0);
    expect(padVullingen(met.calls)).toBe(0);
  });

  it("houdt het watermerk van de Piet enkelvoudig", () => {
    // De piet-master draagt zijn stadssilhouet zelf; de vectorpion eronder zou
    // een tweede watermerk zijn.
    const kleuren = kaartSkin(undefined, "piet").kleuren;
    expect(kleuren.motief).toBeDefined();
    const { ctx, calls } = maakCtx();
    drawKaartSchild(ctx, X, Y, W, H, "notch", kleuren, nepMaster("piet"));
    // Alleen de twee masterlagen tekenen nog beeld; het motief tekent paden.
    expect(calls.filter((c) => c.naam === "drawImage")).toHaveLength(2);
    expect(calls.filter((c) => c.naam === "fill" && c.args.length > 0)).toHaveLength(0);
  });
});

describe("drawKaartOrnamentVoor met een rastermaster (#895)", () => {
  it("zet de voorlaag ónder een ornament dat blijft staan (On Fire)", () => {
    const { ctx, calls } = maakCtx();
    const kleuren = kaartSkin(undefined, "onfire").kleuren;
    drawKaartOrnamentVoor(ctx, 0, 0, 560, kleuren, nepMaster("onfire"));
    const volgorde = calls
      .map((c, i) => ({ ...c, i }))
      .filter((c) => c.naam === "drawImage" || (c.naam === "fill" && c.args.length > 0));
    // De crest van On Fire ligt op z-index 4, de master op 3: het beeld gaat
    // vóór de vectorvullingen.
    expect(volgorde[0]?.naam).toBe("drawImage");
    expect(volgorde.some((c) => c.naam === "fill")).toBe(true);
  });

  it("zet de storm juist bóven de vinnen die blijven staan (In-Form)", () => {
    const { ctx, calls } = maakCtx();
    const kleuren = kaartSkin(undefined, "inform").kleuren;
    drawKaartOrnamentVoor(ctx, 0, 0, 560, kleuren, nepMaster("inform"));
    const volgorde = calls
      .filter((c) => c.naam === "drawImage" || (c.naam === "fill" && c.args.length > 0))
      .map((c) => c.naam);
    expect(volgorde.at(-1)).toBe("drawImage");
    expect(volgorde[0]).toBe("fill");
  });

  it("vervangt de vector-divisiekaart van de drie divisiemasters", () => {
    const kleuren = kaartSkin("goud", null).kleuren;
    expect(kleuren.divisie).toBe("goud");
    const zonder = maakCtx();
    drawKaartOrnamentVoor(zonder.ctx, 0, 0, 560, kleuren);
    const met = maakCtx();
    drawKaartOrnamentVoor(met.ctx, 0, 0, 560, kleuren, nepMaster("wannabe"));
    const vullingen = (calls: { naam: string }[]) =>
      calls.filter((c) => c.naam === "fill").length;
    expect(vullingen(zonder.calls)).toBeGreaterThan(0);
    expect(vullingen(met.calls)).toBe(0);
  });
});
