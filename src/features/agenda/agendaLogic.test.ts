import { describe, it, expect } from "vitest";
import {
  buildMarkers,
  filterOpGroepen,
  leesGroepKeuze,
  dagItems,
  dagLabel,
  daysInMonth,
  duurLabel,
  kannersOpDag,
  komendeItems,
  maandLabel,
  maandVan,
  markersByDay,
  metHoofdletter,
  monthGrid,
  ophaalVenster,
  schuifMaand,
  splitMarkers,
  statusChip,
  perMaand,
  telInMaand,
  telWedstrijden,
  verdeelWedstrijden,
  tijdenLabel,
  tijdvak,
  toetsStap,
  volgendeSpeeldagen,
  volgendeStap,
  wachtOpJou,
  wedstrijdDagen,
  windowFor,
  zelfdeDagAndereMaand,
  zelfdeMaand,
} from "./agendaLogic";
import type { AgendaMarker } from "./agendaLogic";
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

  // Sinds #1195 is het raster in elke maand even hoog. Stond dit niet vast, dan
  // sprong bij het bladeren alles eronder tot 84px op en neer.
  it("levert altijd zes rijen, twee jaar lang", () => {
    for (let i = 0; i < 24; i++) {
      const maand = { jaar: 2026 + Math.floor(i / 12), maand: (i % 12) + 1 };
      expect(monthGrid(maand)).toHaveLength(6);
    }
  });

  it("vult de kortst mogelijke maand aan met doorloopdagen", () => {
    // Februari 2021: 28 dagen die op een maandag beginnen — precies vier weken,
    // het enige geval dat van nature vier rijen oplevert.
    const weeks = monthGrid({ jaar: 2021, maand: 2 });
    expect(weeks).toHaveLength(6);
    expect(weeks[0][0].date).toBe("2021-02-01");
    expect(weeks[3][6].date).toBe("2021-02-28");
    // De twee rijen erna zijn maart, en dragen dat ook uit.
    expect(weeks[4][0]).toEqual({ date: "2021-03-01", inMonth: false });
    expect(weeks[5][6]).toEqual({ date: "2021-03-14", inMonth: false });
    expect(weeks.flat().filter((d) => d.inMonth)).toHaveLength(28);
  });

  it("laat het opgehaalde venster meelopen met de zesde rij", () => {
    // windowFor leest monthGrid, dus de fetch dekt vanzelf wat je ziet staan.
    const weeks = monthGrid({ jaar: 2021, maand: 2 });
    expect(windowFor({ jaar: 2021, maand: 2 })).toEqual({
      from: weeks[0][0].date,
      to: weeks[5][6].date,
    });
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

describe("ophaalVenster (#1112)", () => {
  it("loopt zes weken voorbij het raster", () => {
    // Het raster van augustus 2026 eindigt op 6 september; "Hierna" moet ook in
    // een lege maand nog iets kunnen wijzen, dus we halen verder op.
    expect(ophaalVenster({ jaar: 2026, maand: 8 })).toEqual({
      from: "2026-07-27",
      to: "2026-10-18",
    });
  });

  it("begint waar het raster begint", () => {
    // Achteruit is er geen staart: wat geweest is hoort niet in "Hierna", en
    // een dag vóór het raster is er nooit een om naartoe te springen.
    const m = { jaar: 2026, maand: 8 };
    expect(ophaalVenster(m).from).toBe(windowFor(m).from);
  });
});

describe("volgendeSpeeldagen (#1112)", () => {
  const m = (date: string, extra: Partial<AgendaMarker> = {}) =>
    ({ date, optionId: date, startTime: "20:00", groupName: "A", past: false, ...extra }) as AgendaMarker;

  it("geeft de eerstvolgende drie, op volgorde", () => {
    const uit = volgendeSpeeldagen(
      [m("2026-09-01"), m("2026-08-20"), m("2026-08-25"), m("2026-08-30")],
      "2026-08-10",
    );
    expect(uit.map((x) => x.date)).toEqual([
      "2026-08-20",
      "2026-08-25",
      "2026-08-30",
    ]);
  });

  it("laat de gekozen dag zelf weg", () => {
    // Die staat al in het paneel erboven; twee keer tonen leest als twee
    // verschillende afspraken.
    const uit = volgendeSpeeldagen([m("2026-08-10"), m("2026-08-20")], "2026-08-10");
    expect(uit.map((x) => x.date)).toEqual(["2026-08-20"]);
  });

  it("laat wat geweest is weg, ook als de datum later valt", () => {
    // `past` hangt aan de klok van de club, niet aan de kalender: een moment
    // van vanochtend heeft een datum die nog "vooruit" oogt.
    const uit = volgendeSpeeldagen(
      [m("2026-08-20", { past: true }), m("2026-08-25")],
      "2026-08-10",
    );
    expect(uit.map((x) => x.date)).toEqual(["2026-08-25"]);
  });

  it("sorteert twee speeldagen op dezelfde dag op tijd", () => {
    const uit = volgendeSpeeldagen(
      [
        m("2026-08-20", { optionId: "laat", startTime: "20:00" }),
        m("2026-08-20", { optionId: "vroeg", startTime: "11:00" }),
      ],
      "2026-08-10",
    );
    expect(uit.map((x) => x.optionId)).toEqual(["vroeg", "laat"]);
  });

  it("geeft een lege lijst als er niets meer komt", () => {
    expect(volgendeSpeeldagen([m("2026-08-01")], "2026-08-10")).toEqual([]);
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
  const inAug = (date: string, pollId = date) => ({ date, pollId }) as never;

  it("telt de speeldagen van de zichtbare maand", () => {
    const markers = [inAug("2026-08-03"), inAug("2026-08-08"), inAug("2026-08-11")];
    expect(telInMaand(markers, { jaar: 2026, maand: 8 })).toBe(3);
  });

  it("telt een poll met meerdere voorstellen als één activiteit", () => {
    // Drie kandidaat-momenten van dezelfde poll is één vraag om te spelen; het
    // raster toont ze los, de telling niet (#1182).
    const markers = [
      inAug("2026-08-03", "poll-1"),
      inAug("2026-08-05", "poll-1"),
      inAug("2026-08-08", "poll-1"),
      inAug("2026-08-11", "poll-2"),
    ];
    expect(telInMaand(markers, { jaar: 2026, maand: 8 })).toBe(2);
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

describe("wedstrijdDagen (#1182)", () => {
  const rij = (id: string, played_at: string | null, group_id = "g1") => ({
    id,
    group_id,
    played_at,
  });

  it("groepeert per dag en per groep", () => {
    const uit = wedstrijdDagen(
      [
        rij("m1", "2026-08-08T18:00:00Z"),
        rij("m2", "2026-08-08T19:00:00Z"),
        rij("m3", "2026-08-08T19:00:00Z", "g2"),
        rij("m4", "2026-08-09T10:00:00Z"),
      ],
      "Europe/Brussels",
    );
    expect(Object.keys(uit).sort()).toEqual(["2026-08-08", "2026-08-09"]);
    expect(uit["2026-08-08"]).toHaveLength(2);
    expect(uit["2026-08-08"][0].matches.map((m) => m.id)).toEqual(["m1", "m2"]);
    // Het tijdstip gaat mee (#1221): zonder dat valt een wedstrijd niet aan een
    // speeldagmoment te hangen.
    expect(uit["2026-08-08"][0].matches[0].atMs).toBe(
      Date.parse("2026-08-08T18:00:00Z"),
    );
    expect(telWedstrijden(uit["2026-08-08"])).toBe(3);
  });

  it("rekent de dag in clubtijd, niet in UTC", () => {
    // 22:30 UTC is in Brussel al de volgende dag — dezelfde les als #783.
    const uit = wedstrijdDagen([rij("m1", "2026-08-08T22:30:00Z")], "Europe/Brussels");
    expect(Object.keys(uit)).toEqual(["2026-08-09"]);
  });

  it("laat rijen zonder dag of groep vallen", () => {
    const uit = wedstrijdDagen(
      [rij("m1", null), { id: "m2", group_id: null, played_at: "2026-08-08T18:00:00Z" }],
      "Europe/Brussels",
    );
    expect(uit).toEqual({});
  });

  it("zet de wedstrijden in de naam van de dagknop", () => {
    // De ruit in de cel is decoratief; wat hij betekent hoort in de naam.
    expect(dagLabel("2026-08-08", [], true, 3)).toBe(
      "zaterdag 8 augustus, 3 wedstrijden gespeeld",
    );
    expect(dagLabel("2026-08-08", [], true, 0)).toBe(
      "zaterdag 8 augustus, niets gespeeld",
    );
  });
});

describe("komendeItems en wachtOpJou", () => {
  const komend = (overrides: Partial<AgendaMarker> = {}) =>
    ({
      pollId: "poll-1",
      optionId: `opt-${overrides.date ?? ""}-${overrides.startTime ?? ""}`,
      date: "2026-08-13",
      startTime: "20:00",
      duration: 90,
      status: "open",
      past: false,
      iVoted: false,
      myVote: null,
      groupName: "Vamos!",
      yesVoterIds: [],
      ...overrides,
    }) as AgendaMarker;

  it("zet de komende speeldagen op volgorde en houdt vandaag erbij", () => {
    const items = komendeItems(
      [
        komend({ date: "2026-09-01", pollId: "p3" }),
        komend({ date: "2026-08-07", pollId: "p1" }),
        komend({ date: "2026-08-20", pollId: "p2" }),
        // Geweest: hoort niet in een vooruitblik.
        komend({ date: "2026-08-05", pollId: "p0", past: true }),
      ],
      "2026-08-07",
    );
    expect(items.map((i) => i.eerste.date)).toEqual([
      "2026-08-07",
      "2026-08-20",
      "2026-09-01",
    ]);
  });

  it("groepeert per maand in de volgorde van de lijst", () => {
    const groepen = perMaand(
      komendeItems(
        [
          komend({ date: "2026-08-13", pollId: "p1" }),
          komend({ date: "2026-08-20", pollId: "p2" }),
          komend({ date: "2026-09-01", pollId: "p3" }),
        ],
        "2026-08-01",
      ),
    );
    expect(groepen).toHaveLength(2);
    expect(groepen[0].maand).toEqual({ jaar: 2026, maand: 8 });
    expect(groepen[0].items).toHaveLength(2);
    expect(groepen[1].maand).toEqual({ jaar: 2026, maand: 9 });
  });

  it("meldt alleen open polls waarop jij nog niets zei", () => {
    const vragen = wachtOpJou(
      [
        // Twee momenten van dezelfde onbeantwoorde poll: één vraag, en de
        // vroegste dag is waar je heen springt.
        komend({ pollId: "p1", date: "2026-08-20" }),
        komend({ pollId: "p1", date: "2026-08-13" }),
        // Beantwoord (poll-breed), dus geen vraag meer.
        komend({ pollId: "p2", date: "2026-08-14", iVoted: true }),
        // Al vastgelegd: daar valt niet meer op te stemmen.
        komend({ pollId: "p3", date: "2026-08-15", status: "booked" }),
      ],
      "2026-08-07",
    );
    expect(vragen).toEqual([
      { pollId: "p1", date: "2026-08-13", groupName: "Vamos!" },
    ]);
  });
});

describe("dagItems", () => {
  const moment = (pollId: string, startTime: string, extra = {}) =>
    ({ pollId, startTime, yesVoterIds: [], duration: 90, ...extra }) as never;

  it("bundelt de momenten van dezelfde poll tot één speeldag", () => {
    const items = dagItems([
      moment("poll-1", "20:00"),
      moment("poll-1", "21:30"),
      moment("poll-2", "10:00"),
    ]);
    expect(items).toHaveLength(2);
    expect(items[0].momenten).toHaveLength(2);
    expect(items[0].eerste.startTime).toBe("20:00");
    expect(items[1].eerste.startTime).toBe("10:00");
  });

  it("noemt de tijden als keuzes", () => {
    expect(tijdenLabel([moment("poll-1", "20:00")])).toBe("20:00");
    expect(
      tijdenLabel([moment("poll-1", "20:00"), moment("poll-1", "21:30")]),
    ).toBe("20:00 of 21:30");
    expect(
      tijdenLabel([
        moment("poll-1", "18:00"),
        moment("poll-1", "20:00"),
        moment("poll-1", "21:30"),
      ]),
    ).toBe("18:00, 20:00 of 21:30");
  });

  it("telt iedereen die op minstens één moment kan, en niemand dubbel", () => {
    const momenten = [
      moment("poll-1", "20:00", { yesVoterIds: ["a", "b"] }),
      moment("poll-1", "21:30", { yesVoterIds: ["b", "c"] }),
    ];
    expect(kannersOpDag(momenten)).toEqual(["a", "b", "c"]);
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

  it("neemt de bewaarde baantelling van het moment mee", () => {
    // Het dag-sheet zet die telling meteen neer en laat de live-telling hem
    // stil vervangen (#1233); zonder startwaarde kwam er een chipregel bij
    // nadat het sheet al openstond.
    const markers = buildMarkers(
      venster({
        polls: [poll()],
        options: [
          option({ id: "opt-1", courts_free: 4 }),
          option({ id: "opt-2", date: "2026-08-20", courts_free: null }),
        ],
      }),
      GROEPEN,
      "me",
      nu,
    );
    expect(markers.map((m) => m.courtsFree)).toEqual([4, null]);
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

/* ---- #1121: de agenda neemt het werk van de Plannen-tab over ---- */

function marker(overrides: Partial<AgendaMarker> = {}): AgendaMarker {
  return {
    pollId: "poll-1",
    optionId: "opt-1",
    groupId: "g1",
    groupName: "Vamos!",
    clubName: "Padel De Panne",
    clubId: "club-1",
    clubCity: "De Panne",
    clubTimezone: "Europe/Brussels",
    date: "2026-08-13",
    startTime: "20:00",
    duration: 90,
    status: "open",
    past: false,
    iVoted: false,
    myVote: null,
    voterCount: 0,
    yesVoterIds: [],
    maybeVoterIds: [],
    nietGestemdIds: [],
    courts: null,
    accessCode: null,
    courtsFree: null,
    changedAt: "2026-08-01T10:00:00Z",
    ...overrides,
  };
}

describe("volgendeStap (#1121)", () => {
  // Jouw eigen stem gaat vóór alles: dat is het enige waar jij iets aan kunt
  // doen, en het is de reden dat de Plannen-tab een next-action-zin had.
  it("vraagt eerst jouw stem, ook als de rest ook nog moet", () => {
    expect(
      volgendeStap(marker({ myVote: null, nietGestemdIds: ["p2", "p3"] })),
    ).toBe("Jij moet nog stemmen.");
  });

  it("wijst daarna naar wie er nog niets zei", () => {
    expect(volgendeStap(marker({ myVote: "yes", nietGestemdIds: ["p2"] }))).toBe(
      "Wacht op 1 lid van de groep.",
    );
  });

  it("meldt het als iedereen gestemd heeft", () => {
    expect(volgendeStap(marker({ myVote: "yes" }))).toBe(
      "Alle stemmen zijn binnen — het moment wordt gekozen.",
    );
  });

  it("stuurt een vastgelegde speeldag naar het boeken", () => {
    expect(volgendeStap(marker({ status: "locked" }))).toBe(
      "De baan moet nog geboekt worden.",
    );
  });

  it("telt bij een geboekte speeldag af naar vier spelers", () => {
    expect(
      volgendeStap(marker({ status: "booked", yesVoterIds: ["a", "b", "c"] })),
    ).toBe("Nog 1 bevestigde speler nodig voor wedstrijden.");
    expect(
      volgendeStap(
        marker({ status: "booked", yesVoterIds: ["a", "b", "c", "d"] }),
      ),
    ).toBe("Alles staat vast.");
  });

  // Een dag die geweest is wacht nergens meer op; daar hoort geen aansporing.
  it("zwijgt over een speeldag die geweest is", () => {
    expect(volgendeStap(marker({ status: "booked", past: true }))).toBeNull();
  });
});

describe("groepsfilter (#1121)", () => {
  const m1 = marker({ groupId: "g1" });
  const m2 = marker({ optionId: "opt-2", groupId: "g2" });

  it("laat alles staan zonder keuze", () => {
    expect(filterOpGroepen([m1, m2], [])).toEqual([m1, m2]);
  });

  it("houdt alleen de gekozen groepen over", () => {
    expect(filterOpGroepen([m1, m2], ["g2"])).toEqual([m2]);
  });

  // Zonder deze zeef zou een verlaten groep de agenda leeg houden, terwijl er
  // geen chip meer staat om hem uit te zetten.
  it("vergeet groepen die je intussen verliet", () => {
    expect(leesGroepKeuze("g1,weg", ["g1", "g2"])).toEqual(["g1"]);
    expect(leesGroepKeuze("weg", ["g1"])).toEqual([]);
    expect(leesGroepKeuze(null, ["g1"])).toEqual([]);
  });
});

describe("buildMarkers — twijfelaars en stille leden (#1121)", () => {
  it("splitst de stemmen uit en houdt over wie niets zei", () => {
    const groepen = [{ ...groep("g1", "Vamos!"), member_ids: ["p1", "p2", "p3", "p4"] }];
    const markers = buildMarkers(
      venster({
        polls: [poll()],
        options: [option()],
        votes: [vote("p1", "yes"), vote("p2", "maybe")],
      }),
      groepen,
      "p1",
      at("2026-08-01T10:00:00Z"),
    );

    expect(markers[0].yesVoterIds).toEqual(["p1"]);
    expect(markers[0].maybeVoterIds).toEqual(["p2"]);
    // p3 en p4 zeiden niets — dat is per poll, niet per moment.
    expect(markers[0].nietGestemdIds).toEqual(["p3", "p4"]);
  });
});

/* ---- #1221: wat bij een speeldag hoort, en wat los is ---- */

describe("verdeelWedstrijden (#1221)", () => {
  // 8 augustus 2026, clubtijd Europe/Brussels (UTC+2). De speeldag begint om
  // 20:00 clubtijd, dus om 18:00Z.
  const DAG = "2026-08-08";
  const speeldag = (over: Partial<AgendaMarker> = {}) =>
    marker({ date: DAG, startTime: "20:00", status: "booked", past: true, ...over });
  const wed = (id: string, iso: string) => ({ id, atMs: Date.parse(iso) });
  const dag = (matches: { id: string; atMs: number }[], groupId = "g1") => ({
    [DAG]: [{ date: DAG, groupId, matches }],
  });

  it("hangt de wedstrijden van die avond aan de speeldag", () => {
    const uit = verdeelWedstrijden(
      { [DAG]: [speeldag()] },
      dag([wed("m1", "2026-08-08T18:10:00Z"), wed("m2", "2026-08-08T19:00:00Z")]),
    );
    expect(uit.perPoll).toEqual({ "poll-1": 2 });
    // Niets meer over voor een eigen rij: dat was de verdubbeling.
    expect(uit.losPerDag).toEqual({});
  });

  it("laat wedstrijden zonder speeldag gewoon los staan", () => {
    const uit = verdeelWedstrijden({}, dag([wed("m1", "2026-08-08T18:10:00Z")]));
    expect(uit.perPoll).toEqual({});
    expect(uit.losPerDag[DAG][0].matches.map((m) => m.id)).toEqual(["m1"]);
  });

  it("telt een open poll niet als speeldag", () => {
    // Een vraag waar niets van kwam is geen avond om wedstrijden aan te hangen.
    const uit = verdeelWedstrijden(
      { [DAG]: [speeldag({ status: "open" })] },
      dag([wed("m1", "2026-08-08T18:10:00Z")]),
    );
    expect(uit.perPoll).toEqual({});
    expect(uit.losPerDag[DAG][0].matches.map((m) => m.id)).toEqual(["m1"]);
  });

  it("houdt een partij van 's middags buiten de speeldag van 's avonds", () => {
    // 12:00Z is 14:00 clubtijd: zes uur vóór het slot van 20:00, en dus geen
    // wedstrijd van die speeldag. Dít is waarvoor de losse rij bestaat.
    const uit = verdeelWedstrijden(
      { [DAG]: [speeldag()] },
      dag([wed("middag", "2026-08-08T12:00:00Z"), wed("avond", "2026-08-08T18:10:00Z")]),
    );
    expect(uit.perPoll).toEqual({ "poll-1": 1 });
    expect(uit.losPerDag[DAG][0].matches.map((m) => m.id)).toEqual(["middag"]);
  });

  it("verdeelt een ochtend- en een avondsessie over hun eigen poll", () => {
    const ochtend = speeldag({
      pollId: "poll-ochtend",
      optionId: "opt-ochtend",
      startTime: "10:00",
    });
    const avond = speeldag({ pollId: "poll-avond", optionId: "opt-avond" });
    const uit = verdeelWedstrijden(
      { [DAG]: [avond, ochtend] },
      dag([
        wed("o1", "2026-08-08T08:00:00Z"), // 10:00
        wed("o2", "2026-08-08T09:30:00Z"), // 11:30 — uitloop van de ochtend
        wed("a1", "2026-08-08T18:20:00Z"), // 20:20
      ]),
    );
    expect(uit.perPoll).toEqual({ "poll-ochtend": 2, "poll-avond": 1 });
    expect(uit.losPerDag).toEqual({});
  });

  it("houdt de groepen uit elkaar", () => {
    // De speeldag van g1 mag de losse partij van g2 niet opslokken.
    const uit = verdeelWedstrijden(
      { [DAG]: [speeldag()] },
      {
        [DAG]: [
          { date: DAG, groupId: "g1", matches: [wed("m1", "2026-08-08T18:10:00Z")] },
          { date: DAG, groupId: "g2", matches: [wed("m2", "2026-08-08T18:10:00Z")] },
        ],
      },
    );
    expect(uit.perPoll).toEqual({ "poll-1": 1 });
    expect(uit.losPerDag[DAG]).toHaveLength(1);
    expect(uit.losPerDag[DAG][0].groupId).toBe("g2");
  });
});
