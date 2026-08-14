import { afterEach, describe, expect, it, vi } from "vitest";
import { searchClubs } from "./clubSearchApi";
import { DEFAULT_CLUB } from "./club";
import { PlaytomicUnavailableError } from "./playtomicFetch";

// Clubs zoeken (#391): de proxy geeft de geparste treffers van de Playtomic-
// zoekpagina terug; deze laag mapt ze naar Club + adres.
describe("searchClubs", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubZoek(body: unknown, ok = true, status = 200) {
    const fetchMock = vi.fn(async () => ({
      ok,
      status,
      json: async () => body,
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock as unknown as ReturnType<typeof vi.fn>;
  }

  it("vraagt de proxy met de rauwe zoekterm en mapt de treffers", async () => {
    const fetchMock = stubZoek({
      clubs: [
        {
          id: "t-1",
          name: "LAGO CLUB Padel Beveren",
          slug: "lago-club-padel-beveren",
          countryCode: "BE",
          street: "Pastoor Steenssensstraat 108a",
          postalCode: "9120",
        },
      ],
    });

    const clubs = await searchClubs(" lago beveren ");

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "/api/playtomic/club-search?q=lago%20beveren",
    );
    // Stad komt niet meer uit de bron: leeg laten, adres apart tonen. De
    // tijdzone is voor Belgische clubs geen gok.
    expect(clubs).toEqual([
      {
        id: "t-1",
        name: "LAGO CLUB Padel Beveren",
        city: "",
        timezone: DEFAULT_CLUB.timezone,
        adres: "9120 Pastoor Steenssensstraat 108a",
      },
    ]);
  });

  it("laat het adres leeg als de bron geen straat of postcode geeft", async () => {
    stubZoek({
      clubs: [{ id: "t-2", name: "Padel X", slug: "padel-x", countryCode: "BE", street: "", postalCode: "" }],
    });
    expect((await searchClubs("padel x"))[0].adres).toBe("");
  });

  it("zoekt niet op minder dan twee tekens", async () => {
    const fetchMock = stubZoek({ clubs: [] });
    expect(await searchClubs(" a ")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("een lege trefferlijst is geen fout", async () => {
    stubZoek({ clubs: [] });
    expect(await searchClubs("zzzz")).toEqual([]);
  });

  // De kill switch (#1049) en een ontbrekende egress-hop geven 503: dat is een
  // storing, geen "club bestaat niet" — de kiezer moet dat kunnen tonen.
  it("vertaalt een 503 naar een nette storingsmelding", async () => {
    stubZoek({}, false, 503);
    await expect(searchClubs("lago")).rejects.toThrow(PlaytomicUnavailableError);
    await expect(searchClubs("lago")).rejects.toThrow(/storing/i);
  });
});
