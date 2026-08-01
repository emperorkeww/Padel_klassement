import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  cached,
  cachedMany,
  cacheSize,
  invalidate,
  invalidateAll,
  subscribeInvalidate,
  sweepExpired,
} from "./queryCache";

const TTL = 30_000;

beforeEach(() => {
  invalidateAll();
  // Nepklok: de cache leunt volledig op Date.now() voor de TTL.
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  invalidateAll();
});

describe("cached — verlopen entries opruimen (#738)", () => {
  it("deelt een verse hit zonder opnieuw op te halen", async () => {
    const fn = vi.fn(async () => "a");
    const first = cached("k", fn);
    const second = cached("k", fn);
    expect(first).toBe(second);
    expect(fn).toHaveBeenCalledTimes(1);
    await expect(second).resolves.toBe("a");
  });

  it("vervangt een verlopen entry in plaats van er één toe te voegen", async () => {
    const fn = vi.fn(async () => "a");
    await cached("k", fn);
    expect(cacheSize()).toBe(1);

    vi.advanceTimersByTime(TTL + 1);
    await cached("k", fn);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(cacheSize()).toBe(1);
  });

  it("laat geen entry achter als de fetch faalt", async () => {
    const boom = vi.fn(async () => {
      throw new Error("stuk");
    });
    await expect(cached("k", boom)).rejects.toThrow("stuk");
    expect(cacheSize()).toBe(0);
  });
});

