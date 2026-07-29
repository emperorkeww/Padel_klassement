import { describe, expect, it } from "vitest";
import { KLAARZET_MIN, RONDE_MIN, rondesVoorDuur } from "./speeldagRondes.ts";
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
