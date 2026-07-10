import { afterEach, describe, expect, it, vi } from "vitest";
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
  searchClubs,
  slotShareText,
  slotShareUrl,
  utcToClubTime,
  type CourtRow,
  type DayAvailability,
  type SlotOption,
  type WeekDay,
} from "./api";
import { DEFAULT_CLUB } from "./club";

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

// De boekingslink gebruikt het tenant-id als slug; Playtomic stuurt door naar
// de canonieke clubpagina en behoudt daarbij de query.
describe("bookingUrl", () => {
  it("linkt naar de gekozen club, voorgevuld op de dag", () => {
    expect(bookingUrl("2026-07-04")).toBe(
      `https://playtomic.com/clubs/${DEFAULT_CLUB.id}?sport=PADEL&date=2026-07-04`,
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

// Ontvangende kant van een gedeelde link: club-id → Club via het
// tenant-detail-endpoint.
describe("fetchClub", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mapt het tenant-detail naar een club", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          ({
            ok: true,
            status: 200,
            json: async () => ({
              tenant_name: "Padel Aalst",
              address: { city: "Aalst", timezone: "Europe/Brussels" },
            }),
          }) as Response,
      ),
    );

    await expect(fetchClub("t-aalst")).resolves.toEqual({
      id: "t-aalst",
      name: "Padel Aalst",
      city: "Aalst",
      timezone: "Europe/Brussels",
    });
  });

  it("valt terug op de standaardtijdzone en een lege stad", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          ({
            ok: true,
            status: 200,
            json: async () => ({ tenant_name: "Padel Zonder Adres" }),
          }) as Response,
      ),
    );

    await expect(fetchClub("t-kaal")).resolves.toEqual({
      id: "t-kaal",
      name: "Padel Zonder Adres",
      city: "",
      timezone: DEFAULT_CLUB.timezone,
    });
  });

  it("faalt op een onbekend id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }) as Response),
    );

    await expect(fetchClub("t-onbekend")).rejects.toThrow("404");
  });

  it("faalt als het detail geen clubnaam bevat", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }) as Response),
    );

    await expect(fetchClub("t-leeg")).rejects.toThrow("Onbekende club");
  });
});

describe("searchClubs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mapt de tenant-respons naar clubs, met fallback voor stad en tijdzone", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => [
            {
              tenant_id: "t-1",
              tenant_name: "Padel Gent",
              address: { city: "Gent", timezone: "Europe/Brussels", country_code: "BE" },
            },
            {
              tenant_id: "t-2",
              tenant_name: "Padel Zonder Stad",
              address: { country_code: "BE" },
            },
          ],
        }) as Response,
    );
    vi.stubGlobal("fetch", fetchMock);

    const clubs = await searchClubs("padel");

    expect(clubs).toEqual([
      { id: "t-1", name: "Padel Gent", city: "Gent", timezone: "Europe/Brussels" },
      {
        id: "t-2",
        name: "Padel Zonder Stad",
        city: "",
        timezone: DEFAULT_CLUB.timezone,
      },
    ]);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/v1/tenants?");
    expect(url).toContain("tenant_name=padel");
    expect(url).toContain("sport_id=PADEL");
    // Server-side landfilter: anders verdringen buitenlandse naamgenoten de
    // Belgische clubs uit de kleine top-10 ("padel" → nul BE-resultaten).
    expect(url).toContain("country_code=BE");
  });

  // Vangnet bovenop de serverfilter, mocht de ongedocumenteerde parameter wegvallen.
  it("houdt alleen Belgische clubs over; zonder country_code ook weggefilterd (liever te streng dan buitenlandse ruis)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          ({
            ok: true,
            status: 200,
            json: async () => [
              {
                tenant_id: "t-be",
                tenant_name: "Padel Gent",
                address: { city: "Gent", country_code: "BE" },
              },
              {
                tenant_id: "t-it",
                tenant_name: "Padel Genta",
                address: { city: "Genova", country_code: "IT" },
              },
              { tenant_id: "t-x", tenant_name: "Padel Zonder Land" },
            ],
          }) as Response,
      ),
    );

    const clubs = await searchClubs("gent");

    expect(clubs.map((c) => c.id)).toEqual(["t-be"]);
  });
});

describe("getClubAvailability", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const tenant = {
    address: { timezone: "Europe/Brussels" },
    // 2026-07-02 is een donderdag; afwijkende uren zodat de weekdag-lookup
    // aantoonbaar gebruikt wordt (de fallback is 08:00–23:00).
    opening_hours: { THURSDAY: { opening_time: "09:00", closing_time: "22:00" } },
    resources: [
      {
        resource_id: "court-1",
        name: "Terrein 1",
        properties: { resource_type: "roofed" },
      },
    ],
  };

  const mockFetch = (availability: unknown) => {
    const mockRes = (body: unknown) =>
      ({ ok: true, status: 200, json: async () => body }) as Response;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).includes("/v1/tenants/")
          ? mockRes(tenant)
          : mockRes(availability),
      ),
    );
  };

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

    const day = await getClubAvailability("2026-07-02");

    expect(day.open).toBe("09:00");
    expect(day.close).toBe("22:00");
    expect(day.timeZone).toBe("Europe/Brussels");
    expect(day.courts).toHaveLength(1);
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
        if (url.includes("/v1/tenants/")) return mockRes(tenant);
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

    const week = await getWeekAvailability("2026-07-02", 2);

    expect(week).toHaveLength(2);
    expect(week[0].date).toBe("2026-07-02");
    expect([...(week[0].data?.courts[0].free.keys() ?? [])]).toEqual(["16:00"]);
    expect(week[1].date).toBe("2026-07-03");
    expect(week[1].data).toBeNull();
    expect(week[1].error).toContain("500");
  });

  it("rekt de tijd-as op als slots buiten de openingsuren vallen", async () => {
    mockFetch([
      {
        resource_id: "court-1",
        start_date: "2026-07-02",
        slots: [
          // 06:30 UTC = 08:30 lokaal (vóór open 09:00);
          // 19:30 UTC = 21:30 lokaal + 120 min = 23:30 (na sluit 22:00).
          { start_time: "06:30:00", duration: 60, price: "15 EUR" },
          { start_time: "19:30:00", duration: 120, price: "40 EUR" },
        ],
      },
    ]);

    const day = await getClubAvailability("2026-07-02");

    expect(day.open).toBe("08:30");
    expect(day.close).toBe("23:30");
  });
});
