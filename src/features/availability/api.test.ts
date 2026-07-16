import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Snapshot-leespad (#405) gemockt: standaard geen snapshot, zodat de
// bestaande tests het live pad blijven testen; per test overschrijfbaar.
vi.mock("./snapshotApi", () => ({
  getSnapshot: vi.fn(),
  getSnapshots: vi.fn(),
}));

import { getSnapshot, getSnapshots } from "./snapshotApi";
import {
  bestWeekMoment,
  bookingUrl,
  coveredTimes,
  fetchClub,
  formatPrice,
  getClubAvailability,
  getWeekAvailability,
  nextFreeSlot,
  perPersonPrice,
  PlaytomicUnavailableError,
  slotShareText,
  slotShareUrl,
  utcToClubTime,
  type CourtRow,
  type DayAvailability,
  type SlotOption,
  type WeekDay,
} from "./api";
import { DEFAULT_CLUB, manualClub, type Club } from "./club";

// Generieke testclub zonder KNOWN_COURTS-entry: zo komen de banen puur uit de
// availability-respons (genummerde labels), los van de thuisclub-snapshot.
const TEST_CLUB: Club = {
  id: "t-generic",
  name: "Testclub",
  city: "",
  timezone: "Europe/Brussels",
};

beforeEach(() => {
  vi.mocked(getSnapshot).mockReset().mockResolvedValue(null);
  vi.mocked(getSnapshots).mockReset().mockResolvedValue(new Map());
});

describe("getWeekAvailability — handmatige locatie (#322)", () => {
  it("levert lege dagen zonder Playtomic-verzoek", async () => {
    const week = await getWeekAvailability("2099-01-10", 3, manualClub("Eigen baan"));
    expect(week).toHaveLength(3);
    expect(week.every((d) => d.data === null && d.error === null)).toBe(true);
    expect(week.map((d) => d.date)).toEqual([
      "2099-01-10",
      "2099-01-11",
      "2099-01-12",
    ]);
  });
});

// Playtomic geeft start_time in UTC terug; het raster moet clubtijd tonen.
// De verschuiving is seizoensafhankelijk (CET/CEST), dus beide gevallen testen.
describe("utcToClubTime", () => {
  it("zomertijd: UTC+2 voor Europe/Brussels", () => {
    expect(utcToClubTime("2026-07-02", "18:30:00", "Europe/Brussels")).toBe("20:30");
  });

  it("wintertijd: UTC+1 voor Europe/Brussels", () => {
    expect(utcToClubTime("2026-01-15", "18:30:00", "Europe/Brussels")).toBe("19:30");
  });

  it("schuift over de dagsgrens mee (laat UTC-slot = vroege lokale ochtend)", () => {
    expect(utcToClubTime("2026-07-01", "22:30:00", "Europe/Brussels")).toBe("00:30");
  });
});

// Vrije vakken = start + langste duur, zodat de staart van een lang slot en
// het laatste halfuur voor sluiting niet als "geboekt" gerenderd worden.
describe("coveredTimes", () => {
  it("dekt elk slot tot start + langste duur", () => {
    const covered = coveredTimes(
      new Map([
        ["16:30", [{ duration: 120, price: "€ 40", perPerson: "€ 10" }]],
        [
          "18:30",
          [
            { duration: 60, price: "€ 20", perPerson: "€ 5" },
            { duration: 90, price: "€ 30", perPerson: "€ 7,50" },
          ],
        ],
      ]),
    );
    expect([...covered].sort()).toEqual([
      "16:30", "17:00", "17:30", "18:00", // 16:30 + 120 min
      "18:30", "19:00", "19:30", // 18:30 + 90 min
    ]);
  });

  it("laatste boekbare start voor sluiting dekt ook het slothalfuur", () => {
    const covered = coveredTimes(
      new Map([["22:00", [{ duration: 60, price: "€ 20", perPerson: "€ 5" }]]]),
    );
    expect([...covered].sort()).toEqual(["22:00", "22:30"]);
  });
});

// Testhulpjes voor de samenvattingsregels: een baan met vrije starttijden
// (elk met een lijst duren) en een dag met die banen.
const row = (id: string, free: [string, number[]][]): CourtRow => ({
  court: { id, name: `Terrein ${id}`, type: "roofed" },
  free: new Map(
    free.map(([t, durations]): [string, SlotOption[]] => [
      t,
      durations.map((duration) => ({ duration, price: "€ 20", perPerson: "€ 5" })),
    ]),
  ),
});
const day = (...courts: CourtRow[]): DayAvailability => ({
  open: "09:00",
  close: "22:00",
  timeZone: "Europe/Brussels",
  courts,
  source: "live",
  fetchedAt: null,
});

// Samenvatting boven het raster: vroegste boekbare start, met dezelfde
// "voorbij"-grens als het raster (start ≤ nu telt vandaag niet meer mee).
describe("nextFreeSlot", () => {
  it("duurfilter: alleen starttijden met een optie van die duur tellen", () => {
    const data = day(row("1", [["10:00", [60]], ["14:00", [60, 90]]]));
    expect(nextFreeSlot(data, null, null)?.time).toBe("10:00");
    expect(nextFreeSlot(data, 90, null)?.time).toBe("14:00");
    expect(nextFreeSlot(data, 120, null)).toBeNull();
  });

  it("vandaag: starttijden op of vóór nu zijn voorbij; andere dag telt alles", () => {
    const data = day(row("1", [["10:00", [60]], ["14:00", [60]]]));
    // 10:00 is exact nu → al voorbij (zelfde grens als het raster).
    expect(nextFreeSlot(data, null, 600)?.time).toBe("14:00");
    expect(nextFreeSlot(data, null, null)?.time).toBe("10:00");
  });

  it("niets (meer) vrij: null", () => {
    expect(nextFreeSlot(day(row("1", [])), null, null)).toBeNull();
    expect(nextFreeSlot(day(row("1", [["10:00", [60]]])), null, 630)).toBeNull();
  });

  it("meerdere banen vrij op dezelfde vroegste tijd: allemaal terug", () => {
    const data = day(
      row("1", [["12:00", [60]]]),
      row("2", [["10:00", [60]]]),
      row("3", [["10:00", [60]]]),
    );
    const next = nextFreeSlot(data, null, null);
    expect(next?.time).toBe("10:00");
    expect(next?.courts.map((c) => c.name)).toEqual(["Terrein 2", "Terrein 3"]);
  });
});

// Samenvatting boven het weekraster: het moment met de meeste tegelijk vrije
// banen, met dezelfde duur- en "voorbij"-regels als nextFreeSlot.
// Verre datums (2099): zodra een fixture-datum "vandaag" wordt, filtert de
// nu-grens ochtendtijden weg en wordt de test datumafhankelijk flaky.
describe("bestWeekMoment", () => {
  const weekDay = (date: string, data: DayAvailability | null, error: string | null = null): WeekDay =>
    ({ date, data, error: data ? null : (error ?? "mislukt") });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("het moment met de meeste banen tegelijk vrij wint, ook op een latere dag", () => {
    const week = [
      weekDay(
        "2099-07-10",
        day(row("1", [["10:00", [60]]]), row("2", [["10:00", [60]]])),
      ),
      weekDay(
        "2099-07-11",
        day(
          row("1", [["14:00", [60]]]),
          row("2", [["14:00", [60]]]),
          row("3", [["14:00", [60]]]),
        ),
      ),
    ];
    expect(bestWeekMoment(week, null)).toEqual({
      date: "2099-07-11",
      time: "14:00",
      count: 3,
    });
  });

  it("gelijke stand: de eerste dag wint, en binnen een dag de vroegste tijd", () => {
    // Beide tijden op de eerste dag tellen 2 banen; 18:00 komt als eerste in
    // de Map, maar 10:00 is vroeger op de klok.
    const week = [
      weekDay(
        "2099-07-10",
        day(
          row("1", [["18:00", [60]], ["10:00", [60]]]),
          row("2", [["18:00", [60]], ["10:00", [60]]]),
        ),
      ),
      weekDay(
        "2099-07-11",
        day(row("1", [["09:00", [60]]]), row("2", [["09:00", [60]]])),
      ),
    ];
    expect(bestWeekMoment(week, null)).toEqual({
      date: "2099-07-10",
      time: "10:00",
      count: 2,
    });
  });

  it("duurfilter: alleen starttijden met een optie van die duur tellen", () => {
    const week = [
      weekDay(
        "2099-07-10",
        day(
          row("1", [["10:00", [60]], ["14:00", [60, 90]]]),
          row("2", [["10:00", [60]], ["14:00", [90]]]),
        ),
      ),
    ];
    // Zonder filter wint 10:00 (vroegste van twee gelijke standen)…
    expect(bestWeekMoment(week, null)).toEqual({
      date: "2099-07-10",
      time: "10:00",
      count: 2,
    });
    // …met 90-minutenfilter blijft alleen 14:00 over, en met 120 niets.
    expect(bestWeekMoment(week, 90)).toEqual({
      date: "2099-07-10",
      time: "14:00",
      count: 2,
    });
    expect(bestWeekMoment(week, 120)).toBeNull();
  });

  it("vandaag (in clubtijd) tellen starttijden op of vóór nu niet mee", () => {
    // 10:00 UTC = 12:00 in Brussel op 6 juli 2026 (zomertijd).
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-06T10:00:00Z"));
    const week = [
      weekDay(
        "2026-07-06",
        day(
          // 10:00 is voorbij en 12:00 is exact nu → alleen 14:00 telt nog,
          // ook al waren er eerder méér banen tegelijk vrij.
          row("1", [["10:00", [60]], ["12:00", [60]], ["14:00", [60]]]),
          row("2", [["10:00", [60]], ["12:00", [60]]]),
        ),
      ),
    ];
    expect(bestWeekMoment(week, null)).toEqual({
      date: "2026-07-06",
      time: "14:00",
      count: 1,
    });
  });

  it("foutdagen en dagen zonder vrije sloten worden overgeslagen", () => {
    const week = [
      weekDay("2099-07-10", null, "Kon de beschikbaarheid niet laden (status 500)."),
      weekDay("2099-07-11", day(row("1", []))),
      weekDay("2099-07-12", day(row("1", [["11:00", [60]]]))),
    ];
    expect(bestWeekMoment(week, null)).toEqual({
      date: "2099-07-12",
      time: "11:00",
      count: 1,
    });
    // Helemaal niets bruikbaars → null (regel weglaten).
    expect(bestWeekMoment(week.slice(0, 2), null)).toBeNull();
  });
});

describe("formatPrice", () => {
  it("hele bedragen zonder centen", () => {
    const p = formatPrice("20 EUR");
    expect(p).toContain("20");
    expect(p).not.toContain(",");
  });

  it("centen blijven staan", () => {
    expect(formatPrice("23.33 EUR")).toContain("23,33");
  });

  it("onherkenbare invoer gaat onaangeroerd door", () => {
    expect(formatPrice("op aanvraag")).toBe("op aanvraag");
  });
});

// Padel speel je met vier: de baanprijs gedeeld door 4, zelfde weergaveregels
// als formatPrice (hele euro's zonder centen, anders 2 decimalen).
describe("perPersonPrice", () => {
  it("deelbaar bedrag: hele euro's zonder centen", () => {
    const p = perPersonPrice("20 EUR");
    expect(p).toContain("5");
    expect(p).not.toContain(",");
  });

  it("niet-deelbaar bedrag: 2 decimalen", () => {
    expect(perPersonPrice("30 EUR")).toContain("7,50");
    expect(perPersonPrice("23.33 EUR")).toContain("5,83");
  });

  it("niet-numerieke prijs → null (geen p.p. tonen)", () => {
    expect(perPersonPrice("op aanvraag")).toBeNull();
  });
});

// De boekingslink resolvet de club-slug via de proxy en bouwt daarmee de
// canonieke clubpagina-URL, voorgevuld op de dag.
describe("bookingUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("bouwt de slug-URL met sport en dag", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>(
      async () =>
        ({ ok: true, status: 200, json: async () => ({ slug: "lago-club-padel-beveren" }) }) as Response,
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(bookingUrl({ ...TEST_CLUB, id: "t-book-1" }, "2026-07-04")).resolves.toBe(
      "https://playtomic.com/clubs/lago-club-padel-beveren?sport=PADEL&date=2026-07-04",
    );
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/playtomic/club-slug/t-book-1");
  });

  it("valt terug op playtomic.io/clubs/{id} als de slug niet resolvt", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }) as Response),
    );

    await expect(bookingUrl({ ...TEST_CLUB, id: "t-book-2" }, "2026-07-04")).resolves.toBe(
      "https://playtomic.io/clubs/t-book-2",
    );
  });
});

