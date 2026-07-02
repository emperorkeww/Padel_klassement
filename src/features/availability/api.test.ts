import { afterEach, describe, expect, it, vi } from "vitest";
import { coveredTimes, getClubAvailability, utcToClubTime } from "./api";

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
        ["16:30", [120]],
        ["18:30", [60, 90]],
      ]),
    );
    expect([...covered].sort()).toEqual([
      "16:30", "17:00", "17:30", "18:00", // 16:30 + 120 min
      "18:30", "19:00", "19:30", // 18:30 + 90 min
    ]);
  });

  it("laatste boekbare start voor sluiting dekt ook het slothalfuur", () => {
    const covered = coveredTimes(new Map([["22:00", [60]]]));
    expect([...covered].sort()).toEqual(["22:00", "22:30"]);
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
  const availability = [
    {
      resource_id: "court-1",
      start_date: "2026-07-02",
      slots: [
        // Zelfde starttijd, verschillende duren: één vrije kloktijd met
        // beide duren (oplopend gesorteerd, ook al komt 90 eerst binnen).
        { start_time: "14:00:00", duration: 90, price: "30 EUR" },
        { start_time: "14:00:00", duration: 60, price: "20 EUR" },
        { start_time: "18:30:00", duration: 60, price: "20 EUR" },
      ],
    },
  ];

  it("zet UTC-slottijden om naar clubtijd, met duren per starttijd", async () => {
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

    const day = await getClubAvailability("2026-07-02");

    expect(day.open).toBe("09:00");
    expect(day.close).toBe("22:00");
    expect(day.courts).toHaveLength(1);
    const free = day.courts[0].free;
    expect([...free.keys()].sort()).toEqual(["16:00", "20:30"]);
    expect(free.get("16:00")).toEqual([60, 90]);
    expect(free.get("20:30")).toEqual([60]);
  });
});
