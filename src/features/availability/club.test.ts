import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CLUB, getClub } from "./club";

// localStorage is in deze testomgeving geen werkende Storage (Node webstorage
// zonder --localstorage-file); de store vangt dat met try/catch af. Voor de
// round-trip-tests stubben we daarom een simpele in-memory variant.
function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}

// De store leest localStorage één keer, bij module-import; via resetModules +
// dynamic import krijgt elke test een verse instantie die de stub echt leest.
async function freshClubModule() {
  vi.resetModules();
  return import("./club");
}

describe("club-store", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("valt zonder (werkende) opslag terug op de thuisclub", () => {
    expect(getClub()).toEqual(DEFAULT_CLUB);
  });

  it("bewaart de keuze en leest die bij een volgend bezoek terug", async () => {
    const storage = fakeStorage();
    vi.stubGlobal("localStorage", storage);

    const eerste = await freshClubModule();
    const other = {
      id: "t-9",
      name: "Padel Gent",
      city: "Gent",
      timezone: "Europe/Brussels",
    };
    eerste.setClub(other);
    expect(eerste.getClub()).toEqual(other);
    expect(JSON.parse(storage.getItem("selected-club") ?? "")).toEqual(other);

    // "Volgend bezoek": verse module-instantie leest dezelfde opslag.
    const tweede = await freshClubModule();
    expect(tweede.getClub()).toEqual(other);
  });

  it("negeert onleesbare opslag en valt terug op de thuisclub", async () => {
    vi.stubGlobal(
      "localStorage",
      fakeStorage({ "selected-club": "{dit is geen json" }),
    );

    const fresh = await freshClubModule();
    expect(fresh.getClub()).toEqual(fresh.DEFAULT_CLUB);
  });
});