// De deeltekst en -link voor een vrij slot in de groepschat.
describe("slotShareText", () => {
  it("bouwt de tekst met tijden, dag en clubnaam", () => {
    expect(
      slotShareText(
        { court: "Terrein 3", start: "20:30", end: "21:30" },
        "2026-07-03",
        "LAGO CLUB Padel Beveren",
      ),
    ).toBe(
      "Terrein 3 vrij van 20:30 tot 21:30 op vr 3 juli bij LAGO CLUB Padel Beveren",
    );
  });
});

describe("slotShareUrl", () => {
  it("bouwt een absolute link naar /banen met datum en club-id", () => {
    expect(slotShareUrl("2026-07-03", "t-1")).toBe(
      `${window.location.origin}/banen?datum=2026-07-03&club=t-1`,
    );
  });
});

// Ontvangende kant van een gedeelde link: club-id → Club via de slug-route.
// Er is geen clubdetail-endpoint meer (#385); de naam volgt uit de slug.
describe("fetchClub", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("leidt de clubnaam af uit de slug", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          ({ ok: true, status: 200, json: async () => ({ slug: "padel-aalst-centrum" }) }) as Response,
      ),
    );

    await expect(fetchClub("t-aalst")).resolves.toEqual({
      id: "t-aalst",
      name: "Padel Aalst Centrum",
      city: "",
      timezone: DEFAULT_CLUB.timezone,
    });
  });

  it("faalt op een onbekend id (geen slug)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }) as Response),
    );

    await expect(fetchClub("t-onbekend")).rejects.toThrow("Onbekende club");
  });
});

