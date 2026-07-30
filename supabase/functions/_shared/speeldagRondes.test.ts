import { describe, expect, it } from "vitest";
import {
  KLAARZET_MIN,
  magRondesZetten,
  RONDE_MIN,
  rondesVoorDuur,
} from "./speeldagRondes.ts";
// De client-tegenhanger: dezelfde getallen, andere boom.
import * as client from "@/features/groups/speeldagRondes";

describe("rondesVoorDuur", () => {
  it("reserveert tien minuten en verdeelt de rest", () => {
    expect(rondesVoorDuur(60)).toBe(5);
    expect(rondesVoorDuur(90)).toBe(8);
    expect(rondesVoorDuur(120)).toBe(11);
  });

  it("gaat nooit onder nul bij een onrealistisch kort blok", () => {
    expect(rondesVoorDuur(10)).toBe(0);
    expect(rondesVoorDuur(0)).toBe(0);
  });
});

describe("magRondesZetten", () => {
  // Speeldag 30 juli, 20:00 in Brussel; ochtenddrempel 08:00 diezelfde dag.
  const ochtend = Date.parse("2026-07-30T06:00:00Z");
  const start = Date.parse("2026-07-30T18:00:00Z");
  const mag = (over: Partial<Parameters<typeof magRondesZetten>[0]> = {}) =>
    magRondesZetten({
      status: "booked",
      rondesGezetOp: null,
      now: ochtend,
      start,
      ochtend,
      leadMin: 90,
      ...over,
    });

  it("zet de rondes van een geboekte speeldag 's ochtends klaar", () => {
    expect(mag()).toBe(true);
  });

  it("wacht op de boeking — een gelockte speeldag ligt qua bezetting nog niet vast", () => {
    expect(mag({ status: "locked" })).toBe(false);
    expect(mag({ status: "open" })).toBe(false);
  });

  it("wacht op de ochtend: de dag ervóór gebeurt er niets", () => {
    expect(mag({ now: ochtend - 3600_000 })).toBe(false);
    expect(mag({ now: Date.parse("2026-07-29T20:00:00Z") })).toBe(false);
  });

  it("pakt een boeking later op de dag bij de eerstvolgende tik", () => {
    expect(mag({ now: Date.parse("2026-07-30T13:05:00Z") })).toBe(true);
  });

  it("doet niets meer zodra de speeldag begonnen is", () => {
    expect(mag({ now: start })).toBe(false);
    expect(mag({ now: start + 60_000 })).toBe(false);
  });

  it("houdt zich aan de dedup", () => {
    expect(mag({ rondesGezetOp: "2026-07-30T06:05:00Z" })).toBe(false);
  });

  it("valt voor een speeldag vóór het ochtenduur terug op het vangnet vlak vóór de start", () => {
    const vroeg = Date.parse("2026-07-30T05:00:00Z"); // 07:00 in Brussel
    const opts = { start: vroeg, ochtend };
    expect(mag({ ...opts, now: vroeg - 91 * 60_000 })).toBe(false);
    expect(mag({ ...opts, now: vroeg - 89 * 60_000 })).toBe(true);
  });
});

describe("pariteit met de client", () => {
  it("hanteert dezelfde ronde- en klaarzettijd", () => {
    expect(RONDE_MIN).toBe(client.RONDE_MIN);
    expect(KLAARZET_MIN).toBe(client.KLAARZET_MIN);
  });

  it("komt op hetzelfde aantal rondes uit", () => {
    for (const duur of [60, 90, 120]) {
      expect(rondesVoorDuur(duur)).toBe(client.rondesVoorDuur(duur));
    }
  });
});
