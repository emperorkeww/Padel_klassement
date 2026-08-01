import { readFileSync } from "node:fs";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

// De geplande matchkaart stond volledig uitgeklapt: steppers, sets, bounty,
// toto, lef, coach, rivaliteit en Opslaan bij elkaar ~800px per kaart, en een
// lijst met een handvol matches werd 10.000px hoog (#941). Deze suite bewaakt
// wat er ingeklapt zichtbaar blijft, wat er achter de knop verdwijnt, en dat
// die knop belooft wat je met de match mag.

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
import { openPlannedCards } from "@/test/plannedCard";
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

describe("<PlannedMatchCard /> ingeklapt (#941)", () => {
  it("toont kop, teams en één knop — en geen invulformulier", async () => {
    renderCard();
    // Wanneer en wie: de essentie van een geplande match.
    expect(await screen.findByText(/alice anders/i)).toBeInTheDocument();
    expect(screen.getByText(/carol claes/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^uitslag invullen$/i }),
    ).toBeInTheDocument();
    // Het formulier en zijn context zitten erachter.
    expect(
      screen.queryByLabelText(/^score alice anders & bob boers$/i),
    ).toBeNull();
    expect(screen.queryByText(/sets per set invoeren/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /^opslaan$/i })).toBeNull();
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

  it("klapt het formulier uit en weer in", async () => {
    renderCard();
    await openPlannedCards();
    const stepper = await screen.findByLabelText(
      /^score alice anders & bob boers$/i,
    );
    expect(stepper).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^opslaan$/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^inklappen$/i }));
    expect(
      screen.queryByLabelText(/^score alice anders & bob boers$/i),
    ).toBeNull();
  });

  it("koppelt de knop aan het blok dat hij opent", async () => {
    const { container } = renderCard();
    const knop = await screen.findByRole("button", {
      name: /^uitslag invullen$/i,
    });
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

  it("zet de stepper op smalle schermen op een eigen regel", () => {
    const smal = CARD_CSS.slice(CARD_CSS.indexOf("@media (max-width: 480px)"));
    expect(smal).toMatch(/\.planned-card__row\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(smal).toMatch(/\.planned-card__row \.stepper\s*\{[^}]*flex:\s*1 1 100%/);
  });
});
