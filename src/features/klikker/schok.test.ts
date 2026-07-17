import { describe, it, expect } from "vitest";
import { deltaMagnitude, isSchok, SCHOK_DREMPEL } from "@/features/klikker/schok";

const rust = { x: 0, y: 9.81, z: 0 }; // telefoon stil op tafel

describe("deltaMagnitude", () => {
  it("is 0 bij identieke samples", () => {
    expect(deltaMagnitude(rust, { ...rust })).toBe(0);
  });

  it("meet de lengte van het verschilvectortje", () => {
    expect(deltaMagnitude({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 })).toBe(5);
  });
});

describe("isSchok", () => {
  it("negeert kleine bewegingen (lopen, tikken)", () => {
    expect(isSchok(rust, { x: 2, y: 11, z: 1 })).toBe(false);
  });

  it("herkent een stevige schudbeweging", () => {
    expect(isSchok(rust, { x: 15, y: -8, z: 12 })).toBe(true);
  });

  it("triggert precies op de drempel", () => {
    expect(isSchok({ x: 0, y: 0, z: 0 }, { x: SCHOK_DREMPEL, y: 0, z: 0 })).toBe(true);
    expect(isSchok({ x: 0, y: 0, z: 0 }, { x: SCHOK_DREMPEL - 0.01, y: 0, z: 0 })).toBe(false);
  });

  it("respecteert een eigen drempel", () => {
    expect(isSchok(rust, { x: 5, y: 9.81, z: 0 }, 4)).toBe(true);
  });
});
