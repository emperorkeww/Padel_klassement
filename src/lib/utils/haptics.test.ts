import { describe, it, expect, vi, afterEach } from "vitest";
import { tap, winPulse } from "@/lib/utils/haptics";

afterEach(() => {
  // @ts-expect-error — testopruiming van de gestubde API
  delete navigator.vibrate;
});

describe("haptics", () => {
  it("trilt kort bij tap()", () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    tap();
    expect(vibrate).toHaveBeenCalledWith(10);
  });

  it("geeft een puls-patroon bij winPulse()", () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    winPulse();
    expect(vibrate).toHaveBeenCalledWith([10, 40, 20]);
  });

  it("doet stil niets zonder Vibration API", () => {
    expect(() => tap()).not.toThrow();
    expect(() => winPulse()).not.toThrow();
  });
});
