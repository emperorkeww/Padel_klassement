import { describe, expect, it } from "vitest";
import { bundelPerSpeeldag } from "./reminderBundel.ts";
import { dagInZone } from "./klok.ts";

const TZ = "Europe/Brussels";

const m = (id: string, played_at: string, group_id: string | null = "g1") => ({
  id,
  group_id,
  played_at,
});

describe("dagInZone", () => {
  it("rekent in clubtijd, niet in UTC", () => {
    // 23:30 UTC = 01:30 Brusselse tijd de volgende dag.
    expect(dagInZone("2026-07-29T23:30:00.000Z", TZ)).toBe("2026-07-30");
    expect(dagInZone("2026-07-29T17:30:00.000Z", TZ)).toBe("2026-07-29");
  });
});

describe("bundelPerSpeeldag", () => {
  it("herinnert één keer per groepsdag en onderdrukt de rest van de avond", () => {
    const avond = [
      m("r2", "2026-07-29T17:40:00.000Z"),
      m("r1", "2026-07-29T17:30:00.000Z"),
      m("r3", "2026-07-29T17:50:00.000Z"),
    ];
    const [bundel] = bundelPerSpeeldag(avond, TZ);
    expect(bundel.herinner.id).toBe("r1");
    expect(bundel.onderdruk.map((x) => x.id)).toEqual(["r2", "r3"]);
  });

  it("houdt verschillende speeldagen uit elkaar", () => {
    const bundels = bundelPerSpeeldag(
      [
        m("a", "2026-07-29T17:30:00.000Z"),
        m("b", "2026-07-30T17:30:00.000Z"),
      ],
      TZ,
    );
    expect(bundels).toHaveLength(2);
    expect(bundels.every((x) => x.onderdruk.length === 0)).toBe(true);
  });

  it("houdt verschillende groepen uit elkaar", () => {
    const bundels = bundelPerSpeeldag(
      [
        m("a", "2026-07-29T17:30:00.000Z", "g1"),
        m("b", "2026-07-29T17:30:00.000Z", "g2"),
      ],
      TZ,
    );
    expect(bundels).toHaveLength(2);
  });

  it("laat losse matches zonder groep elk hun eigen herinnering houden", () => {
    const bundels = bundelPerSpeeldag(
      [
        m("a", "2026-07-29T17:30:00.000Z", null),
        m("b", "2026-07-29T18:30:00.000Z", null),
      ],
      TZ,
    );
    expect(bundels).toHaveLength(2);
    expect(bundels.every((x) => x.onderdruk.length === 0)).toBe(true);
  });

  it("kiest stabiel als alle rondes op hetzelfde moment staan", () => {
    const gelijk = [
      m("z", "2026-07-29T17:30:00.000Z"),
      m("a", "2026-07-29T17:30:00.000Z"),
    ];
    expect(bundelPerSpeeldag(gelijk, TZ)[0].herinner.id).toBe("a");
  });

  it("geeft een lege lijst terug zonder matches", () => {
    expect(bundelPerSpeeldag([], TZ)).toEqual([]);
  });
});
