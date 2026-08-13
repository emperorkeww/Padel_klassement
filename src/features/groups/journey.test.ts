import { describe, it, expect } from "vitest";
import { journeyFor } from "./journey";
import type { PlayPoll, PollOption } from "./pollsApi";

const NU = Date.UTC(2026, 7, 7, 10, 0);
const VANDAAG = "2026-08-07";

const optie = (over: Partial<PollOption> = {}): PollOption =>
  ({
    id: "o1",
    group_id: "g1",
    date: "2026-08-14",
    start_time: "20:00",
    ...over,
  }) as PollOption;

const poll = (over: Partial<PlayPoll> = {}): PlayPoll =>
  ({
    id: "p1",
    group_id: "g1",
    status: "open",
    locked_option_id: null,
    created_at: "2026-08-01T10:00:00Z",
    ...over,
  }) as PlayPoll;

// De status is losgetrokken van de toon (#1123): "act" dekt zowel een lopende
// poll als een gekozen dag, en een statusglyph kan daar niets mee.
describe("journeyFor — status naast toon", () => {
  it("open poll: actie nodig, status 'open'", () => {
    const j = journeyFor([poll()], [optie()], VANDAAG, NU);
    expect(j.tone).toBe("act");
    expect(j.status).toBe("open");
    expect(j.label).toMatch(/stem mee/i);
  });

  it("vastgelegd moment: actie nodig, maar status 'locked'", () => {
    const j = journeyFor(
      [poll({ status: "locked", locked_option_id: "o1" })],
      [optie()],
      VANDAAG,
      NU,
    );
    expect(j.tone).toBe("act");
    expect(j.status).toBe("locked");
  });

  it("geboekte baan: rustige toon, status 'booked'", () => {
    const j = journeyFor(
      [poll({ status: "booked", locked_option_id: "o1" })],
      [optie()],
      VANDAAG,
      NU,
    );
    expect(j.tone).toBe("info");
    expect(j.status).toBe("booked");
  });

  it("niets gepland: geen status om te tonen", () => {
    const j = journeyFor([], [], VANDAAG, NU);
    expect(j.tone).toBe("idle");
    expect(j.status).toBeNull();
    expect(j.label).toMatch(/plan een speeldag/i);
  });
});

// `tab` lag er sinds #1121 bij zonder lezer; sinds #1298 bepaalt hij waar de
// reis-pil in de groepskop je heen brengt. Alles wat om een handeling vraagt
// wijst naar de agenda; alleen een geboekte dag van vandaag houdt je hier.
describe("journeyFor — waar de reis heen wijst", () => {
  it("stuurt alles wat om een handeling vraagt naar de agenda", () => {
    expect(journeyFor([poll()], [optie()], VANDAAG, NU).tab).toBe("agenda");
    expect(
      journeyFor(
        [poll({ status: "locked", locked_option_id: "o1" })],
        [optie()],
        VANDAAG,
        NU,
      ).tab,
    ).toBe("agenda");
    expect(journeyFor([], [], VANDAAG, NU).tab).toBe("agenda");
  });

  it("houdt een geboekte dag van vandaag bij de groep zelf", () => {
    const geboekt = (datum: string) =>
      journeyFor(
        [poll({ status: "booked", locked_option_id: "o1" })],
        [optie({ date: datum })],
        VANDAAG,
        NU,
      ).tab;
    expect(geboekt(VANDAAG)).toBe("vandaag");
    expect(geboekt("2026-08-14")).toBe("agenda");
  });
});