// getJson (via getClubAvailability) vertaalt upstream-status naar een
// begrijpelijke melding i.p.v. een kale statuscode.
describe("getJson foutmeldingen", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const stubStatus = (status: number) =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status, json: async () => ({}) }) as Response),
    );

  it("403 → blokkade-melding", async () => {
    stubStatus(403);
    await expect(getClubAvailability("2026-07-02", TEST_CLUB)).rejects.toThrow(/blokkeert/i);
  });

  it("404 → niet-gevonden-melding", async () => {
    stubStatus(404);
    await expect(getClubAvailability("2026-07-02", TEST_CLUB)).rejects.toThrow(/niet \(meer\) gevonden/i);
  });

  it("429 → te-veel-verzoeken-melding", async () => {
    stubStatus(429);
    await expect(getClubAvailability("2026-07-02", TEST_CLUB)).rejects.toThrow(/te veel verzoeken/i);
  });

  it("500 → storing-melding", async () => {
    stubStatus(500);
    await expect(getClubAvailability("2026-07-02", TEST_CLUB)).rejects.toThrow(/storing/i);
  });

  it("netwerkfout → offline-melding", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await expect(getClubAvailability("2026-07-02", TEST_CLUB)).rejects.toThrow(/geen verbinding/i);
  });
});

