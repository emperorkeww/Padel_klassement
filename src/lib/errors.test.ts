import { describe, it, expect } from "vitest";
import { errorMessage } from "./errors";

describe("errorMessage", () => {
  it("geeft de message van een Error terug", () => {
    expect(errorMessage(new Error("kapot"))).toBe("kapot");
  });

  it("leest .message van PostgREST-achtige objecten", () => {
    expect(errorMessage({ message: "rij bestaat al", code: "23505" })).toBe(
      "rij bestaat al",
    );
  });

  it("valt terug op String() voor primitieve waarden", () => {
    expect(errorMessage("oeps")).toBe("oeps");
    expect(errorMessage(42)).toBe("42");
    expect(errorMessage({ geen: "message" })).toBe("[object Object]");
  });
});
