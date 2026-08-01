import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MatchCard } from "@/features/matches/components/MatchList";
import { lefKaartRegel, playDay } from "@/features/matches/stakes";
import { MATCH_DONE, PROFILES, TEAMS } from "@/test/fixtures";
import type { Match, Profile, Team } from "@/types";

// De ingeklapte matchkaart (#981): de lef-regel die RondeBlok en MatchHistory
// via lefKaartRegel aanleveren blijft ook op de compacte kaart leesbaar.

const tmap = Object.fromEntries(TEAMS.map((t) => [t.id, t])) as Record<
  string,
  Team
>;
const pmap = Object.fromEntries(PROFILES.map((p) => [p.id, p])) as Record<
  string,
  Profile
>;

const STAKE = {
  match_id: MATCH_DONE.id,
  player_id: "p3",
  group_id: "g1",
  play_date: playDay(MATCH_DONE.played_at),
  created_at: MATCH_DONE.played_at,
};

function renderKaart(lef: string | null) {
  return render(
    <MemoryRouter>
      <MatchCard
        match={MATCH_DONE as Match}
        teams={tmap}
        profiles={pmap}
        lef={lef}
      />
    </MemoryRouter>,
  );
}

describe("<MatchCard /> met lef-regel (#981)", () => {
  it("toont wie er dubbel of niets speelde, met de uitkomst", () => {
    // t-ab won; Carol (p3, t-cd) zette in en verloor dus.
    const regel = lefKaartRegel({
      match: MATCH_DONE as Match,
      stakes: [STAKE],
      teams: tmap,
      naam: (id) => pmap[id]?.username ?? id,
    });
    renderKaart(regel);
    expect(
      screen.getByText(/🎲 lef ×2 · carol — verlies/i),
    ).toBeInTheDocument();
  });

  it("laat de kaart met rust zonder inzet", () => {
    renderKaart(null);
    expect(screen.queryByText(/lef/i)).not.toBeInTheDocument();
  });
});