describe("getClubAvailability", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const mockFetch = (availability: unknown) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => availability }) as Response),
    );
  };

  it("stuurt tenant_id/date/sport_id, zonder user_id of local_start_min", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>(
      async () => ({ ok: true, status: 200, json: async () => [] }) as Response,
    );
    vi.stubGlobal("fetch", fetchMock);

    await getClubAvailability("2026-07-02", TEST_CLUB);

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/api/clubs/availability?");
    expect(url).toContain("tenant_id=t-generic");
    expect(url).toContain("date=2026-07-02");
    expect(url).toContain("sport_id=PADEL");
    expect(url).not.toContain("user_id");
    expect(url).not.toContain("local_start_min");
  });

  it("zet UTC-slottijden om naar clubtijd, met duren en prijzen per start", async () => {
    mockFetch([
      {
        resource_id: "court-1",
        start_date: "2026-07-02",
        slots: [
          // Zelfde starttijd, verschillende duren: één vrije kloktijd met
          // beide opties (oplopend gesorteerd, ook al komt 90 eerst binnen).
          { start_time: "14:00:00", duration: 90, price: "30 EUR" },
          { start_time: "14:00:00", duration: 60, price: "20 EUR" },
          { start_time: "18:30:00", duration: 60, price: "20 EUR" },
        ],
      },
    ]);

    const day = await getClubAvailability("2026-07-02", TEST_CLUB);

    // Geen openingsuren-bron meer: basis-as 08:00–23:00 (slots vallen erbinnen).
    expect(day.open).toBe("08:00");
    expect(day.close).toBe("23:00");
    expect(day.timeZone).toBe("Europe/Brussels");
    expect(day.courts).toHaveLength(1);
    // Onbekende club → genummerd label, geen type.
    expect(day.courts[0].court.name).toBe("Terrein 1");
    expect(day.courts[0].court.type).toBe("");
    const free = day.courts[0].free;
    expect([...free.keys()].sort()).toEqual(["16:00", "20:30"]);
    expect(free.get("16:00")?.map((o) => o.duration)).toEqual([60, 90]);
    expect(free.get("16:00")?.[0].price).toBe(formatPrice("20 EUR"));
    expect(free.get("16:00")?.[0].perPerson).toBe(perPersonPrice("20 EUR"));
    expect(free.get("20:30")?.map((o) => o.duration)).toEqual([60]);
  });

  it("weekoverzicht: één mislukte dag blokkeert de rest niet", async () => {
    const mockRes = (body: unknown, ok = true, status = 200) =>
      ({ ok, status, json: async () => body }) as Response;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("2026-07-02")) {
          return mockRes([
            {
              resource_id: "court-1",
              start_date: "2026-07-02",
              slots: [{ start_time: "14:00:00", duration: 60, price: "20 EUR" }],
            },
          ]);
        }
        return mockRes(null, false, 500);
      }),
    );

    const week = await getWeekAvailability("2026-07-02", 2, TEST_CLUB);

    expect(week).toHaveLength(2);
    expect(week[0].date).toBe("2026-07-02");
    expect([...(week[0].data?.courts[0].free.keys() ?? [])]).toEqual(["16:00"]);
    expect(week[1].date).toBe("2026-07-03");
    expect(week[1].data).toBeNull();
    expect(week[1].error).toContain("storing");
  });

  it("rekt de tijd-as op als slots buiten 08:00–23:00 vallen", async () => {
    mockFetch([
      {
        resource_id: "court-1",
        start_date: "2026-07-02",
        slots: [
          // 05:30 UTC = 07:30 lokaal (vóór basis-open 08:00);
          // 19:30 UTC = 21:30 lokaal + 120 min = 23:30 (na basis-sluit 23:00).
          { start_time: "05:30:00", duration: 60, price: "15 EUR" },
          { start_time: "19:30:00", duration: 120, price: "40 EUR" },
        ],
      },
    ]);

    const day = await getClubAvailability("2026-07-02", TEST_CLUB);

    expect(day.open).toBe("07:30");
    expect(day.close).toBe("23:30");
  });

  it("gebruikt de snapshot-baannamen en -types voor de thuisclub", async () => {
    mockFetch([
      {
        resource_id: "cc9dbe76-6192-4035-a24c-f3db0d556b97",
        start_date: "2026-07-02",
        slots: [{ start_time: "14:00:00", duration: 60, price: "20 EUR" }],
      },
    ]);

    const day = await getClubAvailability("2026-07-02", DEFAULT_CLUB);

    // Alle drie de bekende banen als rij (ook de lege), in snapshot-volgorde.
    expect(day.courts.map((c) => c.court.name)).toEqual([
      "Terrein 1",
      "Terrein 2",
      "Terrein 3",
    ]);
    const buiten = day.courts.find((c) => c.court.type === "outdoor");
    expect(buiten?.court.name).toBe("Terrein 3");
    expect(buiten?.free.has("16:00")).toBe(true);
  });
});

