import { describe, it, expect } from "vitest";
import { sum, greeting } from "./utils";

describe("sum", () => {
  it("telt getallen op", () => {
    expect(sum([1, 2, 3])).toBe(6);
  });

  it("geeft 0 voor een lege lijst", () => {
    expect(sum([])).toBe(0);
  });
});

describe("greeting", () => {
  it("groet met naam", () => {
    expect(greeting("Remco")).toBe("Hallo, Remco!");
  });
});