import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bookingUrl,
  coveredTimes,
  formatPrice,
  getClubAvailability,
  getWeekAvailability,
  searchClubs,
  utcToClubTime,
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
        ["16:30", [{ duration: 120, price: "€ 40" }]],
        ["18:30", [{ duration: 60, price: "€ 20" }, { duration: 90, price: "€ 30" }]],
      ]),
    );
    expect([...covered].sort()).toEqual([
      "16:30", "17:00", "17:30", "18:00", // 16:30 + 120 min
      "18:30", "19:00", "19:30", // 18:30 + 90 min
    ]);
  });

  it("laatste boekbare start voor sluiting dekt ook het slothalfuur", () => {
    const covered = coveredTimes(new Map([["22:00", [{ duration: 60, price: "€ 20" }]]]));
    expect([...covered].sort()).toEqual(["22:00", "22:30"]);
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

// De boekingslink gebruikt het tenant-id als slug; Playtomic stuurt door naar
// de canonieke clubpagina en behoudt daarbij de query.
describe("bookingUrl", () => {
  it("linkt naar de gekozen club, voorgevuld op de dag", () => {
    expect(bookingUrl("2026-07-04")).toBe(
      `https://playtomic.com/clubs/${DEFAULT_CLUB.id}?sport=PADEL&date=2026-07-04`,
    );
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
              address: { city: "Gent", timezone: "Europe/Brussels" },
            },
            { tenant_id: "t-2", tenant_name: "Padel Zonder Adres" },
          ],
        }) as Response,
    );
    vi.stubGlobal("fetch", fetchMock);

    const clubs = await searchClubs("padel");

    expect(clubs).toEqual([
      { id: "t-1", name: "Padel Gent", city: "Gent", timezone: "Europe/Brussels" },
      {
        id: "t-2",
        name: "Padel Zonder Adres",
        city: "",
        timezone: DEFAULT_CLUB.timezone,
      },
    ]);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/v1/tenants?");
    expect(url).toContain("tenant_name=padel");
    expect(url).toContain("sport_id=PADEL");
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
