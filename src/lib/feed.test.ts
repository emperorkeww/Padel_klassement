import { describe, it, expect } from "vitest";
import {
  buildFeed,
  feedDay,
  feedPrivacyFilter,
  networkIds,
  recentlyClosedSeason,
  scoreHighlight,
  UPSET_MAX_KANS,
  type FeedEvent,
} from "./feed";
import type {
  Friendship,
  GroupMember,
  Match,
  PlayerStanding,
  Profile,
  RatingPoint,
  Team,
} from "@/types";

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
const match = (
  at: string,
  a = "t-ab",
  b = "t-cd",
  status = "completed",
  extra: Partial<Match> = {},
) =>
  ({
    id: `m-${seq++}`,
    team_a_id: a,
    team_b_id: b,
    status,
    winner_team_id: status === "completed" ? a : null,
    played_at: at,
    created_at: at,
    score_a: null,
    score_b: null,
    ...extra,
  }) as Match;

/** rating_history-punt; histories is per speler, chronologisch. */
const point = (matchId: string, before: number, after: number): RatingPoint =>
  ({
    match_id: matchId,
    rating_before: before,
    rating_after: after,
    delta: after - before,
    played_at: "",
  }) as RatingPoint;

const kinds = (feed: FeedEvent[]) => feed.map((e) => e.kind);

describe("buildFeed — basis (bestaand gedrag)", () => {
  it("mengt matches en vriendschappen, nieuwste boven", () => {
    const feed = buildFeed({
      matches: [match("2026-07-08T18:00:00Z"), match("2026-07-10T18:00:00Z")],
      teams: TEAMS,
      friendships: [friend("f1", "p2", "2026-07-09T12:00:00Z")],
      myId: "p1",
    });
    expect(kinds(feed)).toEqual(["match", "friendship", "match"]);
    expect(feed[0].at).toBe("2026-07-10T18:00:00Z");
  });

  it("filtert matches buiten je netwerk weg", () => {
    const feed = buildFeed({
      matches: [match("2026-07-10T18:00:00Z", "t-xy", "t-xy")],
      teams: TEAMS,
      friendships: [friend("f1", "p2", "2026-07-01T12:00:00Z")],
      myId: "p1",
    });
    expect(feed.filter((e) => e.kind === "match")).toHaveLength(0);
  });

  it("respecteert de limiet", () => {
    const matches = Array.from({ length: 10 }, (_, i) =>
      match(`2026-07-0${(i % 9) + 1}T18:00:00Z`),
    );
    const feed = buildFeed({ matches, teams: TEAMS, friendships: [], myId: "p1", limit: 3 });
    expect(feed).toHaveLength(3);
  });
});