describe("cached — bovengrens (#738)", () => {
  it("blijft onder de grens bij veel unieke sleutels", async () => {
    for (let i = 0; i < 250; i++) {
      await cached(`matches:one:${i}`, async () => i);
    }
    expect(cacheSize()).toBeLessThanOrEqual(200);
  });

  it("gooit de oudste weg en houdt de nieuwste", async () => {
    const fn = vi.fn(async (i: number) => i);
    for (let i = 0; i < 250; i++) {
      await cached(`matches:one:${i}`, () => fn(i));
    }
    const calls = fn.mock.calls.length;

    // De nieuwste is nog een hit, de oudste is geëvict en haalt opnieuw op.
    await cached("matches:one:249", () => fn(249));
    expect(fn).toHaveBeenCalledTimes(calls);
    await cached("matches:one:0", () => fn(0));
    expect(fn).toHaveBeenCalledTimes(calls + 1);
  });

  it("houdt een sleutel in leven die tussendoor gelezen is (LRU, niet FIFO)", async () => {
    const fn = vi.fn(async (i: number) => i);
    for (let i = 0; i < 150; i++) {
      await cached(`matches:one:${i}`, () => fn(i));
    }
    // Sleutel 0 nog eens aanraken: die hoort daarna achteraan te staan.
    await cached("matches:one:0", () => fn(0));
    for (let i = 150; i < 250; i++) {
      await cached(`matches:one:${i}`, () => fn(i));
    }
    const calls = fn.mock.calls.length;

    await cached("matches:one:0", () => fn(0));
    expect(fn).toHaveBeenCalledTimes(calls); // nog steeds een hit
    await cached("matches:one:1", () => fn(1));
    expect(fn).toHaveBeenCalledTimes(calls + 1); // wel geëvict
  });

  it("verlengt de TTL niet bij een hit", async () => {
    const fn = vi.fn(async () => "a");
    await cached("k", fn);
    vi.advanceTimersByTime(TTL - 1);
    await cached("k", fn); // hit, vlak voor het verlopen
    vi.advanceTimersByTime(2);
    await cached("k", fn); // moet nu alsnog verlopen zijn
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("sweepExpired (#738)", () => {
  it("ruimt verlopen entries op en laat verse staan", async () => {
    await cached("oud", async () => 1);
    vi.advanceTimersByTime(TTL - 1_000);
    await cached("nieuw", async () => 2);
    expect(cacheSize()).toBe(2);

    vi.advanceTimersByTime(1_001); // 'oud' verlopen, 'nieuw' nog net niet
    sweepExpired();

    expect(cacheSize()).toBe(1);
    const fn = vi.fn(async () => 2);
    await cached("nieuw", fn);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("cachedMany — per id cachen (#738)", () => {
  const rows = (ids: string[]) =>
    Object.fromEntries(ids.map((id) => [id, { id }]));

  it("haalt alleen de ontbrekende id's op bij een overlappende set", async () => {
    const fetchMissing = vi.fn(async (missing: string[]) => rows(missing));

    await cachedMany("profiles:one:", ["a", "b"], fetchMissing);
    const result = await cachedMany("profiles:one:", ["b", "c"], fetchMissing);

    expect(fetchMissing).toHaveBeenCalledTimes(2);
    expect(fetchMissing.mock.calls[1][0]).toEqual(["c"]);
    expect(Object.keys(result).sort()).toEqual(["b", "c"]);
  });

  it("doet één fetch bij twee gelijktijdige aanroepen met dezelfde set", async () => {
    const fetchMissing = vi.fn(async (missing: string[]) => rows(missing));

    const [first, second] = await Promise.all([
      cachedMany("profiles:one:", ["a", "b"], fetchMissing),
      cachedMany("profiles:one:", ["a", "b"], fetchMissing),
    ]);

    expect(fetchMissing).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
  });

  it("bewaart één entry per id, niet per combinatie", async () => {
    const fetchMissing = vi.fn(async (missing: string[]) => rows(missing));
    await cachedMany("profiles:one:", ["a", "b"], fetchMissing);
    await cachedMany("profiles:one:", ["b", "a"], fetchMissing);
    await cachedMany("profiles:one:", ["a", "c"], fetchMissing);
    expect(cacheSize()).toBe(3);
  });

  it("deelt zijn entries met een losse getter op dezelfde sleutel", async () => {
    const fetchMissing = vi.fn(async (missing: string[]) => rows(missing));
    await cachedMany("profiles:one:", ["a"], fetchMissing);

    const one = vi.fn(async () => ({ id: "a" }));
    await cached("profiles:one:a", one);
    expect(one).not.toHaveBeenCalled();
  });

  it("laat een niet-gevonden id weg uit het resultaat", async () => {
    const fetchMissing = vi.fn(async () => rows(["a"]));
    const result = await cachedMany(
      "profiles:one:",
      ["a", "weg"],
      fetchMissing,
    );
    expect(result).toEqual({ a: { id: "a" } });
  });

  it("haalt niets op als alles vers in de cache zit", async () => {
    const fetchMissing = vi.fn(async (missing: string[]) => rows(missing));
    await cachedMany("profiles:one:", ["a", "b"], fetchMissing);
    fetchMissing.mockClear();
    await cachedMany("profiles:one:", ["a", "b"], fetchMissing);
    expect(fetchMissing).not.toHaveBeenCalled();
  });

  it("haalt opnieuw op zodra de entries verlopen zijn", async () => {
    const fetchMissing = vi.fn(async (missing: string[]) => rows(missing));
    await cachedMany("profiles:one:", ["a"], fetchMissing);
    vi.advanceTimersByTime(TTL + 1);
    await cachedMany("profiles:one:", ["a"], fetchMissing);
    expect(fetchMissing).toHaveBeenCalledTimes(2);
    expect(cacheSize()).toBe(1);
  });

  it("laat geen entries achter als de batch faalt", async () => {
    const boom = vi.fn(async () => {
      throw new Error("stuk");
    });
    await expect(cachedMany("profiles:one:", ["a", "b"], boom)).rejects.toThrow(
      "stuk",
    );
    expect(cacheSize()).toBe(0);
  });

  it("fetcht niet voor een lege id-lijst", async () => {
    const fetchMissing = vi.fn(async (missing: string[]) => rows(missing));
    await expect(
      cachedMany("profiles:one:", [], fetchMissing),
    ).resolves.toEqual({});
    expect(fetchMissing).not.toHaveBeenCalled();
  });
});

describe("subscribeInvalidate — abonnees op een lege cache (#907)", () => {
  it("meldt de geraakte prefixen aan elke abonnee", () => {
    const a = vi.fn();
    const b = vi.fn();
    subscribeInvalidate(a);
    const stop = subscribeInvalidate(b);

    invalidate("match-stakes", "matches");
    expect(a).toHaveBeenCalledWith(["match-stakes", "matches"]);
    expect(b).toHaveBeenCalledWith(["match-stakes", "matches"]);

    stop();
    invalidate("match-stakes");
    expect(a).toHaveBeenCalledTimes(2);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("meldt invalidateAll als de lege prefix — die raakt elke sleutel", () => {
    const cb = vi.fn();
    const stop = subscribeInvalidate(cb);
    invalidateAll();
    expect(cb).toHaveBeenCalledWith([""]);
    stop();
  });

  it("meldt ook als er niets in de cache stond", () => {
    // De abonnee leest niet uit de cache maar haalt zelf opnieuw op; of er
    // toevallig een verse entry stond mag zijn refetch niet bepalen.
    const cb = vi.fn();
    const stop = subscribeInvalidate(cb);
    invalidate("bestaat-niet");
    expect(cb).toHaveBeenCalledTimes(1);
    stop();
  });
});
