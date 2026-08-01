import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Badge } from "@/features/profiles/badges";
import type { Match, Profile, Team } from "@/types";
import { DashExtras } from "./DashExtras";
import { NextMatchCard } from "./NextMatchCard";

// De blokken onder de hero (#940). Op 390px offerde "Jouw volgende match" de
// spelersnamen op aan de metadata, kapten missie- en badge-omschrijvingen af
// zodra het rechterelement breed was, en stapelden er twee kaartranden om
// hetzelfde blok. Wat hier staat is de afspraak die dat rechthoudt; de visuele
// controle loopt via /dev/overzicht.

// jsdom rekent geen layout door, dus de regels die het gedrag bepalen
// (white-space, grid, gap) worden uit de stylesheet zelf gelezen — dezelfde
// aanpak als DashboardHero.test.tsx.
const DASH_CSS = readFileSync("src/features/dashboard/Dashboard.css", "utf8");

const PROFIELEN: Record<string, Profile> = Object.fromEntries(
  [
    ["p2", "Alice Vandenberghe"],
    ["p3", "Fran Vermeersch"],
    ["p4", "Carla Vanderplancke"],
    ["p5", "Erik Vandewalle"],
  ].map(([id, naam]) => [
    id,
    {
      id,
      full_name: naam,
      username: id,
      avatar_url: null,
      created_at: "2026-01-01T00:00:00Z",
    } as Profile,
  ]),
);

const TEAMS: Record<string, Team> = {
  ta: {
    id: "ta",
    name: null,
    player1_id: "p2",
    player2_id: "p3",
    created_at: "2026-01-01T00:00:00Z",
  },
  tb: {
    id: "tb",
    name: null,
    player1_id: "p4",
    player2_id: "p5",
    created_at: "2026-01-01T00:00:00Z",
  },
};

const MATCH: Match = {
  id: "m1",
  team_a_id: "ta",
  team_b_id: "tb",
  status: "scheduled",
  winner_team_id: null,
  played_at: null,
  created_by: "p1",
  created_at: "2026-08-01T08:00:00Z",
  group_id: "g1",
  round_number: 1,
  score_a: null,
  score_b: null,
  format: "2v2",
};

const BADGE: Badge = {
  id: "klimmer",
  naam: "Klimmer",
  emoji: "📈",
  omschrijving: "Bereik een rating van 1300 in het clubklassement.",
  behaald: false,
  voortgang: { nu: 1201, doel: 1300 },
};

describe("<NextMatchCard /> — namen boven metadata (#940)", () => {
  it("toont alle vier de namen voluit", () => {
    render(
      <MemoryRouter>
        <NextMatchCard
          match={MATCH}
          groupName="Vrijdagavond Padel"
          teams={TEAMS}
          profiles={PROFIELEN}
        />
      </MemoryRouter>,
    );
    for (const naam of Object.values(PROFIELEN))
      expect(screen.getByText(naam.full_name!)).toBeInTheDocument();
  });

  it("zet de metadata onder de paring in plaats van ertussen", () => {
    // In het midden stond "ronde 1 · gepland · <groep>" — die regel kreeg de
    // volle breedte en de namen ernaast niet. Daar staat nu "vs".
    const { container } = render(
      <MemoryRouter>
        <NextMatchCard
          match={MATCH}
          groupName="Vrijdagavond Padel"
          teams={TEAMS}
          profiles={PROFIELEN}
        />
      </MemoryRouter>,
    );
    expect(container.querySelector(".match-card__mid")).toHaveTextContent("vs");
    const meta = container.querySelector(".next-match__meta");
    expect(meta).toHaveTextContent(/ronde 1 · gepland · Vrijdagavond Padel/);
    // Buiten de matchkaart, dus onder de twee teams.
    expect(meta?.closest(".match-card")).toBeNull();
  });

  it("laat de namen wrappen en stapelt de teams op smalle schermen", () => {
    expect(DASH_CSS).toMatch(
      /\.next-match \.match-card__names span\s*\{[^}]*white-space:\s*normal/,
    );
    const smal = DASH_CSS.slice(DASH_CSS.indexOf("@media (max-width: 560px)"));
    expect(smal).toMatch(
      /\.next-match \.match-card\s*\{[^}]*grid-template-columns:\s*1fr/,
    );
  });

  it("laat geen tweede kaartrand binnen de kaart staan", () => {
    // De gedeelde .match-card heeft een eigen rand; binnen "Jouw volgende
    // match" is dat een kaart in een kaart.
    expect(DASH_CSS).toMatch(/\.next-match \.match-card\s*\{[^}]*border:\s*0/);
  });
});