describe("buildFeed — highlights op het match-item (dedup)", () => {
  it("bundelt upset + score + reeks als chips op één event", () => {
    // p1+p2 winnen 3× op rij; de derde is een 6-0 én een upset (winnaars
    // stonden vooraf ver onder de verliezers).
    const m1 = match("2026-07-08T18:00:00Z");
    const m2 = match("2026-07-09T18:00:00Z");
    const m3 = match("2026-07-10T18:00:00Z", "t-ab", "t-cd", "completed", {
      score_a: 6,
      score_b: 0,
    });
    const histories: Record<string, RatingPoint[]> = {
      p1: [point(m3.id, 900, 930)],
      p2: [point(m3.id, 900, 930)],
      p3: [point(m3.id, 1100, 1070)],
      p4: [point(m3.id, 1100, 1070)],
    };
    const feed = buildFeed({
      matches: [m1, m2, m3],
      teams: TEAMS,
      friendships: [],
      myId: "p1",
      histories,
    });
    // Drie match-events, geen losse extra items.
    expect(kinds(feed)).toEqual(["match", "match", "match"]);
    const top = feed[0];
    if (top.kind !== "match") throw new Error("verwacht match-event");
    const types = top.highlights.map((h) => h.type).sort();
    // upset + bagel + spelers-reeks (alleen p1 in het netwerk) + duo-reeks.
    expect(types).toEqual(["duo", "score", "streak", "upset"]);
    const upset = top.highlights.find((h) => h.type === "upset");
    if (!upset || upset.type !== "upset") throw new Error("verwacht upset");
    expect(upset.chance).toBeLessThan(UPSET_MAX_KANS);
    expect(upset.winnerTeamId).toBe("t-ab");
  });

  it("rating-mijlpaal: grens gekruist bij deze match", () => {
    const m = match("2026-07-10T18:00:00Z");
    const feed = buildFeed({
      matches: [m],
      teams: TEAMS,
      friendships: [],
      myId: "p1",
      histories: { p1: [point(m.id, 1095, 1104)] },
    });
    const top = feed[0];
    if (top.kind !== "match") throw new Error("verwacht match-event");
    expect(top.highlights).toContainEqual({
      type: "rating",
      playerId: "p1",
      threshold: 1100,
    });
    expect(top.myDelta).toBe(9);
  });

  it("ranking-wissel: promotie naar een nieuwe divisie komt in de feed", () => {
    const m = match("2026-07-10T18:00:00Z");
    const feed = buildFeed({
      matches: [m],
      teams: TEAMS,
      friendships: [],
      myId: "p1",
      histories: { p1: [point(m.id, 1095, 1105)] }, // Wannabe I → Glazenwasser III
    });
    const top = feed[0];
    if (top.kind !== "match") throw new Error("verwacht match-event");
    expect(top.highlights).toContainEqual({
      type: "tier",
      playerId: "p1",
      label: "Glazenwasser III",
      emoji: "🪟",
      richting: "promotie",
    });
  });

  it("ranking-wissel: ook een sub-niveau (III→II) komt in de feed", () => {
    const m = match("2026-07-10T18:00:00Z");
    const feed = buildFeed({
      matches: [m],
      teams: TEAMS,
      friendships: [],
      myId: "p1",
      histories: { p1: [point(m.id, 1005, 1040)] }, // Wannabe III → Wannabe II
    });
    const top = feed[0];
    if (top.kind !== "match") throw new Error("verwacht match-event");
    expect(top.highlights).toContainEqual({
      type: "tier",
      playerId: "p1",
      label: "Wannabe II",
      emoji: "😤",
      richting: "promotie",
    });
  });

  it("geen chips zonder aanleiding; myDelta null zonder history", () => {
    const feed = buildFeed({
      matches: [match("2026-07-10T18:00:00Z")],
      teams: TEAMS,
      friendships: [],
      myId: "p1",
    });
    const top = feed[0];
    if (top.kind !== "match") throw new Error("verwacht match-event");
    expect(top.highlights.filter((h) => h.type !== "streak")).toHaveLength(0);
    expect(top.myDelta).toBeNull();
  });
});

describe("scoreHighlight — één chip, sterkste verhaal eerst", () => {
  const scored = (a: number, b: number) =>
    match("2026-07-10T18:00:00Z", "t-ab", "t-cd", "completed", { score_a: a, score_b: b });
  it("bagel boven monsterzege; nagelbijter bij 1 verschil", () => {
    expect(scoreHighlight(scored(6, 0))).toEqual({ type: "score", label: "bagel" });
    expect(scoreHighlight(scored(6, 2))).toEqual({ type: "score", label: "monsterzege" });
    expect(scoreHighlight(scored(6, 5))).toEqual({ type: "score", label: "nagelbijter" });
    expect(scoreHighlight(scored(6, 3))).toBeNull();
  });
});

describe("buildFeed — geplande matches", () => {
  it("nieuw gepland mét speeltijd verschijnt; zonder tijd (ronde) niet", () => {
    const gepland = match("2026-07-12T20:00:00Z", "t-ab", "t-cd", "scheduled", {
      created_at: "2026-07-10T09:00:00Z",
    });
    const ronde = match("", "t-ab", "t-cd", "scheduled", {
      created_at: "2026-07-10T09:00:00Z",
      played_at: null,
    });
    const feed = buildFeed({
      matches: [gepland, ronde],
      teams: TEAMS,
      friendships: [],
      myId: "p1",
    });
    expect(kinds(feed)).toEqual(["planned"]);
    expect(feed[0].at).toBe("2026-07-10T09:00:00Z"); // moment van plannen
  });
});

