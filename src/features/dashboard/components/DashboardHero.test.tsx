import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MANIFEST from "./bigdaddy/onderdelen.json";
import { DashboardHero, type HeroStatus } from "./DashboardHero";
import type { HeroOverlay, HeroPermanent } from "../heroThema";

// De kaart zelf (#771): één component voor alle varianten, dus deze suite bewaakt
// wat er per variant identiek moet blijven — de zones, de drie acties, de
// dynamische data — en wat de thema-as en de overlay-as apart mogen veranderen.
// Wélke status wint staat in heroThema.test.ts; hier gaat het om de weergave.

// De stylesheet als tekst: Vitest kortsluit CSS-imports op een lege string, dus
// de laag-eigenschappen die jsdom niet doorrekent (pointer-events, z-index,
// prefers-reduced-motion) moeten via node:fs gelezen worden. Pad vanaf de
// projectroot, want import.meta.url is in de jsdom-omgeving geen file:-URL.
const HERO_CSS = readFileSync(
  "src/features/dashboard/components/DashboardHero.css",
  "utf8",
);

/** Het `no-preference`-blok waarin deze animatie staat. Er zijn er meerdere in
 *  het bestand (de glansbaan, de pulse-ring), dus zoeken op naam i.p.v. op het
 *  eerste blok. */
function bewegingsblok(animatie: string): string {
  for (const m of HERO_CSS.matchAll(
    /@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\n\}/g,
  ))
    if (m[0].includes(animatie)) return m[0];
  throw new Error(`geen no-preference-blok gevonden voor ${animatie}`);
}

const LEGE_STATUS: HeroStatus = {
  dictator: false,
  bigDaddy: false,
  kampioen: false,
  inForm: false,
  onFire: false,
  piet: false,
  pias: false,
  piasWaar: "in Vrijdagavond Padel",
  schild: false,
  thema: null,
  overlay: null,
  labels: {
    kampioen: { emoji: "🏆", label: "Kampioen Q2 2026" },
    inform: { emoji: "⚡", label: "In-Form · +48" },
    onfire: { emoji: "🔥", label: "On Fire · 6 op rij" },
  },
};

function renderKaart(
  status: Partial<HeroStatus> = {},
  naam = "Remco",
  /** Rating 994 = Blaaskaak (zilver), de divisie uit de referentieontwerpen. */
  rating: number | null = 994,
) {
  const { container } = render(
    <MemoryRouter>
      <DashboardHero
        myId="p1"
        profile={undefined}
        naam={naam}
        rating={rating}
        ratingGames={12}
        rank={6}
        heeftStand
        loading={false}
        status={{ ...LEGE_STATUS, ...status }}
        earnedBadges={[]}
        form={["W", "W", "W", "L", "W"]}
        briefing="Nog 6 Elo tot de volgende divisie."
        generateCta={{ to: "/groepen", label: "Wedstrijden genereren" }}
      />
    </MemoryRouter>,
  );
  return container.querySelector(".hero") as HTMLElement;
}

/** De zeven varianten uit #771: vijf permanente thema's (de divisiekaart is de
 *  variant zónder permanent thema) en de twee tijdelijke overlays erover. */
const VARIANTEN: ReadonlyArray<
  readonly [naam: string, Partial<HeroStatus>, HeroPermanent, HeroOverlay]
> = [
  ["divisie", {}, null, null],
  ["bigDaddy", { bigDaddy: true, thema: "bigdaddy" }, "bigdaddy", null],
  ["dictator", { dictator: true, thema: "dictator" }, "dictator", null],
  ["kampioen", { kampioen: true, thema: "kampioen" }, "kampioen", null],
  ["pias", { pias: true, thema: "pias" }, "pias", null],
  ["shameToken", { piet: true, thema: "piet" }, "piet", null],
  ["inForm-overlay", { inForm: true, overlay: "inform" }, null, "inform"],
  ["onFire-overlay", { onFire: true, overlay: "onfire" }, null, "onfire"],
];

