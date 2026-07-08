import { describe, it, expect } from "vitest";
import {
  freeStartTimes,
  weekHeatmap,
  bestHeatMoment,
  freeBlocks,
  dayShareText,
  weekShareText,
} from "./availabilityShare";
import type { CourtRow, DayAvailability, SlotOption, WeekDay } from "./api";
import { toMinutes } from "../../lib/time";

// Bouwt een baanrij: { "18:00": [60, 90] } = vrij om 18:00 voor 60 én 90 min.
function court(name: string, free: Record<string, number[]>): CourtRow {
  const map = new Map<string, SlotOption[]>();
  for (const [t, durations] of Object.entries(free)) {
    const options: SlotOption[] = durations.map((d) => ({
      duration: d,
      price: "20 EUR",
      perPerson: "€ 5",
    }));
    map.set(t, options);
  }
  return { court: { id: name, name, type: "" }, free: map };
}

function day(courts: CourtRow[]): DayAvailability {
  return { open: "08:00", close: "23:00", timeZone: "Europe/Brussels", courts };
}

// Verre datum zodat "vandaag" nooit meespeelt (deterministisch).
const FUTURE = "2099-07-03"; // een vrijdag

const sample = day([
  court("Terrein 1", { "18:00": [60, 90], "20:00": [60] }),
  court("Terrein 2", { "20:00": [90] }),
]);

describe("freeStartTimes", () => {
  it("groepeert per starttijd de vrije banen én speelduren, oplopend op tijd", () => {
    expect(freeStartTimes(sample, null, null)).toEqual([
      { time: "18:00", courts: ["Terrein 1"], durations: [60, 90] },
      { time: "20:00", courts: ["Terrein 1", "Terrein 2"], durations: [60, 90] },
    ]);
  });

  it("past het duurfilter toe (alleen banen met dat product)", () => {
    // 90 min: 18:00 kan op Terrein 1, om 20:00 alleen Terrein 2 (T1 heeft er 60).
    expect(freeStartTimes(sample, 90, null)).toEqual([
      { time: "18:00", courts: ["Terrein 1"], durations: [60, 90] },
      { time: "20:00", courts: ["Terrein 2"], durations: [90] },
    ]);
  });

  it("laat starttijden ≤ nu weg (voorbij)", () => {
    expect(freeStartTimes(sample, null, toMinutes("18:00"))).toEqual([
      { time: "20:00", courts: ["Terrein 1", "Terrein 2"], durations: [60, 90] },
    ]);
  });
});

describe("weekHeatmap", () => {
  const week: WeekDay[] = [
    { date: FUTURE, data: sample, error: null },
    { date: "2099-07-04", data: day([court("Terrein 1", {})]), error: null },
    { date: "2099-07-05", data: null, error: "Kon niet laden" },
  ];

  it("telt de vrije banen per starttijd en bouwt de gedeelde tijd-as", () => {
    const heat = weekHeatmap(week, null);
    expect(heat.times).toEqual(["18:00", "20:00"]);
    expect(heat.days[0].counts).toEqual({ "18:00": 1, "20:00": 2 });
    expect(heat.days[1].counts).toEqual({});
    expect(heat.days[1].error).toBeNull();
    expect(heat.days[2].error).toBe("Kon niet laden");
  });

  it("bestHeatMoment vindt het drukste moment van de week", () => {
    expect(bestHeatMoment(weekHeatmap(week, null))).toEqual({
      date: FUTURE,
      time: "20:00",
      count: 2,
    });
    expect(bestHeatMoment(weekHeatmap([week[2]], null))).toBeNull();
  });
});

describe("freeBlocks", () => {
  it("voegt aaneengesloten halfuren samen tot blokken met het baanbereik", () => {
    // 18:00–19:00 aaneengesloten (2,3,4 banen), gaatje, dan 20:00–20:30 (2,1).
    const blocks = freeBlocks({
      "18:00": 2,
      "18:30": 3,
      "19:00": 4,
      "20:00": 2,
      "20:30": 1,
    });
    expect(blocks).toEqual([
      { start: "18:00", end: "19:00", min: 2, max: 4 },
      { start: "20:00", end: "20:30", min: 1, max: 2 },
    ]);
  });

  it("een los halfuur is een blok met start === end", () => {
    expect(freeBlocks({ "20:00": 3 })).toEqual([
      { start: "20:00", end: "20:00", min: 3, max: 3 },
    ]);
    expect(freeBlocks({})).toEqual([]);
  });
});

describe("dayShareText", () => {
  const links = {
    clubName: "LAGO Padel",
    bookingUrl: "https://book",
    viewUrl: "https://view/dag",
  };

  it("zet per starttijd de banen + links, met datum en duur in de kop", () => {
    const text = dayShareText(sample, FUTURE, 90, null, links);
    const expectedDay = new Intl.DateTimeFormat("nl-BE", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date(`${FUTURE}T12:00:00`));

    expect(text).toContain("🎾 Baanbeschikbaarheid — LAGO Padel");
    expect(text).toContain(`📅 ${expectedDay} · 90 min`);
    expect(text).toContain("18:00  Terrein 1 · 60/90 min");
    expect(text).toContain("20:00  Terrein 2 · 90 min");
    expect(text).toContain("Reserveren: https://book");
    expect(text).toContain("Bekijk: https://view/dag");
    // Niet "vandaag": geen "vanaf nu".
    expect(text).not.toContain("vanaf nu");
  });

  it("toont een lege-melding en 'vanaf nu' wanneer alles voorbij is (vandaag)", () => {
    const text = dayShareText(sample, FUTURE, null, toMinutes("23:00"), links);
    expect(text).toContain("vanaf nu");
    expect(text).toContain("Vandaag niets meer vrij.");
  });
});

describe("weekShareText", () => {
  it("toont per dag alle vrije momenten met baanaantallen + het drukste moment", () => {
    const week: WeekDay[] = [
      { date: FUTURE, data: sample, error: null },
      { date: "2099-07-04", data: day([court("Terrein 1", {})]), error: null },
      { date: "2099-07-05", data: null, error: "boem" },
    ];
    const text = weekShareText(week, null, {
      clubName: "LAGO Padel",
      viewUrl: "https://view/week",
    });
    expect(text).toContain("🎾 Weekoverzicht — LAGO Padel");
    // Dag met data: kopregel + per tijd de banen (kort) met speelduren.
    expect(text).toContain("2 momenten vrij");
    expect(text).toContain("18:00  T1 · 60/90 min");
    expect(text).toContain("20:00  T1, T2 · 60/90 min");
    expect(text).toContain("niets vrij");
    expect(text).toContain("geen gegevens");
    // Drukste moment van de week + legenda + link.
    expect(text).toContain("💡 Meeste banen tegelijk:");
    expect(text).toContain("om 20:00 (2 banen)");
    expect(text).toContain("Tn = terrein n");
    expect(text).toContain("Bekijk: https://view/week");
  });
});
