import { readFileSync } from "node:fs";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

// De geplande matchkaart stond volledig uitgeklapt: steppers, sets, bounty,
// toto, lef, coach, rivaliteit en Opslaan bij elkaar ~800px per kaart, en een
// lijst met een handvol matches werd 10.000px hoog (#941). Dat werd toen achter
// één uitklapknop gezet.
//
// Sinds #1144 is het er twee: de uitslag opent in een sheet (de primaire
// actie, één tik, en de lijst eronder verspringt niet) en de context — toto,
// lef, joker, coach, rivaliteit — zit nog achter "Details". Deze suite bewaakt
// wat er standaard zichtbaar blijft, waar de rest heen ging, en dat de knoppen
// beloven wat je met de match mag.

const OVER_2_DAGEN = new Date(Date.now() + 2 * 86400_000).toISOString();

const { tables } = vi.hoisted(() => ({
  tables: {} as Record<string, unknown[]>,
}));

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables }) };
});

import { PlannedMatchCard } from "@/features/matches/components/PlannedMatchCard";
import { MATCH_PLANNED, PROFILES, TABLES, TEAMS } from "@/test/fixtures";
import { openPlannedCards, openScoreSheets } from "@/test/plannedCard";
import type { Match, Profile, Team } from "@/types";

const CARD_CSS = readFileSync(
  "src/features/matches/components/PlannedMatchCard.css",
  "utf8",
);

/** Eén team van Dave; de fixtures hebben er geen. Samen met t-c (Carol) levert
 *  dat een match waarin Alice — de ingelogde gebruiker — niet meespeelt. */
const TEAM_D: Team = {
  id: "t-d",
  name: null,
  player1_id: "p4",
  player2_id: null,
  created_at: "2026-07-02T10:00:00.000Z",
};

const tmap = Object.fromEntries(
  [...TEAMS, TEAM_D].map((t) => [t.id, t]),
) as Record<string, Team>;
const pmap = Object.fromEntries(PROFILES.map((p) => [p.id, p])) as Record<
  string,
  Profile
>;

const GEPLAND = { ...MATCH_PLANNED, played_at: OVER_2_DAGEN } as Match;

function setTables(over: Record<string, unknown[]> = {}) {
  for (const key of Object.keys(tables)) delete tables[key];
  Object.assign(tables, {
    ...TABLES,
    matches: [GEPLAND],
    match_stakes: [],
    active_bounties: [],
    ...over,
  });
}

function renderCard(match: Match = GEPLAND) {
  setTables();
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <PlannedMatchCard match={match} teams={tmap} profiles={pmap} />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("<PlannedMatchCard /> ingeklapt (#941, #1144)", () => {
  it("toont kop, teams en de acties — en geen invulformulier", async () => {
    renderCard();
    // Wanneer en wie: de essentie van een geplande match.
    expect(await screen.findByText(/alice anders/i)).toBeInTheDocument();
    expect(screen.getByText(/carol claes/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^uitslag invullen$/i }),
    ).toBeInTheDocument();
    // Het formulier zit in de sheet, de context achter "Details".
    expect(
      screen.queryByRole("spinbutton", {
        name: /^score alice anders & bob boers$/i,
      }),
    ).toBeNull();
    expect(screen.queryByText(/sets per set invoeren/i)).toBeNull();
    expect(
      screen.queryByRole("button", { name: /uitslag opslaan/i }),
    ).toBeNull();
    expect(screen.queryByText(/🎯 toto/i)).toBeNull();
  });

  it("houdt de bounty zichtbaar zonder uit te klappen", async () => {
    setTables({
      active_bounties: [
        {
          player_id: "p1",
          group_id: "g1",
          reden: "bigdaddy",
          streak: 3,
          pool: 24,
        },
      ],
    });
    render(
      <MemoryRouter>
        <AuthProvider>
          <ToastProvider>
            <PlannedMatchCard match={GEPLAND} teams={tmap} profiles={pmap} />
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>,
    );
    // Wat er te halen valt hoort iedereen vóór de aftrap te zien — niet pas na
    // een tik op "Uitslag invullen".
    expect(
      await screen.findByText(/bounty actief: \+24 elo op het spel/i),
    ).toBeInTheDocument();
  });

  it("opent de uitslag in een sheet, niet in de kaart", async () => {
    const { container } = renderCard();
    await openScoreSheets();
    expect(
      await screen.findByRole("spinbutton", {
        name: /^score alice anders & bob boers$/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /uitslag opslaan/i }),
    ).toBeInTheDocument();
    // Het punt van de sheet: het formulier ligt in een dialoog boven de lijst,
    // niet in het kaartlichaam. De kaart groeit dus niet mee en de lijst
    // eronder verspringt niet.
    expect(
      container.querySelector('[role="dialog"] .scoreform'),
    ).not.toBeNull();
    expect(
      container.querySelector(".planned-card__body .scoreform"),
    ).toBeNull();
  });

  it("houdt de sets dicht tot je erom vraagt", async () => {
    renderCard();
    await openScoreSheets();
    // Optioneel en decoratief: wel bereikbaar, niet in de weg.
    expect(
      await screen.findByRole("button", { name: /sets per set invoeren/i }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/^set 1$/i)).toBeNull();
  });

  it("koppelt de details-knop aan het blok dat hij opent", async () => {
    const { container } = renderCard();
    const knop = await screen.findByRole("button", { name: /^details$/i });
    expect(knop).toHaveAttribute("aria-expanded", "false");
    await openPlannedCards();
    const open = screen.getByRole("button", { name: /^inklappen$/i });
    expect(open).toHaveAttribute("aria-expanded", "true");
    expect(container.querySelector(`#${open.getAttribute("aria-controls")}`)).toBe(
      container.querySelector(".planned-card__body"),
    );
  });

  it("belooft tippen aan wie de uitslag niet mag invullen", async () => {
    // Carol tegen Dave in een groep die Alice niet bezit, aangemaakt door Bob:
    // Alice (ingelogd) kijkt alleen toe en mag dus enkel tippen.
    renderCard({
      ...GEPLAND,
      id: "m-anderen",
      team_a_id: "t-c",
      team_b_id: "t-d",
      created_by: "p2",
      group_id: "g-onbekend",
      format: "1v1",
    } as Match);
    expect(
      await screen.findByRole("button", { name: /^tippen$/i }),
    ).toBeInTheDocument();
  });
});

describe("teamnamen op de geplande kaart (#941)", () => {
  it("laat namen wrappen in plaats van afkappen", () => {
    // De gedeelde .match-card kapt af met een ellipsis — daar is één regel per
    // match het punt. Hier zijn de namen de inhoud.
    expect(CARD_CSS).toMatch(
      /\.planned-card__row \.match-card__names span\s*\{[^}]*white-space:\s*normal/,
    );
  });

  it("laat de teamrij wrappen op smalle schermen", () => {
    // De stepper stond hier tot #1144 naast de namen en kreeg op 480px een
    // eigen regel; hij zit nu in de sheet. Het wrappen zelf blijft nodig voor
    // de serveerchip naast een lange naam.
    const smal = CARD_CSS.slice(CARD_CSS.indexOf("@media (max-width: 480px)"));
    expect(smal).toMatch(/\.planned-card__row\s*\{[^}]*flex-wrap:\s*wrap/);
  });
});
