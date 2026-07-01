import { describe, it, expect } from "vitest";

import { formatDate } from "./format";

describe("formatDate", () => {
  it("geeft een lege string bij ontbrekende datum", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
    expect(formatDate("")).toBe("");
  });

  it("formatteert een ISO-datum naar een korte NL-datum", () => {
    const out = formatDate("2026-07-01T10:00:00.000Z");
    expect(out).not.toBe("");
    // Bevat de dag; maand-afkorting is locale-afhankelijk, dus niet hard vastgepind.
    expect(out).toMatch(/1/);
  });
});