describe("buildFeed — groepen en polls", () => {
  const groups = [
    { id: "g1", name: "Vrijdagavond", created_at: "2026-07-01T10:00:00Z", created_by: "p1" },
  ];
  it("groep aangemaakt + latere toetreder; oprichters geen apart item", () => {
    const members: Record<string, GroupMember[]> = {
      g1: [
        { group_id: "g1", player_id: "p1", role: "owner", joined_at: "2026-07-01T10:00:30Z" },
        { group_id: "g1", player_id: "p5", role: "member", joined_at: "2026-07-09T08:00:00Z" },
      ],
    };
    const feed = buildFeed({
      matches: [],
      teams: TEAMS,
      friendships: [],
      myId: "p1",
      groups,
      membersByGroup: members,
    });
    expect(kinds(feed)).toEqual(["group-joined", "group-created"]);
    const joined = feed[0];
    if (joined.kind !== "group-joined") throw new Error("verwacht group-joined");
    expect(joined.playerId).toBe("p5");
  });

  it("poll gestart verschijnt; geannuleerde niet", () => {
    const feed = buildFeed({
      matches: [],
      teams: TEAMS,
      friendships: [],
      myId: "p1",
      groups,
      pollsByGroup: {
        g1: [
          { group_id: "g1", status: "open", created_at: "2026-07-10T12:00:00Z" },
          { group_id: "g1", status: "cancelled", created_at: "2026-07-09T12:00:00Z" },
        ],
      },
    });
    expect(kinds(feed)).toEqual(["poll", "group-created"]);
  });
});

describe("buildFeed — publiek: groepsgenoten (#138)", () => {
  const groups = [
    { id: "g1", name: "Club", created_at: "2026-06-01T10:00:00Z", created_by: "p8" },
  ];
  const members: Record<string, GroupMember[]> = {
    g1: [
      { group_id: "g1", player_id: "p1", role: "member", joined_at: "2026-06-01T10:00:10Z" },
      { group_id: "g1", player_id: "p8", role: "owner", joined_at: "2026-06-01T10:00:00Z" },
      { group_id: "g1", player_id: "p9", role: "member", joined_at: "2026-06-01T10:00:20Z" },
    ],
  };

  it("matches van groepsgenoten zijn zichtbaar zonder vriendschap", () => {
    const feed = buildFeed({
      matches: [match("2026-07-10T18:00:00Z", "t-xy", "t-xy")], // p8/p9
      teams: TEAMS,
      friendships: [],
      myId: "p1",
      groups,
      membersByGroup: members,
    });
    expect(feed.some((e) => e.kind === "match")).toBe(true);
  });

  it("andermans (zichtbare) vriendschap wordt een event met beide namen", () => {
    const tussenAnderen = {
      id: "f9",
      requester_id: "p8",
      addressee_id: "p9",
      status: "accepted",
      created_at: "2026-07-10T09:00:00Z",
      updated_at: "2026-07-10T09:00:00Z",
    } as Friendship;
    const feed = buildFeed({
      matches: [],
      teams: TEAMS,
      friendships: [tussenAnderen],
      myId: "p1",
      groups,
      membersByGroup: members,
    });
    const ev = feed.find((e) => e.kind === "friendship");
    if (!ev || ev.kind !== "friendship") throw new Error("verwacht friendship");
    expect([ev.a, ev.b]).toEqual(["p8", "p9"]);
    // Maar p8/p9 worden er géén vrienden van p1 door (networkIds-guard).
    expect([...networkIds([tussenAnderen], "p1")]).toEqual(["p1"]);
  });

  it("verbergt andermans netwerk-vriendschap als een partij niet vindbaar is (#326)", () => {
    // De bredere zichtbaarheid (#326) laat andermans vriendschappen op de feed
    // toe, maar de privacyfilter blijft: is één partij niet discoverable, dan
    // verdwijnt het "zijn nu vrienden"-item alsnog.
    const tussenAnderen = {
      id: "f9",
      requester_id: "p8",
      addressee_id: "p9",
      status: "accepted",
      created_at: "2026-07-10T09:00:00Z",
      updated_at: "2026-07-10T09:00:00Z",
    } as Friendship;
    const profiles: Record<string, Profile> = {
      p8: { id: "p8", username: "p8", full_name: null, discoverable: true } as Profile,
      p9: { id: "p9", username: "p9", full_name: null, discoverable: false } as Profile,
    };
    const feed = buildFeed({
      matches: [],
      teams: TEAMS,
      friendships: [tussenAnderen],
      myId: "p1",
      groups,
      membersByGroup: members,
      profiles,
      filter: feedPrivacyFilter(profiles),
    });
    expect(feed.some((e) => e.kind === "friendship")).toBe(false);
  });
});

