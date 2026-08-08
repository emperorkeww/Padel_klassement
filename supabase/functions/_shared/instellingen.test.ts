import { beforeEach, describe, expect, it, vi } from "vitest";
import { isAan, staatAan, vergeetInstellingen } from "./instellingen.ts";

describe("staatAan", () => {
  it("zet alleen uit bij een echte false", () => {
    expect(staatAan({ aan: false })).toBe(false);
    expect(staatAan({ aan: true })).toBe(true);
  });

  // Fail-open: dit is geen beveiligingsgate maar een kill switch. Rommel in de
  // kolom mag geen pushmeldingen tegenhouden die het gisteren nog deden.
  it("blijft aan bij rommel of een ontbrekende rij", () => {
    expect(staatAan(null)).toBe(true);
    expect(staatAan({})).toBe(true);
    expect(staatAan({ aan: "false" })).toBe(true);
    expect(staatAan({ aan: 0 })).toBe(true);
    expect(staatAan({ aan: null })).toBe(true);
    expect(staatAan("uit")).toBe(true);
    expect(staatAan([])).toBe(true);
  });
});

/** Minimale supabase-stub: alleen de keten die isAan gebruikt. */
function stubClient(uitkomst: { data?: unknown; error?: { message: string } }) {
  const maybeSingle = vi.fn(async () => ({
    data: uitkomst.data ?? null,
    error: uitkomst.error ?? null,
  }));
  return {
    client: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
      })),
    } as never,
    maybeSingle,
  };
}

describe("isAan", () => {
  beforeEach(() => vergeetInstellingen());

  it("leest de schakelaar uit de tabel", async () => {
    const { client } = stubClient({ data: { waarde: { aan: false } } });
    expect(await isAan(client, "push")).toBe(false);
  });

  it("blijft aan als de rij niet bestaat", async () => {
    const { client } = stubClient({ data: null });
    expect(await isAan(client, "verzonnen")).toBe(true);
  });

  it("blijft aan als de query faalt", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = stubClient({ error: { message: "databank plat" } });
    expect(await isAan(client, "push")).toBe(true);
    log.mockRestore();
  });

  it("cachet binnen het venster en leest daarna opnieuw", async () => {
    const { client, maybeSingle } = stubClient({ data: { waarde: { aan: false } } });

    expect(await isAan(client, "push", 1000)).toBe(false);
    expect(await isAan(client, "push", 30_000)).toBe(false);
    expect(maybeSingle).toHaveBeenCalledTimes(1);

    // Voorbij het venster van een minuut: opnieuw ophalen.
    expect(await isAan(client, "push", 100_000)).toBe(false);
    expect(maybeSingle).toHaveBeenCalledTimes(2);
  });

  it("cachet een storing niet", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client, maybeSingle } = stubClient({ error: { message: "plat" } });

    await isAan(client, "push", 1000);
    await isAan(client, "push", 1001);
    // Twee keer geprobeerd: een storing mag niet een minuut blijven plakken.
    expect(maybeSingle).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });

  it("houdt de sleutels uit elkaar", async () => {
    const { client, maybeSingle } = stubClient({ data: { waarde: { aan: false } } });
    await isAan(client, "push", 1000);
    await isAan(client, "playtomic", 1000);
    expect(maybeSingle).toHaveBeenCalledTimes(2);
  });
});
