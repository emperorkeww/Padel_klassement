import { describe, it, expect } from "vitest";
import {
  buildMarkers,
  dagLabel,
  daysInMonth,
  maandVan,
  markersByDay,
  monthGrid,
  schuifMaand,
  splitMarkers,
  weekVan,
  windowFor,
} from "./agendaLogic";
import type { GroupSummary } from "@/features/groups/api";
import type {
  PlayPoll,
  PollOption,
  PollVote,
  PollWindow,
} from "@/features/groups/pollsApi";

function poll(overrides: Partial<PlayPoll> = {}): PlayPoll {
  return {
    id: "poll-1",
    group_id: "g1",
    created_by: "p1",
    status: "open",
    locked_option_id: null,
    created_at: "2026-08-01T10:00:00Z",
    locked_at: null,
    booked_at: null,
    club_id: "91d8d419-3736-498e-90be-362de786d588",
    club_name: "Padel De Panne",
    club_city: "De Panne",
    club_timezone: "Europe/Brussels",
    access_code: null,
    courts: null,
    rounds_generated_at: null,
    ...overrides,
  };
}

function option(overrides: Partial<PollOption> = {}): PollOption {
  return {
    id: "opt-1",
    poll_id: "poll-1",
    group_id: "g1",
    date: "2026-08-13",
    start_time: "20:00",
    duration: 90,
    courts_free: 2,
    created_at: "2026-08-01T10:00:00Z",
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
    updated_at: "2026-08-01T10:00:00Z",
  };
}

function groep(id: string, name: string): GroupSummary {
  return {
    id,
    name,
    created_by: "p1",
    created_at: "2026-01-01T00:00:00Z",
    member_ids: [],
  };
}

const GROEPEN = [groep("g1", "Vamos!"), groep("g2", "Kantoorpadel")];
const at = (iso: string) => new Date(iso).getTime();

function venster(o: Partial<PollWindow>): PollWindow {
  return { polls: [], options: [], votes: [], ...o };
}

describe("monthGrid", () => {
  it("begint op maandag en vult hele weken", () => {
    // Augustus 2026 begint op een zaterdag en eindigt op een maandag.
    const weeks = monthGrid({ jaar: 2026, maand: 8 });
    expect(weeks[0][0].date).toBe("2026-07-27");
    expect(weeks[0][0].inMonth).toBe(false);
    expect(weeks[0][5].date).toBe("2026-08-01");
    expect(weeks[0][5].inMonth).toBe(true);
    expect(weeks[weeks.length - 1][6].date).toBe("2026-09-06");
    for (const week of weeks) expect(week).toHaveLength(7);
  });

  it("houdt februari van een schrikkeljaar heel", () => {
    const weeks = monthGrid({ jaar: 2028, maand: 2 });
    const dagen = weeks.flat().filter((d) => d.inMonth);
    expect(dagen).toHaveLength(29);
    expect(dagen[28].date).toBe("2028-02-29");
  });

  it("kantelt niet op de DST-omschakelingen", () => {
    // Laatste zondag van maart (vooruit) en van oktober (terug).
    for (const maand of [3, 10]) {
      const dagen = monthGrid({ jaar: 2026, maand }).flat().filter((d) => d.inMonth);
      expect(dagen).toHaveLength(31);
      expect(new Set(dagen.map((d) => d.date)).size).toBe(31);
      expect(dagen[0].date).toBe(`2026-${String(maand).padStart(2, "0")}-01`);
    }
  });

  it("telt de dagen per maand", () => {
    expect(daysInMonth({ jaar: 2026, maand: 2 })).toBe(28);
    expect(daysInMonth({ jaar: 2028, maand: 2 })).toBe(29);
    expect(daysInMonth({ jaar: 2026, maand: 12 })).toBe(31);
  });
});

