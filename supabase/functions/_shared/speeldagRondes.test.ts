import { describe, expect, it } from "vitest";
import {
  KLAARZET_MIN,
  RONDE_MIN,
  rondesDrempel,
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

describe("rondesDrempel", () => {
  const ochtend = Date.parse("2026-07-30T06:00:00Z"); // 08:00 in Brussel

  it("laat een avondspeeldag 's ochtends al indelen", () => {
    const start = Date.parse("2026-07-30T18:00:00Z"); // 20:00 in Brussel
    expect(rondesDrempel(ochtend, start, 90)).toBe(ochtend);
  });

  it("valt voor een speeldag vóór het ochtenduur terug op het venster vlak vóór de start", () => {
    const start = Date.parse("2026-07-30T05:00:00Z"); // 07:00 in Brussel
    expect(rondesDrempel(ochtend, start, 90)).toBe(start - 90 * 60_000);
  });

  it("blijft nooit later dan het vangnet-venster, ook net ná het ochtenduur", () => {
    const start = Date.parse("2026-07-30T07:00:00Z"); // 09:00 in Brussel
    expect(rondesDrempel(ochtend, start, 90)).toBe(start - 90 * 60_000);
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