// Snapshot-leespad (#405): de thuisclub leest eerst de cron-snapshot uit
// Postgres; live is de fallback, en een verouderde snapshot is het vangnet
// wanneer Playtomic zelf onbereikbaar is.
describe("getClubAvailability — cron-snapshots (#405)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const RAW = [
    {
      // Terrein 1 van de thuisclub (knownCourts.ts): zo staat het slot op de
      // eerste baanrij en test de assertie de volledige transformatie.
      resource_id: "81ba479c-66f6-4568-a450-db6df2f5c589",
      start_date: "2026-07-02",
      slots: [{ start_time: "14:00:00", duration: 60, price: "20 EUR" }],
    },
  ];
  const verse = () => ({ payload: RAW, fetchedAt: new Date().toISOString() });
  const verouderd = () => ({
    payload: RAW,
    // Ruim voorbij de versheidsdrempel van 90 minuten.
    fetchedAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
  });

  const stubFetch = (body: unknown, ok = true, status = 200) => {
    const fetchMock = vi.fn(
      async () => ({ ok, status, json: async () => body }) as Response,
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  };

  it("verse snapshot: geen upstream-call, zelfde transformatie als live", async () => {
    const snapshot = verse();
    vi.mocked(getSnapshot).mockResolvedValue(snapshot);
    const fetchMock = stubFetch([]);

    const day = await getClubAvailability("2026-07-02", DEFAULT_CLUB);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(day.source).toBe("snapshot");
    expect(day.fetchedAt).toBe(snapshot.fetchedAt);
    // 14:00 UTC = 16:00 clubtijd (zomertijd): de live transformatie geldt ook hier.
    expect(day.courts[0].free.has("16:00")).toBe(true);
  });

  it("verouderde snapshot + live succes: live wint", async () => {
    vi.mocked(getSnapshot).mockResolvedValue(verouderd());
    const fetchMock = stubFetch(RAW);

    const day = await getClubAvailability("2026-07-02", DEFAULT_CLUB);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(day.source).toBe("live");
    expect(day.fetchedAt).toBeNull();
  });

  it("verouderde snapshot + live 403: snapshot als vangnet, geen fout", async () => {
    const snapshot = verouderd();
    vi.mocked(getSnapshot).mockResolvedValue(snapshot);
    stubFetch({}, false, 403);

    const day = await getClubAvailability("2026-07-02", DEFAULT_CLUB);

    expect(day.source).toBe("snapshot");
    expect(day.fetchedAt).toBe(snapshot.fetchedAt);
    expect(day.courts[0].free.has("16:00")).toBe(true);
  });

  it("geen snapshot + live 403: PlaytomicUnavailableError met status", async () => {
    stubFetch({}, false, 403);

    const err = await getClubAvailability("2026-07-02", DEFAULT_CLUB).catch(
      (e: unknown) => e,
    );

    expect(err).toBeInstanceOf(PlaytomicUnavailableError);
    expect((err as PlaytomicUnavailableError).status).toBe(403);
  });

  it("onbruikbare payload (geen array): gewoon het live pad", async () => {
    vi.mocked(getSnapshot).mockResolvedValue({
      payload: { kapot: true },
      fetchedAt: new Date().toISOString(),
    });
    const fetchMock = stubFetch(RAW);

    const day = await getClubAvailability("2026-07-02", DEFAULT_CLUB);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(day.source).toBe("live");
  });

  it("andere club dan de thuisclub: snapshot-tabel wordt niet geraadpleegd", async () => {
    stubFetch([]);

    await getClubAvailability("2026-07-02", TEST_CLUB);
    await getWeekAvailability("2026-07-02", 2, TEST_CLUB);

    expect(vi.mocked(getSnapshot)).not.toHaveBeenCalled();
    expect(vi.mocked(getSnapshots)).not.toHaveBeenCalled();
  });

  it("weekoverzicht: mix van verse, verouderde en ontbrekende snapshots", async () => {
    // 02: verse snapshot; 03: verouderde snapshot; 04: niets. Live = 403.
    vi.mocked(getSnapshots).mockResolvedValue(
      new Map([
        ["2026-07-02", verse()],
        ["2026-07-03", verouderd()],
      ]),
    );
    const fetchMock = stubFetch({}, false, 403);

    const week = await getWeekAvailability("2026-07-02", 3, DEFAULT_CLUB);

    expect(vi.mocked(getSnapshots)).toHaveBeenCalledWith(DEFAULT_CLUB.id, "2026-07-02", 3);
    // Alleen 03 en 04 proberen live; 02 was vers.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(week[0].data?.source).toBe("snapshot");
    expect(week[0].error).toBeNull();
    // Verouderd vangnet voor 03: data i.p.v. fout.
    expect(week[1].data?.source).toBe("snapshot");
    expect(week[1].error).toBeNull();
    // Zonder vangnet blijft de dag een nette fout (blokkeert de rest niet).
    expect(week[2].data).toBeNull();
    expect(week[2].error).toMatch(/blokkeert/i);
  });
});