describe("maandvenster", () => {
  it("dekt ook de rand-dagen van het raster", () => {
    expect(windowFor({ jaar: 2026, maand: 8 })).toEqual({
      from: "2026-07-27",
      to: "2026-09-06",
    });
  });

  it("schuift over de jaarwissel heen", () => {
    expect(schuifMaand({ jaar: 2026, maand: 12 }, 1)).toEqual({
      jaar: 2027,
      maand: 1,
    });
    expect(schuifMaand({ jaar: 2026, maand: 1 }, -1)).toEqual({
      jaar: 2025,
      maand: 12,
    });
    expect(schuifMaand({ jaar: 2026, maand: 8 }, 0)).toEqual({
      jaar: 2026,
      maand: 8,
    });
  });

  it("leest de maand uit een datum", () => {
    expect(maandVan("2026-08-13")).toEqual({ jaar: 2026, maand: 8 });
  });

  it("geeft de week van maandag tot zondag", () => {
    expect(weekVan("2026-08-13")).toEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
      "2026-08-15",
      "2026-08-16",
    ]);
    // Een zondag hoort bij de wéék die eraan voorafgaat, niet aan de volgende.
    expect(weekVan("2026-08-16")[0]).toBe("2026-08-10");
  });
});

describe("buildMarkers", () => {
  const nu = at("2026-08-07T09:00:00Z");

  it("levert bij een geboekte poll alleen het gekozen moment", () => {
    const gekozen = option({ id: "opt-2", date: "2026-08-13" });
    const afgevallen = option({ id: "opt-3", date: "2026-08-14" });
    const markers = buildMarkers(
      venster({
        polls: [poll({ status: "booked", locked_option_id: "opt-2", courts: "3 & 4", access_code: "4821" })],
        options: [gekozen, afgevallen],
      }),
      GROEPEN,
      "me",
      nu,
    );
    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({
      date: "2026-08-13",
      status: "booked",
      groupName: "Vamos!",
      clubName: "Padel De Panne",
      courts: "3 & 4",
      accessCode: "4821",
      past: false,
    });
  });

  it("levert bij een open poll elk kandidaat-moment", () => {
    const markers = buildMarkers(
      venster({
        polls: [poll()],
        options: [
          option({ id: "opt-1", date: "2026-08-18", start_time: "19:00" }),
          option({ id: "opt-2", date: "2026-08-20", start_time: "20:00" }),
        ],
      }),
      GROEPEN,
      "me",
      nu,
    );
    expect(markers.map((m) => m.date)).toEqual(["2026-08-18", "2026-08-20"]);
    expect(markers.every((m) => m.status === "open")).toBe(true);
  });

  it("laat geannuleerde polls weg", () => {
    const markers = buildMarkers(
      venster({ polls: [poll({ status: "cancelled" })], options: [option()] }),
      GROEPEN,
      "me",
      nu,
    );
    expect(markers).toEqual([]);
  });

  it("houdt een gespeelde speeldag, maar niet een verlopen open moment", () => {
    const verleden = option({ id: "opt-1", date: "2026-08-06", start_time: "20:00" });
    const gespeeld = buildMarkers(
      venster({
        polls: [poll({ status: "booked", locked_option_id: "opt-1" })],
        options: [verleden],
      }),
      GROEPEN,
      "me",
      nu,
    );
    expect(gespeeld).toHaveLength(1);
    expect(gespeeld[0].past).toBe(true);

    const dodeVraag = buildMarkers(
      venster({ polls: [poll()], options: [verleden] }),
      GROEPEN,
      "me",
      nu,
    );
    expect(dodeVraag).toEqual([]);
  });

  it("bepaalt 'geweest' in de tijdzone van díe club (#783)", () => {
    // 2026-08-07 08:30 UTC. Hetzelfde slot "09:00, een uur": in Brussel
    // (zomertijd UTC+2) liep dat van 07:00 tot 08:00 UTC en is het dus voorbij;
    // op de Canarische Eilanden (UTC+1) loopt het nog tot 09:00 UTC.
    const moment = at("2026-08-07T08:30:00Z");
    const vroeg = option({ id: "opt-1", date: "2026-08-07", start_time: "09:00", duration: 60 });
    const brussel = buildMarkers(
      venster({
        polls: [poll({ status: "booked", locked_option_id: "opt-1" })],
        options: [vroeg],
      }),
      GROEPEN,
      "me",
      moment,
    );
    const canarisch = buildMarkers(
      venster({
        polls: [
          poll({
            status: "booked",
            locked_option_id: "opt-1",
            club_timezone: "Atlantic/Canary",
          }),
        ],
        options: [vroeg],
      }),
      GROEPEN,
      "me",
      moment,
    );
    expect(brussel[0].past).toBe(true);
    expect(canarisch[0].past).toBe(false);
  });

  it("telt stemmen per poll en 'ik kan' per moment", () => {
    const markers = buildMarkers(
      venster({
        polls: [poll()],
        options: [option({ id: "opt-1" }), option({ id: "opt-2", date: "2026-08-20" })],
        votes: [
          vote("me", "yes", "opt-1"),
          vote("p2", "yes", "opt-1"),
          vote("p3", "no", "opt-1"),
          vote("p3", "yes", "opt-2"),
        ],
      }),
      GROEPEN,
      "me",
      nu,
    );
    expect(markers[0].yesVoterIds.sort()).toEqual(["me", "p2"]);
    // Drie spelers raakten deze poll aan, ook wie "nee" stemde.
    expect(markers[0].voterCount).toBe(3);
    expect(markers[0].iVoted).toBe(true);
    // "Ik stemde" is een eigenschap van de poll, niet van dit ene moment.
    expect(markers[1].iVoted).toBe(true);
    expect(markers[1].yesVoterIds).toEqual(["p3"]);
  });

  it("negeert een moment waarvan de poll buiten het venster viel", () => {
    const markers = buildMarkers(
      venster({ polls: [], options: [option()] }),
      GROEPEN,
      "me",
      nu,
    );
    expect(markers).toEqual([]);
  });
});

