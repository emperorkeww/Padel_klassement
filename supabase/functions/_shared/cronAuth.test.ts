import { describe, expect, it } from "vitest";
import { cronGuard, isCronAuthorized } from "./cronAuth.ts";

const withHeader = (value: string | null): Request =>
  new Request("https://example.test", {
    headers: value === null ? {} : { "x-cron-secret": value },
  });

describe("isCronAuthorized", () => {
  it("weigert als het geheim ontbreekt, ongeacht de header (#460 fail-closed)", () => {
    // De kern van #460: een niet-gezette secret mag NIET open vallen.
    expect(isCronAuthorized(undefined, null)).toBe(false);
    expect(isCronAuthorized(undefined, "wat-dan-ook")).toBe(false);
    expect(isCronAuthorized("", "")).toBe(false);
  });

  it("weigert een ontbrekende of verkeerde header", () => {
    expect(isCronAuthorized("geheim", null)).toBe(false);
    expect(isCronAuthorized("geheim", "fout")).toBe(false);
  });

  it("laat door bij exact het juiste geheim", () => {
    expect(isCronAuthorized("geheim", "geheim")).toBe(true);
  });
});

describe("cronGuard", () => {
  it("geeft 401 als het geheim ontbreekt", async () => {
    const res = cronGuard(withHeader("iets"), undefined);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
    expect(await res!.json()).toEqual({ error: "Geen toegang" });
  });

  it("geeft 401 bij een verkeerde header", () => {
    expect(cronGuard(withHeader("fout"), "geheim")!.status).toBe(401);
  });

  it("geeft 401 als de header ontbreekt", () => {
    expect(cronGuard(withHeader(null), "geheim")!.status).toBe(401);
  });

  it("geeft null (doorgang) bij het juiste geheim", () => {
    expect(cronGuard(withHeader("geheim"), "geheim")).toBeNull();
  });
});
