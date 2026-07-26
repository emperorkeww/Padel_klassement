import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchAllPages } from "./paginate";

afterEach(() => {
  vi.restoreAllMocks();
});

/** Nep-tabel van `total` rijen die op `.range(from, to)` reageert zoals
 *  PostgREST: hooguit één pagina, en nooit meer dan de paginagrootte. */
function tabel(total: number) {
  const rijen = Array.from({ length: total }, (_, i) => ({ id: i }));
  const ranges: [number, number][] = [];
  const fetchPage = (from: number, to: number) => {
    ranges.push([from, to]);
    return Promise.resolve({ data: rijen.slice(from, to + 1), error: null });
  };
  return { fetchPage, ranges };
}

describe("fetchAllPages (#731)", () => {
  it("stopt na één pagina als de tabel kleiner is dan de paginagrootte", async () => {
    const { fetchPage, ranges } = tabel(7);
    expect(await fetchAllPages(fetchPage, 10)).toHaveLength(7);
    expect(ranges).toEqual([[0, 9]]);
  });

  it("haalt alles op als de tabel groter is dan één pagina", async () => {
    const { fetchPage, ranges } = tabel(25);
    const rows = await fetchAllPages(fetchPage, 10);
    expect(rows).toHaveLength(25);
    // Geen dubbele of overgeslagen rijen.
    expect(rows.map((r) => r.id)).toEqual([...Array(25).keys()]);
    expect(ranges).toEqual([
      [0, 9],
      [10, 19],
      [20, 29],
    ]);
  });

  it("haalt nog één pagina op als de laatste precies vol was", async () => {
    const { fetchPage, ranges } = tabel(20);
    expect(await fetchAllPages(fetchPage, 10)).toHaveLength(20);
    // Een volle pagina kán het einde zijn, maar dat weet je pas na de volgende.
    expect(ranges).toHaveLength(3);
  });

  it("laat een fout doorkomen in plaats van halve data terug te geven", async () => {
    const fetchPage = () =>
      Promise.resolve({ data: null, error: new Error("boem") });
    await expect(fetchAllPages(fetchPage, 10)).rejects.toThrow("boem");
  });

  it("stopt luidruchtig bij een tabel die niet ophoudt", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // Altijd een volle pagina: zonder noodrem zou dit eeuwig doorlopen.
    const fetchPage = (from: number, to: number) =>
      Promise.resolve({
        data: Array.from({ length: to - from + 1 }, (_, i) => ({ id: from + i })),
        error: null,
      });
    const rows = await fetchAllPages(fetchPage, 10);
    expect(rows).toHaveLength(500);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
