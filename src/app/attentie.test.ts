import { describe, it, expect } from "vitest";
import { agendaAttentie, spelenAttentie } from "./attentie";
import type { OpenPollBundle } from "@/features/dashboard/dashboardHelpers";
import type { GroupSummary } from "@/features/groups/api";
import type { PlayPoll, PollOption, PollVote } from "@/features/groups/pollsApi";
import type { Match } from "@/types";

// De regels achter de stippen op de balk (#1214). Wat hier vastligt: een stip
// gaat over jóu — een poll waarop je al stemde is geen taak meer, en een
// speeldag waarvoor je "kan niet" zei ook niet.

const NU = Date.parse("2026-08-07T10:00:00.000Z");
const VANDAAG = "2026-08-07"; // clubdag in Europe/Brussels op dat moment

const groep = { id: "g1", name: "Vamos" } as unknown as GroupSummary;

function poll(over: Partial<PlayPoll> = {}): PlayPoll {
  return {
    id: "poll-1",
    group_id: "g1",
    created_by: "p2",
    status: "open",
    locked_option_id: null,
    created_at: "2026-08-01T10:00:00.000Z",
    locked_at: null,
    booked_at: null,
    club_id: "c1",
    club_name: "Club",
    club_city: null,
    club_timezone: "Europe/Brussels",
    access_code: null,
    courts: null,
    rounds_generated_at: null,
    ...over,
  } as PlayPoll;
}

function optie(over: Partial<PollOption> = {}): PollOption {
  return {
    id: "opt-1",
    poll_id: "poll-1",
    group_id: "g1",
    date: "2026-08-14",
    start_time: "20:00",
    duration: 90,
    courts_free: null,
    created_at: "2026-08-01T10:00:00.000Z",
    ...over,
  } as PollOption;
}

const stem = (over: Partial<PollVote> = {}): PollVote =>
  ({
    option_id: "opt-1",
    group_id: "g1",
    player_id: "p1",
    status: "yes",
    updated_at: "2026-08-02T10:00:00.000Z",
    ...over,
  }) as PollVote;

const bundel = (over: Partial<OpenPollBundle> = {}): OpenPollBundle => ({
  group: groep,
  polls: [poll()],
  options: [optie()],
  votes: [],
  ...over,
});

describe("agendaAttentie", () => {
  it("licht op bij een lopende poll waarop je nog niet stemde", () => {
    expect(agendaAttentie([bundel()], "p1", NU)).toBe(true);
  });

  it("dooft zodra je gestemd hebt — ook met 'kan niet'", () => {
    const gestemd = bundel({ votes: [stem({ status: "no" })] });
    expect(agendaAttentie([gestemd], "p1", NU)).toBe(false);
  });

  it("trekt zich niets aan van de stemmen van anderen", () => {
    const anderen = bundel({ votes: [stem({ player_id: "p2" })] });
    expect(agendaAttentie([anderen], "p1", NU)).toBe(true);
  });

  it("licht op voor een geboekte speeldag vandaag waarop je meespeelt", () => {
    const vandaag = bundel({
      polls: [poll({ status: "booked", locked_option_id: "opt-1" })],
      options: [optie({ date: VANDAAG })],
      votes: [stem()],
    });
    expect(agendaAttentie([vandaag], "p1", NU)).toBe(true);
  });

  it("laat een speeldag van vandaag met rust als je niet meespeelt", () => {
    const zonderMij = bundel({
      polls: [poll({ status: "booked", locked_option_id: "opt-1" })],
      options: [optie({ date: VANDAAG })],
      votes: [stem({ status: "no" })],
    });
    expect(agendaAttentie([zonderMij], "p1", NU)).toBe(false);
  });

  it("laat een speeldag op een andere dag met rust", () => {
    const later = bundel({
      polls: [poll({ status: "booked", locked_option_id: "opt-1" })],
      options: [optie({ date: "2026-08-14" })],
      votes: [stem()],
    });
    expect(agendaAttentie([later], "p1", NU)).toBe(false);
  });

  it("kijkt naar al je groepen, niet alleen de eerste", () => {
    const stil = bundel({ polls: [], options: [] });
    expect(agendaAttentie([stil, bundel()], "p1", NU)).toBe(true);
  });

  it("blijft stil zonder groepen", () => {
    expect(agendaAttentie([], "p1", NU)).toBe(false);
  });
});

describe("spelenAttentie", () => {
  const match = (over: Partial<Match>): Match =>
    ({
      id: "m1",
      team_a_id: "t-ab",
      team_b_id: "t-cd",
      status: "scheduled",
      winner_team_id: null,
      score_a: null,
      score_b: null,
      played_at: null,
      created_at: "2026-08-01T10:00:00.000Z",
      created_by: "p1",
      group_id: "g1",
      round_number: 1,
      format: "2v2",
      ...over,
    }) as Match;

  it("licht op zodra het uur van een openstaande match voorbij is", () => {
    expect(
      spelenAttentie([match({ played_at: "2026-08-07T09:00:00.000Z" })], NU),
    ).toBe(true);
  });

  it("blijft stil voor een match die nog moet komen", () => {
    // Anders staat de stip er permanent zodra er een ronde klaarstaat, en dan
    // zegt hij niets meer.
    expect(
      spelenAttentie([match({ played_at: "2026-08-08T19:00:00.000Z" })], NU),
    ).toBe(false);
  });

  it("blijft stil voor een match die al ingevuld is", () => {
    expect(
      spelenAttentie(
        [
          match({
            status: "completed",
            score_a: 6,
            score_b: 3,
            played_at: "2026-08-07T09:00:00.000Z",
          }),
        ],
        NU,
      ),
    ).toBe(false);
  });
});