describe("markersByDay", () => {
  it("groepeert per dag en sorteert op tijd", () => {
    const nu = at("2026-08-07T09:00:00Z");
    const markers = buildMarkers(
      venster({
        polls: [poll(), poll({ id: "poll-2", group_id: "g2" })],
        options: [
          option({ id: "opt-1", date: "2026-08-20", start_time: "20:00" }),
          option({ id: "opt-2", date: "2026-08-20", start_time: "18:30", poll_id: "poll-2" }),
          option({ id: "opt-3", date: "2026-08-21", start_time: "21:00" }),
        ],
      }),
      GROEPEN,
      "me",
      nu,
    );
    const perDag = markersByDay(markers);
    expect(perDag["2026-08-20"].map((m) => m.startTime)).toEqual(["18:30", "20:00"]);
    expect(perDag["2026-08-20"][0].groupName).toBe("Kantoorpadel");
    expect(perDag["2026-08-21"]).toHaveLength(1);
  });
});

describe("dagLabel", () => {
  const nu = at("2026-08-07T09:00:00Z");
  const markerVoor = (o: Partial<PollOption>, p: Partial<PlayPoll> = {}) =>
    buildMarkers(
      venster({ polls: [poll(p)], options: [option(o)] }),
      GROEPEN,
      "me",
      nu,
    );

  it("noemt een lege dag met zijn uitnodiging", () => {
    expect(dagLabel("2026-08-26", [])).toBe(
      "woensdag 26 augustus, niets gepland, plan een speeldag",
    );
  });

  it("zet de status in woorden, niet alleen in een vorm", () => {
    const geboekt = markerVoor({}, { status: "booked", locked_option_id: "opt-1" });
    expect(dagLabel("2026-08-13", geboekt)).toBe(
      "donderdag 13 augustus, speeldag geboekt om 20:00, Vamos!, Padel De Panne",
    );
    const vastgelegd = markerVoor({}, { status: "locked", locked_option_id: "opt-1" });
    expect(dagLabel("2026-08-13", vastgelegd)).toContain("speeldag vastgelegd om 20:00");
    expect(dagLabel("2026-08-13", markerVoor({}))).toContain("speeldag open poll om 20:00");
  });

  it("somt meerdere speeldagen op één dag op", () => {
    const markers = buildMarkers(
      venster({
        polls: [poll(), poll({ id: "poll-2", group_id: "g2" })],
        options: [
          option({ id: "opt-1", start_time: "20:00" }),
          option({ id: "opt-2", start_time: "18:30", poll_id: "poll-2" }),
        ],
      }),
      GROEPEN,
      "me",
      nu,
    );
    const label = dagLabel("2026-08-13", markersByDay(markers)["2026-08-13"]);
    expect(label).toContain("2 speeldagen");
    expect(label).toContain("Kantoorpadel");
    expect(label).toContain("Vamos!");
  });
});

describe("splitMarkers", () => {
  const fake = (n: number) => Array.from({ length: n }, () => ({}) as never);

  it("toont alles zolang het past", () => {
    expect(splitMarkers(fake(2), 2)).toEqual({ shown: fake(2), extra: 0 });
  });

  it("kondigt precies aan wat het verbergt", () => {
    const { shown, extra } = splitMarkers(fake(5), 2);
    expect(shown).toHaveLength(2);
    expect(extra).toBe(3);
  });
});
