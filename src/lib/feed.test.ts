import { describe, it, expect } from "vitest";
import { buildFeed, feedDay, networkIds } from "./feed";
import type { Friendship, Match, Team } from "./types";

const TEAMS: Record<string, Team> = {
  "t-ab": { id: "t-ab", player1_id: "p1", player2_id: "p2" } as Team,
  "t-cd": { id: "t-cd", player1_id: "p3", player2_id: "p4" } as Team,
  "t-xy": { id: "t-xy", player1_id: "p8", player2_id: "p9" } as Team,
};

const friend = (id: string, other: string, at: string, status = "accepted") =>
  ({
    id,
    requester_id: "p1",
    addressee_id: other,
    status,
    created_at: at,
    updated_at: at,
  }) as Friendship;

let seq = 0;
const match = (at: string, a = "t-ab", b = "t-cd", status = "completed") =>
  ({
    id: `m-${seq++}`,
    team_a_id: a,
    team_b_id: b,
    status,
    winner_team_id: a,
    played_at: at,
    created_at: at,
  }) as Match;

describe("buildFeed", () => {
  it("mengt matches en vriendschappen, nieuwste boven", () => {
    const feed = buildFeed({
      matches: [match("2026-07-08T18:00:00Z"), match("2026-07-10T18:00:00Z")],
      teams: TEAMS,
      friendships: [friend("f1", "p2", "2026-07-09T12:00:00Z")],
      myId: "p1",
    });
    expect(feed.map((e) => e.kind)).toEqual(["match", "friendship", "match"]);
    expect(feed[0].at).toBe("2026-07-10T18:00:00Z");
  });

  it("filtert matches buiten je netwerk weg", () => {
    const feed = buildFeed({
      // p8/p9 tegen elkaar: geen vriend van p1 → onzichtbaar.
      matches: [match("2026-07-10T18:00:00Z", "t-xy", "t-xy")],
      teams: TEAMS,
      friendships: [friend("f1", "p2", "2026-07-01T12:00:00Z")],
      myId: "p1",
    });
    expect(feed.filter((e) => e.kind === "match")).toHaveLength(0);
  });

  it("negeert geplande matches en niet-geaccepteerde vriendschappen", () => {
    const feed = buildFeed({
      matches: [match("2026-07-10T18:00:00Z", "t-ab", "t-cd", "planned")],
      teams: TEAMS,
      friendships: [friend("f1", "p2", "2026-07-09T12:00:00Z", "pending")],
      myId: "p1",
    });
    expect(feed).toHaveLength(0);
  });

  it("respecteert de limiet", () => {
    const matches = Array.from({ length: 10 }, (_, i) =>
      match(`2026-07-0${(i % 9) + 1}T18:00:00Z`),
    );
    const feed = buildFeed({
      matches,
      teams: TEAMS,
      friendships: [],
      myId: "p1",
      limit: 3,
    });
    expect(feed).toHaveLength(3);
  });
});

describe("networkIds / feedDay", () => {
  it("netwerk = ik + geaccepteerde vrienden", () => {
    const ids = networkIds(
      [
        friend("f1", "p2", "2026-07-01T12:00:00Z"),
        friend("f2", "p3", "2026-07-01T12:00:00Z", "pending"),
      ],
      "p1",
    );
    expect([...ids].sort()).toEqual(["p1", "p2"]);
  });

  it("feedDay pakt de kalenderdag", () => {
    expect(
      feedDay({ kind: "friendship", at: "2026-07-09T12:34:00Z", meId: "a", friendId: "b" }),
    ).toBe("2026-07-09");
  });
});