describe("buildFeed — klassementsprong", () => {
  const standing = (pid: string, points: number, gd: number): PlayerStanding =>
    ({
      player_id: pid,
      username: pid,
      full_name: pid,
      played: 5,
      won: Math.floor(points / 3),
      drawn: 0,
      lost: 5 - Math.floor(points / 3),
      points,
      goal_diff: gd,
    }) as PlayerStanding;

  it("meldt alleen grote sprongen van netwerk-spelers", () => {
    // rankShifts reconstrueert de stand van vóór de laatste speeldag door de
    // winst van vandaag terug te draaien: p1 zakt dan naar 9 punten met de
    // laagste goal_diff → plek 4 vóór, plek 1 nu = sprong van 3.
    const today = match("2026-07-10T18:00:00Z"); // p1+p2 winnen
    const standings = [
      standing("p1", 12, 0),
      standing("p8", 9, 5),
      standing("p9", 9, 4),
      standing("p3", 9, 3),
    ];
    const feed = buildFeed({
      matches: [today],
      teams: TEAMS,
      friendships: [],
      myId: "p1",
      standings,
    });
    const rankEvents = feed.filter((e) => e.kind === "rank");
    expect(rankEvents.map((e) => (e.kind === "rank" ? e.playerId : ""))).toContain("p1");
    // p2 steeg mee maar p8/p9 (geen netwerk) verschijnen nooit.
    expect(rankEvents.some((e) => e.kind === "rank" && e.playerId === "p8")).toBe(false);
  });
});

