import { describe, it, expect } from "vitest";
import {
  iconFor,
  summarizeDay,
  summarizeParts,
  RAIN_WARN_PCT,
  type HourWeather,
} from "./weatherLogic";

const hour = (
  h: number,
  code = 0,
  rainPct = 0,
  temp = 20,
): HourWeather => ({ hour: h, code, rainPct, temp });

describe("iconFor", () => {
  it("mapt WMO-codes naar iconen", () => {
    expect(iconFor(0)).toBe("☀️");
    expect(iconFor(2)).toBe("⛅");
    expect(iconFor(3)).toBe("☁️");
    expect(iconFor(61)).toBe("🌧️");
    expect(iconFor(95)).toBe("⛈️");
    expect(iconFor(71)).toBe("❄️");
  });
});

describe("summarizeParts", () => {
  it("vat per dagdeel samen: zwaarste weertype, max temp en max regenkans", () => {
    const parts = summarizeParts([
      hour(9, 0, 5, 16),
      hour(10, 61, 70, 15), // ochtendregen
      hour(14, 1, 10, 22),
      hour(20, 0, 0, 19),
    ]);
    expect(parts.map((p) => p.part)).toEqual(["ochtend", "middag", "avond"]);
    const ochtend = parts[0];
    expect(ochtend.icon).toBe("🌧️");
    expect(ochtend.rainPct).toBe(70);
    expect(ochtend.temp).toBe(16);
    expect(ochtend.warn).toBe(true);
    expect(parts[1].warn).toBe(false);
  });

  it("laat dagdelen zonder uurdata weg", () => {
    const parts = summarizeParts([hour(20, 0, 0, 18)]);
    expect(parts.map((p) => p.part)).toEqual(["avond"]);
  });
});

describe("summarizeDay", () => {
  it("waarschuwt vanaf de regen-drempel binnen de speelbare uren", () => {
    const day = summarizeDay([
      hour(2, 61, 90, 12), // nachtregen telt niet mee
      hour(15, 2, RAIN_WARN_PCT, 21),
    ]);
    expect(day?.icon).toBe("⛅");
    expect(day?.rainPct).toBe(RAIN_WARN_PCT);
    expect(day?.warn).toBe(true);
  });

  it("geeft null zonder speelbare uren", () => {
    expect(summarizeDay([hour(3, 0, 0, 10)])).toBeNull();
  });
});