describe("<DashboardHero /> — gedeelde basis", () => {
  it.each(VARIANTEN)(
    "houdt in de %s-variant dezelfde zones en dezelfde drie acties",
    (_naam, status) => {
      renderKaart(status);
      // Eyebrow, begroeting, rankingzin, coachbericht, vormreeks.
      expect(screen.getByText("Racket in de aanslag?")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: /hoi, remco/i }),
      ).toBeInTheDocument();
      expect(screen.getByText(/plek #6 .* rating van 994/i)).toBeInTheDocument();
      expect(screen.getByRole("note")).toHaveTextContent(/nog 6 elo/i);
      expect(screen.getByText("Vorm")).toBeInTheDocument();
      // De drie acties: zelfde labels, zelfde volgorde, zelfde doelen (AC8).
      const acties = screen
        .getAllByRole("link")
        .filter((l) => l.className.includes("btn"));
      expect(acties.map((l) => l.textContent)).toEqual([
        "+ Match loggen",
        "Wedstrijden genereren",
        "Vrije banen",
      ]);
      expect(acties.map((l) => l.getAttribute("href"))).toEqual([
        "/matches",
        "/groepen",
        "/banen",
      ]);
      expect(acties[0]).toHaveClass("btn--primary");
    },
  );

  it.each(VARIANTEN)(
    "zet in de %s-variant de juiste klassen op de kaart",
    (_naam, status, permanent, overlay) => {
      const hero = renderKaart(status);
      for (const p of ["bigdaddy", "dictator", "kampioen", "pias", "piet"])
        expect(hero.classList.contains(`hero--${p}`)).toBe(p === permanent);
      for (const o of ["inform", "onfire"])
        expect(hero.classList.contains(`hero--overlay-${o}`)).toBe(o === overlay);
    },
  );

  it("houdt alle spelergegevens dynamisch (AC2)", () => {
    // Geen enkele waarde uit de referentieontwerpen zit vastgebakken: met andere
    // props staat er andere tekst.
    render(
      <MemoryRouter>
        <DashboardHero
          myId="p9"
          profile={undefined}
          naam="Wendy"
          rating={1207}
          ratingGames={30}
          rank={2}
          heeftStand
          loading={false}
          status={LEGE_STATUS}
          earnedBadges={[]}
          form={["L", "L"]}
          briefing={null}
          generateCta={{ to: "/banen", label: "Baan zoeken" }}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /hoi, wendy/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/plek #2 .* rating van 1207/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Baan zoeken" })).toHaveAttribute(
      "href",
      "/banen",
    );
    // Zonder briefing geen leeg coachvlak.
    expect(screen.queryByRole("note")).toBeNull();
  });
});

describe("<DashboardHero /> — statusbadge", () => {
  it("maakt de winnende permanente status de badge en houdt de rest chip", () => {
    renderKaart({
      bigDaddy: true,
      piet: true,
      thema: "bigdaddy",
    });
    expect(screen.getByRole("button", { name: /big daddy/i })).toHaveClass(
      "hero-crest--badge",
    );
    expect(
      screen.getByRole("button", { name: /zwarte piet/i }),
    ).not.toHaveClass("hero-crest--badge");
  });

  it("laat een tijdelijke overlay de badge zijn boven het permanente thema", () => {
    // Het materiaal toont de permanente titel al; de badge vertelt het nieuws van
    // deze week. Beide titels blijven leesbaar (kleur is nooit de enige indicator).
    renderKaart({ pias: true, inForm: true, thema: "pias", overlay: "inform" });
    expect(screen.getByRole("button", { name: /in-form · \+48/i })).toHaveClass(
      "hero-crest--badge",
    );
    expect(
      screen.getByRole("button", { name: /pias van de week/i }),
    ).not.toHaveClass("hero-crest--badge");
  });

  it("geeft met een roast-schild geen badge, maar wel de neutrale chip (#183)", () => {
    // heroPermanent levert dan null; de kaart blijft zijn divisie en de status
    // staat er zonder spot naast.
    renderKaart({ pias: true, schild: true, thema: null });
    const chip = screen.getByRole("button", { name: /opvallende week/i });
    expect(chip).not.toHaveClass("hero-crest--badge");
    expect(document.querySelector(".hero-crest--badge")).toBeNull();
  });

  it("noemt elke status in de toegankelijke tekst, niet alleen in kleur", () => {
    renderKaart({ onFire: true, piet: true, overlay: "onfire", thema: "piet" });
    for (const naam of [/on fire · 6 op rij/i, /zwarte piet/i])
      expect(screen.getByRole("button", { name: naam })).toBeInTheDocument();
  });
});