describe("buildFeed — feed v2 (#143)", () => {
  const groups = [
    { id: "g1", name: "Vrijdagavond", created_at: "2026-06-01T10:00:00Z", created_by: "p1" },
  ];

  it("bundelt 3+ groepsmatches op één dag tot één avond-item", () => {
    const avond = Array.from({ length: 3 }, (_, i) =>
      match(`2026-07-10T${18 + i}:00:00Z`, "t-ab", "t-cd", "completed", {
        group_id: "g1",
      }),
    );
    const feed = buildFeed({
      matches: avond,
      teams: TEAMS,
      friendships: [],
      myId: "p1",
      groups,
    });
    const evening = feed.find((e) => e.kind === "evening");
    if (!evening || evening.kind !== "evening") throw new Error("verwacht evening");
    expect(evening.count).toBe(3);
    expect(evening.groupName).toBe("Vrijdagavond");
    expect(evening.topPlayerId).toBe("p1"); // t-ab won alles
    expect(evening.bestDuoTeamId).toBe("t-ab");
    // De losse matchkaarten zijn opgegaan in het bundel-item; het duo-chipje
    // (t-ab 3 samen op rij) reist mee.
    expect(feed.filter((e) => e.kind === "match")).toHaveLength(0);
    expect(evening.highlights.some((h) => h.type === "duo")).toBe(true);
  });

  it("bundelt niet onder de drempel of buiten eigen groepen", () => {
    const twee = Array.from({ length: 2 }, (_, i) =>
      match(`2026-07-10T${18 + i}:00:00Z`, "t-ab", "t-cd", "completed", {
        group_id: "g1",
      }),
    );
    const vreemdeGroep = Array.from({ length: 3 }, (_, i) =>
      match(`2026-07-09T${18 + i}:00:00Z`, "t-ab", "t-cd", "completed", {
        group_id: "g-onbekend",
      }),
    );
    const feed = buildFeed({
      matches: [...twee, ...vreemdeGroep],
      teams: TEAMS,
      friendships: [],
      myId: "p1",
      groups,
    });
    expect(feed.some((e) => e.kind === "evening")).toBe(false);
    expect(feed.filter((e) => e.kind === "match")).toHaveLength(5);
  });

  it("poll vastgelegd/geboekt worden events met het gekozen moment", () => {
    const feed = buildFeed({
      matches: [],
      teams: TEAMS,
      friendships: [],
      myId: "p1",
      groups,
      pollsByGroup: {
        g1: [
          {
            group_id: "g1",
            status: "booked",
            created_at: "2026-07-08T10:00:00Z",
            locked_at: "2026-07-09T12:00:00Z",
            booked_at: "2026-07-09T13:00:00Z",
            locked_date: "2026-07-11",
            locked_time: "20:00",
          },
        ],
      },
    });
    expect(kinds(feed)).toEqual([
      "poll-booked",
      "poll-locked",
      "poll",
      "group-created",
    ]);
    const booked = feed[0];
    if (booked.kind !== "poll-booked") throw new Error("verwacht poll-booked");
    expect(booked.date).toBe("2026-07-11");
    expect(booked.time).toBe("20:00");
  });

  it("filter werkt vóór de limiet", () => {
    const feed = buildFeed({
      matches: [match("2026-07-10T18:00:00Z")],
      teams: TEAMS,
      friendships: [friend("f1", "p2", "2026-07-09T12:00:00Z")],
      myId: "p1",
      filter: (e) => e.kind === "friendship",
    });
    expect(kinds(feed)).toEqual(["friendship"]);
  });
});

describe("recentlyClosedSeason", () => {
  it("geeft het vorige kwartaal alleen kort na de wissel", () => {
    // 5 juli: Q2 sloot 5 dagen geleden → melden.
    const s = recentlyClosedSeason(new Date("2026-07-05T12:00:00Z"));
    expect(s?.id).toBe("2026-q2");
    // 15 augustus: venster (21 dagen) voorbij → niets.
    expect(recentlyClosedSeason(new Date("2026-08-15T12:00:00Z"))).toBeNull();
  });
});

describe("buildFeed — Pias van de maand (#167)", () => {
  const groups = [
    { id: "g1", name: "Vrijdagavond", created_at: "2026-06-01T10:00:00Z", created_by: "p1" },
  ];
  // "Nu" valt vroeg in juli → juni is de net-gesloten maand (binnen venster).
  const now = new Date("2026-07-03T12:00:00Z");
  // Een bagel in juni: team t-cd (p3/p4) wint met 6–0 van t-ab (p1/p2).
  const bagel = match("2026-06-15T18:00:00Z", "t-ab", "t-cd", "completed", {
    winner_team_id: "t-cd",
    score_a: 0,
    score_b: 6,
  });

  it("levert een maand-pias-event voor de net-gesloten maand", () => {
    const feed = buildFeed({
      matches: [bagel],
      teams: TEAMS,
      friendships: [],
      myId: "p1",
      groups,
      groupMatchesByGroup: { g1: [bagel] },
      now,
    });
    const pias = feed.find((e) => e.kind === "maand-pias");
    expect(pias).toBeTruthy();
    if (pias?.kind !== "maand-pias") throw new Error("verwacht maand-pias");
    expect(["p1", "p2"]).toContain(pias.playerId);
    expect(pias.reden).toBe("bagel");
    expect(pias.periodeLabel).toBe("juni 2026");
  });

  it("geen maand-pias-event lang na het sluiten van de maand", () => {
    const feed = buildFeed({
      matches: [bagel],
      teams: TEAMS,
      friendships: [],
      myId: "p1",
      groups,
      groupMatchesByGroup: { g1: [bagel] },
      now: new Date("2026-07-28T12:00:00Z"),
    });
    expect(feed.some((e) => e.kind === "maand-pias")).toBe(false);
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
      feedDay({ kind: "friendship", at: "2026-07-09T12:34:00Z", a: "a", b: "b" }),
    ).toBe("2026-07-09");
  });
});

