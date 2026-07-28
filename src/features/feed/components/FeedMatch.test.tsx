import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FeedMatch } from "@/features/feed/components/FeedMatch";
import { MATCH_DONE, PROFILES, TEAMS } from "@/test/fixtures";
import type { FeedEvent } from "@/features/feed/feedLogic";
import type { Match, Profile, Team } from "@/types";

const tmap = Object.fromEntries(TEAMS.map((t) => [t.id, t])) as Record<string, Team>;
const pmap = Object.fromEntries(PROFILES.map((p) => [p.id, p])) as Record<
  string,
  Profile
>;

function renderMatch(over: Partial<Extract<FeedEvent, { kind: "match" }>>) {
  const event = {
    kind: "match",
    at: "2026-07-02T10:00:00.000Z",
    match: MATCH_DONE as Match,
    highlights: [],
    myDelta: null,
    ...over,
  } as Extract<FeedEvent, { kind: "match" }>;
  return render(
    <MemoryRouter>
      <FeedMatch
        event={event}
        tmap={tmap}
        pmap={pmap}
        name={(pid) => pmap[pid]?.username ?? pid}
      />
    </MemoryRouter>,
  );
}

describe("<FeedMatch /> rating-badge", () => {
  it("legt een verdubbelde mutatie uit met de lef-multiplier", () => {
    // Zonder deze uitleg staat er een getal dat twee keer zo groot is als dat
    // van je ploegmaat, zonder dat de feed vertelt waarom (#804).
    renderMatch({ myDelta: 24, myStakeFactor: 2 });
    expect(screen.getByText(/24 rating · lef ×2/)).toBeInTheDocument();
  });

  it("laat de badge met rust zonder inzet", () => {
    renderMatch({ myDelta: 12, myStakeFactor: 1 });
    expect(screen.getByText(/12 rating/)).toBeInTheDocument();
    expect(screen.queryByText(/lef ×/)).not.toBeInTheDocument();
  });

  it("werkt ook als de historie nog geen multiplier meelevert", () => {
    renderMatch({ myDelta: -8 });
    expect(screen.getByText(/8 rating/)).toBeInTheDocument();
    expect(screen.queryByText(/lef ×/)).not.toBeInTheDocument();
  });
});

describe("<FeedMatch /> bounty (#805)", () => {
  it("verklaart een geclaimde bounty naast de rating-badge", () => {
    renderMatch({ myDelta: 20, myBounty: 9 });
    expect(screen.getByText(/20 rating · bounty \+9/)).toBeInTheDocument();
  });

  it("toont ook wat de verslagen drager betaalde", () => {
    renderMatch({ myDelta: -28, myBounty: -17 });
    expect(screen.getByText(/28 rating · bounty −17/)).toBeInTheDocument();
  });

  it("laat de badge met rust zonder bounty", () => {
    renderMatch({ myDelta: 12 });
    expect(screen.queryByText(/bounty/)).not.toBeInTheDocument();
  });
});
