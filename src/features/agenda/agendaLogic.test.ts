import { describe, it, expect } from "vitest";
import {
  buildMarkers,
  dagLabel,
  daysInMonth,
  duurLabel,
  maandLabel,
  maandVan,
  markersByDay,
  metHoofdletter,
  monthGrid,
  schuifMaand,
  splitMarkers,
  statusChip,
  telInMaand,
  tijdvak,
  toetsStap,
  windowFor,
  zelfdeDagAndereMaand,
  zelfdeMaand,
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

});

describe("labels van het dagpaneel (#1112)", () => {
  it("zet alleen de eerste letter groot", () => {
    // `text-transform: capitalize` maakte hier "Zondag 9 Augustus" van, en van
    // de statuschip "Open Poll". In het Nederlands blijft dat tweede woord klein.
    expect(metHoofdletter("zondag 9 augustus")).toBe("Zondag 9 augustus");
    expect(metHoofdletter("augustus 2026")).toBe("Augustus 2026");
    expect(metHoofdletter("")).toBe("");
  });

  it("geeft het statuswoord voor een chip", () => {
    expect(statusChip("booked")).toBe("Geboekt");
    expect(statusChip("locked")).toBe("Vastgelegd");
    expect(statusChip("open")).toBe("Open poll");
    expect(statusChip("booked", true)).toBe("Gespeeld");
  });

  it("leest hele uren als uren en de rest als minuten", () => {
    expect(duurLabel(90)).toBe("90 min");
    expect(duurLabel(60)).toBe("1 uur");
    expect(duurLabel(120)).toBe("2 uur");
    // Niet "1,5 uur": dat is precies de omrekening die je niet wil maken.
    expect(duurLabel(45)).toBe("45 min");
  });
});

describe("telInMaand", () => {
  const inAug = (date: string) => ({ date }) as never;

  it("telt de speeldagen van de zichtbare maand", () => {
    const markers = [inAug("2026-08-03"), inAug("2026-08-08"), inAug("2026-08-08")];
    expect(telInMaand(markers, { jaar: 2026, maand: 8 })).toBe(3);
  });

  it("telt de randdagen van de buurmaanden niet mee", () => {
    // Het raster van augustus 2026 begint op 27 juli en eindigt op 6 september;
    // die dagen tonen hun markers wel, maar horen niet in "deze maand".
    const markers = [inAug("2026-07-27"), inAug("2026-08-08"), inAug("2026-09-06")];
    expect(telInMaand(markers, { jaar: 2026, maand: 8 })).toBe(1);
  });

  it("verwart een maand niet met dezelfde maand in een ander jaar", () => {
    expect(telInMaand([inAug("2025-08-08")], { jaar: 2026, maand: 8 })).toBe(0);
  });
});

describe("toetsStap", () => {
  it("loopt met de pijltjes per dag en per week", () => {
    expect(toetsStap("2026-08-13", "ArrowLeft")).toBe("2026-08-12");
    expect(toetsStap("2026-08-13", "ArrowRight")).toBe("2026-08-14");
    expect(toetsStap("2026-08-13", "ArrowUp")).toBe("2026-08-06");
    expect(toetsStap("2026-08-13", "ArrowDown")).toBe("2026-08-20");
  });

  it("springt met Home/End naar de rand van de week", () => {
    expect(toetsStap("2026-08-13", "Home")).toBe("2026-08-10");
    expect(toetsStap("2026-08-13", "End")).toBe("2026-08-16");
    // Op de randen zelf blijft de dag staan.
    expect(toetsStap("2026-08-10", "Home")).toBe("2026-08-10");
    expect(toetsStap("2026-08-16", "End")).toBe("2026-08-16");
  });

  it("stapt met PageUp/PageDown een maand, en kapt af op een kortere", () => {
    expect(toetsStap("2026-08-13", "PageUp")).toBe("2026-07-13");
    expect(toetsStap("2026-08-13", "PageDown")).toBe("2026-09-13");
    expect(zelfdeDagAndereMaand("2026-03-31", 1)).toBe("2026-04-30");
    expect(zelfdeDagAndereMaand("2026-03-30", -1)).toBe("2026-02-28");
  });

  it("laat onbekende toetsen met rust", () => {
    expect(toetsStap("2026-08-13", "Enter")).toBeNull();
    expect(toetsStap("2026-08-13", "a")).toBeNull();
    expect(toetsStap("2026-08-13", "Tab")).toBeNull();
  });

  it("loopt over een maand- en jaargrens heen", () => {
    expect(toetsStap("2026-08-31", "ArrowRight")).toBe("2026-09-01");
    expect(toetsStap("2026-12-31", "ArrowDown")).toBe("2027-01-07");
  });
});

describe("labels", () => {
  it("noemt de maand voluit", () => {
    expect(maandLabel({ jaar: 2026, maand: 8 })).toBe("augustus 2026");
    expect(zelfdeMaand({ jaar: 2026, maand: 8 }, maandVan("2026-08-31"))).toBe(true);
    expect(zelfdeMaand({ jaar: 2026, maand: 8 }, maandVan("2026-09-01"))).toBe(false);
  });

  it("rekent het tijdvak uit, ook over middernacht", () => {
    expect(tijdvak("20:00", 90)).toBe("20:00 — 21:30");
    expect(tijdvak("23:00", 120)).toBe("23:00 — 01:00");
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

  it("draagt mijn eigen stem per moment, los van iVoted (#1104)", () => {
    const markers = buildMarkers(
      venster({
        polls: [poll()],
        options: [
          option({ id: "opt-1" }),
          option({ id: "opt-2", date: "2026-08-20" }),
          option({ id: "opt-3", date: "2026-08-21" }),
        ],
        votes: [
          vote("me", "yes", "opt-1"),
          vote("me", "maybe", "opt-2"),
          // Op opt-3 zei ik niets; iemand anders wel.
          vote("p2", "yes", "opt-3"),
        ],
      }),
      GROEPEN,
      "me",
      nu,
    );
    expect(markers.map((m) => m.myVote)).toEqual(["yes", "maybe", null]);
    // Deze poll raakte ik aan, dus iVoted staat overal aan — juist daarom is
    // myVote nodig om te weten wélk moment nog open staat.
    expect(markers.every((m) => m.iVoted)).toBe(true);
  });

  it("laat de stem van iemand anders niet als de mijne tellen", () => {
    const markers = buildMarkers(
      venster({
        polls: [poll()],
        options: [option({ id: "opt-1" })],
        votes: [vote("p2", "yes", "opt-1"), vote("p3", "no", "opt-1")],
      }),
      GROEPEN,
      "me",
      nu,
    );
    expect(markers[0].myVote).toBeNull();
    expect(markers[0].iVoted).toBe(false);
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

  it("zegt bij een open poll of jij al stemde (#1104)", () => {
    const stil = markerVoor({});
    expect(dagLabel("2026-08-13", stil)).toContain("jij stemde nog niet");
    const gestemd = buildMarkers(
      venster({
        polls: [poll()],
        options: [option()],
        votes: [vote("me", "maybe", "opt-1")],
      }),
      GROEPEN,
      "me",
      nu,
    );
    expect(dagLabel("2026-08-13", gestemd)).toContain("jij stemde al");
    // Een geboekte dag vraagt niets van je; daar hoort de zin niet.
    const geboekt = markerVoor({}, { status: "booked", locked_option_id: "opt-1" });
    expect(dagLabel("2026-08-13", geboekt)).not.toContain("jij stemde");
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
