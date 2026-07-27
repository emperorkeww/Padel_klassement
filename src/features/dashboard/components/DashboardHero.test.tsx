import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { BD_KROON } from "@/features/rating/components/ornamentenBigDaddy";
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

  it("geeft Big Daddy de ornamenten van zijn FUT-kaart (#771)", () => {
    const hero = renderKaart({ bigDaddy: true, thema: "bigdaddy" });
    // Kroon in de bovenrand, ballonnen, twee lintkrullen en confetti — precies de
    // opsomming uit de issue, en geen ervan verzonnen: de paden komen uit het
    // register van de 👑-kaart.
    for (const klasse of [
      ".hero__crest--kroon",
      ".hero__ballonnen",
      ".hero__lint--links",
      ".hero__lint--rechts",
      ".hero__confetti",
      ".hero__watermerk--kroon",
    ])
      expect(hero.querySelector(klasse), klasse).toBeInTheDocument();
    // De kroon is letterlijk het pad van de kaart; zou dit bestand een eigen
    // silhouet tekenen, dan drijven kaart en dashboard uit elkaar.
    expect(
      hero.querySelector(`.hero__crest--kroon path[d="${BD_KROON}"]`),
    ).toBeInTheDocument();
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
    // De kroon steekt boven de kaart uit en mag dus niet geklipt worden; het
    // materiaal eronder juist wél.
    expect(voor?.querySelector(".hero__crest--kroon")).toBeInTheDocument();
    expect(HERO_CSS).toMatch(
      /\.hero__lagen--voor\s*\{[^}]*overflow:\s*visible/,
    );
    // Beide lagen laten de aanwijzer door naar de knoppen eronder (AC10).
    expect(HERO_CSS).toMatch(/\.hero__lagen\s*\{[^}]*pointer-events:\s*none/);
  });

  it("laat een thema zonder eigen ornamenten de voorste laag weg", () => {
    // Pias en het schande-token krijgen hun ornamenten in een volgende PR; tot
    // dan staat er geen lege span in hun DOM.
    for (const thema of ["pias", "piet"] as const) {
      const hero = renderKaart({ [thema]: true, thema });
      expect(hero.querySelector(".hero__lagen--voor")).toBeNull();
    }
  });

  it("verbergt de lagen voor schermlezers en laat aanwijzers erdoor", () => {
    const hero = renderKaart({ inForm: true, overlay: "inform" });
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
    const beweging = HERO_CSS.match(
      /@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\n\}/,
    );
    expect(beweging?.[0]).toMatch(/animation: hero-sheen/);
    expect(beweging?.[0]).toMatch(/@keyframes hero-sheen/);
    // Buiten dat blok staat geen tweede animatie op de baan.
    expect(HERO_CSS.replace(beweging![0], "")).not.toMatch(/animation:\s*hero-sheen/);
  });

  it("houdt de inhoud boven de decoratie", () => {
    // Anders zou de bewegende glans over de tekst en de knoppen lopen.
    expect(HERO_CSS).toMatch(
      /\.hero__main,\s*\.hero__divide,\s*\.hero__foot\s*\{[^}]*z-index:\s*1/,
    );
  });
});
