import { describe, it, expect } from "vitest";
import { openPollShareText } from "./pollShareText";
import type { PollOption, PollVote } from "./pollsApi";

function option(overrides: Partial<PollOption> = {}): PollOption {
  return {
    id: "opt-1",
    poll_id: "poll-1",
    group_id: "g1",
    date: "2026-07-10",
    start_time: "20:00",
    duration: 90,
    courts_free: 2,
    created_at: "2026-07-08T10:00:00Z",
    ...overrides,
  };
}

function vote(
  playerId: string,
  status: PollVote["status"],
  optionId = "opt-1",
): PollVote {
  return {
    option_id: optionId,
    group_id: "g1",
    player_id: playerId,
    status,
    updated_at: "2026-07-08T10:00:00Z",
  };
}

const NAMEN: Record<string, string> = { p1: "Remco", p2: "Jan", p3: "Piet" };
const naam = (id: string) => NAMEN[id] ?? id;

function tekst(overrides: Partial<Parameters<typeof openPollShareText>[0]> = {}) {
  return openPollShareText({
    groepsnaam: "De Padelvrienden",
    clubnaam: "LAGO CLUB Padel Beveren",
    options: [option()],
    votes: [],
    memberIds: ["p1", "p2"],
    naam,
    today: "2026-07-08",
    ...overrides,
  });
}

describe("openPollShareText", () => {
  it("noemt de groep, de momenten met hun stand en de club", () => {
    const out = tekst({
      options: [
        option({ id: "opt-1", date: "2026-07-10" }),
        option({ id: "opt-2", date: "2026-07-12" }),
      ],
      votes: [vote("p1", "yes"), vote("p2", "yes"), vote("p1", "no", "opt-2")],
    });
    expect(out).toContain("🎾 Padel — De Padelvrienden");
    expect(out).toContain("🗳 Stem mee — 2 momenten:");
    expect(out).toContain("2 kunnen");
    // Een moment zonder ja-stemmen leest als een uitnodiging, niet als "0".
    expect(out).toContain("nog geen ja");
    expect(out).toContain("📍 LAGO CLUB Padel Beveren");
  });

  it("schrijft één ja-stem in het enkelvoud", () => {
    expect(tekst({ votes: [vote("p1", "yes")] })).toContain("1 kan");
  });

  it("noemt wie nog niet gestemd heeft", () => {
    const out = tekst({
      memberIds: ["p1", "p2", "p3"],
      votes: [vote("p1", "yes")],
    });
    expect(out).toContain("⏳ Nog niet gestemd: Jan, Piet");
  });

  it("meldt het als iedereen gestemd heeft", () => {
    const out = tekst({ votes: [vote("p1", "yes"), vote("p2", "no")] });
    expect(out).toContain("✅ Iedereen heeft gestemd");
    expect(out).not.toContain("Nog niet gestemd");
  });

  it("kapt lange lijsten af en telt de rest", () => {
    const out = tekst({
      options: [
        option({ id: "o1", date: "2026-07-10" }),
        option({ id: "o2", date: "2026-07-11" }),
        option({ id: "o3", date: "2026-07-12" }),
        option({ id: "o4", date: "2026-07-13" }),
        option({ id: "o5", date: "2026-07-14" }),
      ],
    });
    expect(out).toContain("🗳 Stem mee — 5 momenten:");
    expect(out).toContain("• … en nog 1 moment");
    expect(out).not.toContain("14 jul");
  });

  it("laat verlopen momenten weg — daar kun je niet meer op stemmen", () => {
    const out = tekst({
      options: [
        option({ id: "oud", date: "2026-07-01" }),
        option({ id: "nieuw", date: "2026-07-10" }),
      ],
      today: "2026-07-08",
    });
    expect(out).toContain("🗳 Stem mee — 1 moment:");
    expect(out).not.toContain("1 jul");
  });

  it("zegt het netjes als er niets meer te stemmen valt", () => {
    const out = tekst({
      options: [option({ date: "2026-07-01" })],
      today: "2026-07-08",
    });
    expect(out).toContain("verlopen");
    expect(out).toContain("📍 LAGO CLUB Padel Beveren");
    expect(out).not.toContain("Nog niet gestemd");
  });

  it("sorteert de momenten op datum en tijd", () => {
    const out = tekst({
      options: [
        option({ id: "b", date: "2026-07-12", start_time: "20:00" }),
        option({ id: "a", date: "2026-07-10", start_time: "21:00" }),
        option({ id: "c", date: "2026-07-10", start_time: "19:00" }),
      ],
    });
    const regels = out.split("\n").filter((r) => r.startsWith("• "));
    expect(regels).toHaveLength(3);
    expect(regels[0]).toContain("19:00");
    expect(regels[1]).toContain("21:00");
    expect(regels[2]).toContain("12 jul");
  });
});