describe("<DashboardHero /> — decoratielagen", () => {
  it("tekent geen lagen zonder rating, thema én overlay", () => {
    // Wie nog nooit gespeeld heeft, heeft ook geen divisie: dan blijft de kaart
    // neutraal en staat er geen lege decoratielaag in de DOM.
    const hero = renderKaart({}, "Remco", null);
    expect(hero.querySelector(".hero__lagen")).toBeNull();
    expect(hero.className).toBe("hero");
  });

  it("geeft een kaart zonder thema het materiaal van zijn divisie (#771)", () => {
    const hero = renderKaart();
    expect(hero).toHaveClass("hero--divisie", "hero--div-zilver");
    expect(hero.querySelector(".hero__materiaal")).toBeInTheDocument();
    expect(hero.querySelector(".hero__watermerk")).toBeInTheDocument();
    // De kleuren komen als custom properties uit het register (heroDivisie.ts).
    expect(hero.style.getPropertyValue("--hero-div-lijn")).not.toBe("");
  });

  it("laat een permanent thema het divisiemateriaal overnemen", () => {
    // Anders liggen er twee materialen over elkaar; het thema wint (stap 4 boven
    // stap 3 in de laagvolgorde).
    const hero = renderKaart({ pias: true, thema: "pias" });
    expect(hero).not.toHaveClass("hero--divisie");
    expect(hero.querySelector(".hero__materiaal")).toBeNull();
  });

  it("geeft Big Daddy de artwork-onderdelen van zijn FUT-master (#834)", () => {
    const hero = renderKaart({ bigDaddy: true, thema: "bigdaddy" });
    // Tot #834 waren dit vectorornamenten uit het register van de 👑-kaart. De
    // referentie toont geschilderd satijn, dus het zijn nu sneden uit hetzelfde
    // onderdelenblad als de FUT-master — geen enkel onderdeel is hier getekend.
    for (const plek of [
      "medaillon-boven",
      "medaillon-onder",
      "hoek-rechtsboven",
      "hoek-rechtsonder",
      "teddy",
      "bodem-links",
      "bodem-rechts",
      "flank-voor",
    ])
      expect(
        hero.querySelector(`.hero-bd--${plek}`),
        plek,
      ).toBeInTheDocument();
    // Elk onderdeel staat als eigen <img> in de DOM en niet als
    // achtergrondafbeelding: alleen zo volgt de hoogte uit de beeldverhouding
    // van het bestand en kan een opnieuw gesneden asset de layout niet
    // uitrekken.
    for (const deel of hero.querySelectorAll(".hero-bd")) {
      expect(deel.tagName).toBe("IMG");
      expect(deel).toHaveAttribute("alt", "");
      // Async decoderen laat het onderdeel leeg op de vaste screenshotroute, en
      // dan lijkt een ontbrekend onderdeel op een z-index-fout.
      expect(deel).toHaveAttribute("decoding", "sync");
    }
    // Elk gebruikt bestand komt uit het manifest dat het snijscript schrijft.
    const bestanden = new Set(
      MANIFEST.onderdelen.map((o: { bestand: string }) => o.bestand),
    );
    for (const deel of hero.querySelectorAll<HTMLImageElement>(".hero-bd"))
      expect(bestanden, deel.className).toContain(
        deel.getAttribute("src")?.split("/").pop(),
      );
  });

  it("rendert het wevende lint twee keer uit één bron (#834)", () => {
    const hero = renderKaart({ bigDaddy: true, thema: "bigdaddy" });
    const achter = hero.querySelector<HTMLImageElement>(".hero-bd--flank-achter");
    const voor = hero.querySelector<HTMLImageElement>(".hero-bd--flank-voor");
    // Eén bron, één anker: alleen het masker verschilt. Twee verschillende
    // bestanden zouden bij de eerstvolgende hersnede uit elkaar lopen, en dan
    // verspringt het lint precies op de lijst.
    expect(achter?.getAttribute("src")).toBe(voor?.getAttribute("src"));
    // De achterste hangt ín het kaartvlak (dus achter de lijst), de voorste in
    // de ongeklipte laag erbovenop.
    expect(hero.querySelector(".hero__vlak > .hero-bd--flank-achter")).toBeInTheDocument();
    expect(
      hero.querySelector(".hero__lagen--voor > .hero-bd--flank-voor"),
    ).toBeInTheDocument();
    // En het vlak ligt de volle lijstdikte naar binnen, dus de achterste
    // instantie compenseert die inzet — anders verspringt dezelfde bron een
    // paar pixels (zelfde registratiedetail als --storm-master-inset).
    expect(HERO_CSS).toMatch(
      /\.hero-bd--flank-achter\s*\{[^}]*var\(--lijst-d\)/,
    );
  });

  it("bouwt de Big Daddy-lijst als vier geneste vlakken (#834)", () => {
    const hero = renderKaart({ bigDaddy: true, thema: "bigdaddy" });
    // Rail → band → keyline → vlak, elk ín zijn voorganger: precies zoals de
    // FUT-kaart zijn rand maakt. Vier siblings zouden dezelfde kleuren geven en
    // tóch geen profiel, want dan ligt er niets ín iets anders.
    const vlak = hero.querySelector(
      ".hero__lagen > .hero__lijst > .hero__lijst-band > .hero__lijst-key > .hero__vlak",
    );
    expect(vlak).toBeInTheDocument();
    // Wat achter de lijst hoort te verdwijnen hangt ín dat vlak: daar klipt het
    // op de binnenrand en kan het per constructie niet over de lijst
    // schilderen.
    expect(vlak?.querySelector(".hero-bd--flank-achter")).toBeInTheDocument();
    // De diktes rekenen in containerbreedte. Met procenten zou `inset`
    // horizontaal tegen de breedte en verticaal tegen de hoogte rekenen, en
    // krijgt een brede kaart een dunnere boven- dan zijrand.
    expect(HERO_CSS).toMatch(
      /\.hero--bigdaddy\s*\{[^}]*container-type:\s*inline-size/,
    );
    for (const dikte of ["--lijst-rail-d", "--lijst-band-d", "--lijst-key-d"])
      expect(HERO_CSS, dikte).toMatch(new RegExp(`${dikte}:[^;]*cqw`));
    // En de inhoud schuift met de volle lijstdikte naar binnen; anders belandt
    // tekst op de magenta band.
    expect(HERO_CSS).toMatch(
      /\.hero--bigdaddy\s*\{[^}]*padding:[^;]*var\(--lijst-d\)/,
    );
  });

  it("geeft alleen een thema met eigen profiel die lijst (#834)", () => {
    // Opt-in, zoals het divisielayout-register: wie hem niet vraagt, krijgt de
    // gewone kaartrand en geen vier lege spans in zijn DOM.
    expect(
      renderKaart({ pias: true, thema: "pias" }).querySelector(".hero__lijst"),
    ).toBeNull();
    expect(renderKaart().querySelector(".hero__lijst")).toBeNull();
  });

  it("bouwt de In-Form-kaart als zwart-goud profiel met storm (#834)", () => {
    const hero = renderKaart({ inForm: true, overlay: "inform" });
    // Dezelfde vier geneste vlakken als bij Big Daddy; alleen het materiaal en
    // de chamfer verschillen, en die staan in de CSS.
    const vlak = hero.querySelector(
      ".hero__lagen > .hero__lijst > .hero__lijst-band > .hero__lijst-key > .hero__vlak",
    );
    expect(vlak).toBeInTheDocument();
    // Het artwork hangt ín dat vlak, dus het klipt op de binnenrand van de
    // keyline en kan per constructie niet over de gouden lijst schilderen —
    // precies wat de referentie doet, die het goud over de volle hoogte
    // ononderbroken houdt.
    expect(vlak?.querySelector(".hero-if--storm")).toBeInTheDocument();
    expect(vlak?.querySelector(".hero-if--ember")).toBeInTheDocument();
    for (const deel of vlak?.querySelectorAll<HTMLImageElement>(".hero-if") ?? [])
      expect(deel).toHaveAttribute("decoding", "sync");
    // Geen tint: die is er om een permanent thema doorheen te laten schemeren,
    // en een tweede donkere laag over dit vlak haalt de storm er weer uit.
    expect(hero.querySelector(".hero__tint--inform")).toBeNull();
    // De diktes rekenen in containerbreedte, om dezelfde reden als bij Big
    // Daddy: procenten in `inset` geven een brede kaart een dunnere boven- dan
    // zijrand.
    expect(HERO_CSS).toMatch(
      /\.hero--lijst-inform\s*\{[^}]*container-type:\s*inline-size/,
    );
    for (const dikte of ["--lijst-rail-d", "--lijst-band-d", "--lijst-key-d"])
      expect(HERO_CSS, dikte).toMatch(new RegExp(`${dikte}:[^;]*cqw`));
    // De achthoek zit op de keyline en het vlak, niet op de buitenrand: de
    // goudrail volgt een gewone afgeronde hoek.
    expect(HERO_CSS).toMatch(
      /\.hero--lijst-inform \.hero__lijst-key,\s*\.hero--lijst-inform \.hero__vlak\s*\{[^}]*clip-path:\s*polygon/,
    );
  });

  it("houdt de In-Form-overlay dun boven een permanent thema (#834)", () => {
    // De regel uit heroLijstProfiel, hier op zijn zichtbare kant: ligt er een
    // permanent thema onder, dan krijgt In-Form geen eigen lijst en geen
    // stormartwork. Een dekkende storm over het kraftkarton van de pias zou dat
    // thema onzichtbaar maken, en dat is precies wat #771 (AC4) verbiedt.
    const pias = renderKaart({ pias: true, thema: "pias", inForm: true, overlay: "inform" });
    expect(pias.querySelector(".hero__lijst")).toBeNull();
    expect(pias.querySelector(".hero-if--storm")).toBeNull();
    expect(pias.querySelector(".hero__tint--inform")).toBeInTheDocument();
    // Bij Big Daddy blijft zijn eigen roze profiel staan — mét de tint erin.
    const bd = renderKaart({ bigDaddy: true, thema: "bigdaddy", inForm: true, overlay: "inform" });
    expect(bd.querySelector(".hero__vlak > .hero__tint--inform")).toBeInTheDocument();
    expect(bd.querySelector(".hero-if--storm")).toBeNull();
    // En de crest verschilt: op de eigen kaart de schildplaat, daarboven de
    // kale glyph die de kaart eronder heel laat.
    expect(
      renderKaart({ inForm: true, overlay: "inform" }).querySelector(
        ".hero__crest--schild",
      ),
    ).toBeInTheDocument();
    expect(pias.querySelector(".hero__crest--bliksem")).toBeInTheDocument();
  });

  it("geeft de Dictator zijn commandoster, hoeken en lakzegel (#771)", () => {
    const hero = renderKaart({ dictator: true, thema: "dictator" });
    for (const klasse of [
      ".hero__crest--troon",
      ".hero__watermerk--lauwer",
      ".hero__ruit--boven",
      ".hero__ruit--onder",
      ".hero__hoek--lb",
      ".hero__hoek--ro",
    ])
      expect(hero.querySelector(klasse), klasse).toBeInTheDocument();
    // Het zegel hoort naast de badge en niet in de decoratielaag: de titelrij
    // wrapt met de inhoud mee, dus alleen daar staat het altijd goed.
    const slot = hero.querySelector(".hero__badge-slot");
    expect(slot?.querySelector(".hero-crest--badge")).toBeInTheDocument();
    expect(slot?.querySelector(".hero__zegel")).toBeInTheDocument();
  });

  it("zet ornamenten die over de rand steken in een eigen, ongeklipte laag", () => {
    const hero = renderKaart({ bigDaddy: true, thema: "bigdaddy" });
    const voor = hero.querySelector(".hero__lagen--voor");
    expect(voor).toHaveAttribute("aria-hidden", "true");
    // Het medaillon ligt half boven de kaart en mag dus niet geklipt worden; het
    // materiaal eronder juist wél.
    expect(voor?.querySelector(".hero-bd--medaillon-boven")).toBeInTheDocument();
    expect(HERO_CSS).toMatch(
      /\.hero__lagen--voor\s*\{[^}]*overflow:\s*visible/,
    );
    // Beide lagen laten de aanwijzer door naar de knoppen eronder (AC10).
    expect(HERO_CSS).toMatch(/\.hero__lagen\s*\{[^}]*pointer-events:\s*none/);
  });

  it("geeft de pias zijn narrenkap, maskers en harlekijndecor (#771)", () => {
    const hero = renderKaart({ pias: true, thema: "pias" });
    for (const klasse of [
      ".hero__crest--kap",
      ".hero__medaillon",
      ".hero__watermerk--maskers",
      ".hero__decor",
    ])
      expect(hero.querySelector(klasse), klasse).toBeInTheDocument();
  });

  it("houdt het schande-token abstract: pion, ringen, zegel en ketting (#771)", () => {
    // Geen menselijke uitbeelding — alleen spelstukken, kaarttekens en zegels.
    const hero = renderKaart({ piet: true, thema: "piet" });
    for (const klasse of [
      ".hero__crest--pion",
      ".hero__ringen",
      ".hero__zegel-breuk",
      ".hero__ketting--links",
      ".hero__ketting--rechts",
    ])
      expect(hero.querySelector(klasse), klasse).toBeInTheDocument();
  });

  it("geeft de Kampioen zijn diamantcrest, lauwerkrans en linten (#781)", () => {
    const hero = renderKaart({ kampioen: true, thema: "kampioen" });
    for (const klasse of [
      ".hero__crest--kampioen",
      ".hero__krans--links",
      ".hero__krans--rechts",
      ".hero__lint-kam--links",
      ".hero__lint-kam--rechts",
      ".hero__watermerk--zegel",
    ])
      expect(hero.querySelector(klasse), klasse).toBeInTheDocument();
  });

  it("tekent de twee schande-iconen als SVG i.p.v. een emoji (#771)", () => {
    // 🤡 rendert op sommige toestellen als horrorclown en 🃏 lijkt op geen enkel
    // platform op een spelstuk; de badge draagt daarom het maskertje en de pion
    // uit het register.
    const pias = renderKaart({ pias: true, thema: "pias" });
    expect(pias.querySelector(".hero-crest__masker")).toBeInTheDocument();
    expect(
      pias.querySelector(".hero-crest--badge .hero-crest__icon")?.textContent,
    ).toBe("");

    const piet = renderKaart({ piet: true, thema: "piet" });
    expect(piet.querySelector(".hero-crest__pion")).toBeInTheDocument();
  });

  it("houdt de emoji bij een roast-schild: geen spot, dus ook geen maskertje", () => {
    // Met een schild staat er de neutrale 📊-chip; die hoort geen clownsmasker
    // te krijgen (#183).
    const hero = renderKaart({ pias: true, schild: true, thema: null });
    expect(hero.querySelector(".hero-crest__masker")).toBeNull();
    expect(
      screen.getByRole("button", { name: /opvallende week/i }).textContent,
    ).toContain("📊");
  });

  it("geeft In-Form zijn bliksem, groeven en snelheidslijnen (#771)", () => {
    // Boven een permanent thema: dun en langs de randen, zodat de kaart eronder
    // herkenbaar blijft. Op de kaart die In-Form zélf draagt staat sinds #834
    // het artwork uit de referentie — zie de suite hieronder.
    const hero = renderKaart({ pias: true, thema: "pias", inForm: true, overlay: "inform" });
    for (const klasse of [
      ".hero__crest--bliksem",
      ".hero__groeven--inform",
      ".hero__watermerk--bliksem",
      ".hero__puls",
      ".hero__snelheid--links",
      ".hero__snelheid--rechts",
    ])
      expect(hero.querySelector(klasse), klasse).toBeInTheDocument();
  });

  it("geeft On Fire zijn vlamcrest, vinnen en sintels (#771)", () => {
    const hero = renderKaart({ onFire: true, overlay: "onfire" });
    for (const klasse of [
      ".hero__crest--vlam",
      ".hero__groeven--onfire",
      ".hero__watermerk--vlam",
      ".hero__vinnen",
      ".hero__sintels--links",
      ".hero__sintels--rechts",
    ])
      expect(hero.querySelector(klasse), klasse).toBeInTheDocument();
  });

  it("laat de overlay-ornamenten bovenop die van het thema liggen (AC4)", () => {
    // De kern van #771: een pias die in vorm raakt houdt zijn narrenkap en zijn
    // maskers; de bliksem komt erbij, niet in de plaats.
    const hero = renderKaart({
      pias: true,
      inForm: true,
      thema: "pias",
      overlay: "inform",
    });
    for (const klasse of [
      ".hero__crest--kap",
      ".hero__medaillon",
      ".hero__decor",
      ".hero__crest--bliksem",
      ".hero__tint--inform",
    ])
      expect(hero.querySelector(klasse), klasse).toBeInTheDocument();
  });

  it("schuift de crest van het thema opzij zodra een overlay er een neerzet", () => {
    // Twee crests op dezelfde plek in de bovenrand zou een kluwen geven.
    const hero = renderKaart({
      bigDaddy: true,
      onFire: true,
      thema: "bigdaddy",
      overlay: "onfire",
    });
    expect(hero.querySelector(".hero__lagen--voor")).toHaveClass("is-overlay");
    expect(HERO_CSS).toMatch(
      /\.hero__lagen--voor\.is-overlay[^{]*\{\s*left:\s*26%/,
    );
  });

  it("beweegt de pulse-ring alleen zonder bewegingsvoorkeur (AC11)", () => {
    // Anders dan de glansbaan heeft de ring géén zinnige stilstaande vorm: een
    // halfdoorzichtige cirkel midden op de kaart leest als een vlek. Hij blijft
    // dus onzichtbaar bij `reduce`.
    const blok = bewegingsblok("hero-puls");
    expect(blok).toMatch(/animation: hero-puls/);
    expect(HERO_CSS.replace(blok, "")).not.toMatch(/animation:\s*hero-puls/);
  });

  it("verbergt de lagen voor schermlezers en laat aanwijzers erdoor", () => {
    // Met een permanent thema eronder, want dan staat de tint er: op de eigen
    // In-Form-kaart is het vlak zelf al zwart en zou een tint de storm doven.
    const hero = renderKaart({ pias: true, thema: "pias", inForm: true, overlay: "inform" });
    const lagen = hero.querySelector(".hero__lagen");
    expect(lagen).toHaveAttribute("aria-hidden", "true");
    expect(hero.querySelector(".hero__tint--inform")).toBeInTheDocument();
    expect(hero.querySelector(".hero__sheen--inform")).toBeInTheDocument();
    // pointer-events staat in CSS (jsdom rekent geen stylesheets door).
    expect(HERO_CSS).toMatch(/\.hero__lagen\s*\{[^}]*pointer-events:\s*none/);
  });

  it("deelt één glansregel tussen de twee overlays (AC: één sheencomponent)", () => {
    // De baan zelf staat één keer in de CSS; alleen de kleur hangt aan de
    // variant. Zo kunnen In-Form en On Fire niet uit elkaar gaan lopen.
    expect(HERO_CSS).toMatch(
      /\.hero__sheen\s*\{[^}]*var\(--hero-sheen-kleur\)/s,
    );
    for (const overlay of ["inform", "onfire"])
      expect(HERO_CSS).toMatch(
        new RegExp(`\\.hero__sheen--${overlay}\\s*\\{\\s*--hero-sheen-kleur:`),
      );
  });

  it("beweegt alleen zonder bewegingsvoorkeur, met een statische baan als terugval", () => {
    // De animatie hangt achter `no-preference`, dus wie beweging afwijst houdt de
    // stilstaande glans in plaats van geen glans (AC11).
    const blok = bewegingsblok("hero-sheen");
    expect(blok).toMatch(/animation: hero-sheen/);
    expect(blok).toMatch(/@keyframes hero-sheen/);
    // Buiten dat blok staat geen tweede animatie op de baan.
    expect(HERO_CSS.replace(blok, "")).not.toMatch(/animation:\s*hero-sheen/);
  });

  it("houdt de inhoud boven de decoratie", () => {
    // Anders zou de bewegende glans over de tekst en de knoppen lopen.
    expect(HERO_CSS).toMatch(
      /\.hero__main,\s*\.hero__divide,\s*\.hero__foot\s*\{[^}]*z-index:\s*1/,
    );
  });
});
