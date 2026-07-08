import { describe, it, expect } from "vitest";
import { tallyProposal, upcomingProposals } from "./proposalLogic";
import type { PlayProposal, ProposalVote } from "./proposalsApi";

function proposal(overrides: Partial<PlayProposal> = {}): PlayProposal {
  return {
    id: "prop-1",
    group_id: "g1",
    created_by: "p1",
    date: "2026-07-10",
    start_time: "20:00",
    courts: 1,
    club_name: null,
    created_at: "2026-07-08T10:00:00Z",
    ...overrides,
  };
}

function vote(
  playerId: string,
  status: ProposalVote["status"],
  proposalId = "prop-1",
): ProposalVote {
  return {
    proposal_id: proposalId,
    group_id: "g1",
    player_id: playerId,
    status,
    updated_at: "2026-07-08T10:00:00Z",
  };
}

describe("tallyProposal", () => {
  it("telt reacties per status en negeert andere voorstellen", () => {
    const t = tallyProposal(proposal(), [
      vote("p1", "yes"),
      vote("p2", "yes"),
      vote("p3", "maybe"),
      vote("p4", "no"),
      vote("p5", "yes", "ander-voorstel"),
    ]);
    expect(t.yes).toEqual(["p1", "p2"]);
    expect(t.maybe).toEqual(["p3"]);
    expect(t.no).toEqual(["p4"]);
  });

  it("is speelbaar vanaf 4 spelers per baan", () => {
    const drie = tallyProposal(proposal(), [
      vote("p1", "yes"),
      vote("p2", "yes"),
      vote("p3", "yes"),
    ]);
    expect(drie.playable).toBe(false);
    expect(drie.needed).toBe(1);

    const vier = tallyProposal(proposal(), [
      vote("p1", "yes"),
      vote("p2", "yes"),
      vote("p3", "yes"),
      vote("p4", "yes"),
    ]);
    expect(vier.playable).toBe(true);
    expect(vier.needed).toBe(0);
  });

  it("schaalt de drempel mee met het aantal banen; maybe telt niet mee", () => {
    const votes = [
      vote("p1", "yes"),
      vote("p2", "yes"),
      vote("p3", "yes"),
      vote("p4", "yes"),
      vote("p5", "maybe"),
    ];
    const t = tallyProposal(proposal({ courts: 2 }), votes);
    expect(t.playable).toBe(false);
    expect(t.needed).toBe(4);
  });
});

describe("upcomingProposals", () => {
  it("filtert het verleden weg en sorteert op datum + tijd", () => {
    const lijst = [
      proposal({ id: "a", date: "2026-07-12", start_time: "18:00" }),
      proposal({ id: "b", date: "2026-07-10", start_time: "21:00" }),
      proposal({ id: "c", date: "2026-07-10", start_time: "19:30" }),
      proposal({ id: "d", date: "2026-07-01", start_time: "20:00" }), // voorbij
    ];
    const upcoming = upcomingProposals(lijst, "2026-07-08");
    expect(upcoming.map((p) => p.id)).toEqual(["c", "b", "a"]);
  });

  it("houdt voorstellen van vandaag zelf nog vast", () => {
    const upcoming = upcomingProposals(
      [proposal({ id: "vandaag", date: "2026-07-08" })],
      "2026-07-08",
    );
    expect(upcoming.map((p) => p.id)).toEqual(["vandaag"]);
  });
});