describe("<DashExtras /> — leesbare omschrijvingen (#940)", () => {
  function toon() {
    return render(
      <MemoryRouter>
        <DashExtras
          myId="p1"
          matches={null}
          teams={null}
          profiles={PROFIELEN}
          badges={[BADGE]}
          nextBadge={BADGE}
          rival={{
            oppId: "p4",
            rec: { played: 11, won: 5, drawn: 1, lost: 5 },
          }}
        />
      </MemoryRouter>,
    );
  }

  it("houdt sectiekoppen zonder emoji", () => {
    toon();
    expect(
      screen.getByRole("heading", { name: "Aartsrivaal" }),
    ).toBeInTheDocument();
  });

  it("laat de omschrijving van een badge wrappen in plaats van afkappen", () => {
    toon();
    expect(screen.getByText(BADGE.omschrijving)).toBeInTheDocument();
    // Of je de zin kon lezen hing af van de breedte van het rechterelement:
    // naast een vinkje paste hij, naast "1201/1300" niet.
    for (const regel of ["\\.missions__hint", "\\.next-badge__hint"])
      expect(DASH_CSS, regel).not.toMatch(
        new RegExp(`${regel}\\s*\\{[^}]*white-space:\\s*nowrap`),
      );
  });
});

describe("Overzicht — ritme en kaartranden (#940)", () => {
  it("laat de pagina één tussenruimte bepalen", () => {
    // De afstanden kwamen van `.card + .card`, en dat werkt niet tussen een
    // kaart en het cijfer-blok (een <details>): daar raakten de randen elkaar.
    expect(DASH_CSS).toMatch(/\.dashboard\s*\{[^}]*display:\s*grid/);
    expect(DASH_CSS).toMatch(/\.dashboard\s*\{[^}]*gap:\s*var\(--sp-5\)/);
    expect(DASH_CSS).toMatch(/\.dashboard > \*\s*\{\s*margin-bottom:\s*0/);
  });

  it("geeft het cijfer-blok geen tweede kaartrand om zijn kaarten", () => {
    // Alleen de inklapbalk draagt nog rand en achtergrond; de kaarten erin
    // stonden anders in een kaart, met twee niveaus binnenmarge op 390px.
    const blok = DASH_CSS.slice(
      DASH_CSS.indexOf(".dash-cijfers {"),
      DASH_CSS.indexOf(".dash-cijfers__summary::-webkit-details-marker"),
    );
    expect(blok).toMatch(/\.dash-cijfers\s*\{[^}]*display:\s*grid/);
    expect(blok).not.toMatch(/\.dash-cijfers\s*\{[^}]*border:/);
    expect(blok).toMatch(/\.dash-cijfers__summary\s*\{[^}]*border:\s*1px/);
  });

  it("stapelt titel en hint van de inklapkop in één kolom", () => {
    // Als flexrij wrapten titel én hint op 390px en werd de kop drie regels.
    expect(DASH_CSS).toMatch(
      /\.dash-cijfers__summary\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto/,
    );
    for (const deel of ["\\.dash-cijfers__title", "\\.dash-cijfers__hint"])
      expect(DASH_CSS, deel).toMatch(
        new RegExp(`${deel}\\s*\\{[^}]*grid-column:\\s*1`),
      );
  });
});