describe("feedPrivacyFilter", () => {
  const prof = (id: string, discoverable?: boolean): Profile =>
    ({ id, username: id, full_name: null, discoverable } as Profile);
  const vriendschap = (a: string, b: string): FeedEvent =>
    ({ kind: "friendship", at: "2026-07-01T12:00:00Z", a, b });
  const matchEvent: FeedEvent = {
    kind: "match",
    at: "2026-07-02T12:00:00Z",
    match: match("2026-07-02T12:00:00Z"),
    highlights: [],
    myDelta: null,
  };

  it("verbergt een vriendschap met een niet-vindbare speler", () => {
    const filter = feedPrivacyFilter({
      p1: prof("p1", true),
      p2: prof("p2", false),
    });
    expect(filter(vriendschap("p1", "p2"))).toBe(false);
  });

  it("laat vriendschappen door als beiden vindbaar zijn of het veld ontbreekt", () => {
    const filter = feedPrivacyFilter({
      p1: prof("p1", true),
      p2: prof("p2"), // discoverable ontbreekt → zichtbaar
    });
    expect(filter(vriendschap("p1", "p2"))).toBe(true);
  });

  it("raakt niet-vriendschapitems niet, ook niet van een niet-vindbare speler", () => {
    const filter = feedPrivacyFilter({ p1: prof("p1", false) });
    expect(filter(matchEvent)).toBe(true);
  });

  it("werkt als filter binnen buildFeed", () => {
    const feed = buildFeed({
      matches: [],
      teams: TEAMS,
      friendships: [friend("f1", "p2", "2026-07-01T12:00:00Z")],
      myId: "p1",
      profiles: { p1: prof("p1", true), p2: prof("p2", false) },
      filter: feedPrivacyFilter({ p1: prof("p1", true), p2: prof("p2", false) }),
    });
    expect(kinds(feed)).toEqual([]);
  });
});

describe("buildFeed — smoesjes (#296)", () => {
  const groups = [
    { id: "g1", name: "Vrijdagavond", created_at: "2026-07-01T10:00:00Z", created_by: "p1" },
  ];
  const smoes = (playerId: string, groupId: string) => ({
    match_id: "m-smoes",
    player_id: playerId,
    group_id: groupId,
    smoes: "Mijn gripje was te glad.",
    created_at: "2026-07-12T20:00:00Z",
  });

  it("emit een smoes-item met groepsnaam, speler, tekst en de verloren match", () => {
    const verloren = match("2026-07-12T19:30:00Z", "t-ab", "t-cd", "completed", {
      id: "m-smoes",
      winner_team_id: "t-cd",
      score_a: 3,
      score_b: 6,
    });
    const feed = buildFeed({
      matches: [verloren],
      teams: TEAMS,
      friendships: [],
      myId: "p1",
      groups,
      smoesjes: [smoes("p2", "g1")],
    });
    const ev = feed.find((e) => e.kind === "smoes");
    if (!ev || ev.kind !== "smoes") throw new Error("verwacht smoes-item");
    expect(ev.matchId).toBe("m-smoes");
    expect(ev.playerId).toBe("p2");
    expect(ev.groupName).toBe("Vrijdagavond");
    expect(ev.smoes).toContain("gripje");
    // De verloren match is meegekoppeld zodat de kaart de tegenstander toont.
    expect(ev.match?.id).toBe("m-smoes");
    expect(ev.match?.winner_team_id).toBe("t-cd");
  });

  it("negeert een smoes van een onbekende groep (geen groepsnaam)", () => {
    const feed = buildFeed({
      matches: [],
      teams: TEAMS,
      friendships: [],
      myId: "p1",
      groups,
      smoesjes: [smoes("p2", "g-onbekend")],
    });
    expect(kinds(feed).filter((k) => k === "smoes")).toEqual([]);
  });
});
