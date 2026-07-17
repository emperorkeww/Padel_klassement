import { describe, it, expect } from "vitest";
import { vendettaPoster } from "@/features/groups/vendettaPoster";

describe("vendettaPoster", () => {
  const input = {
    winnaar: "An",
    verliezer: "Cas",
    stand: "5–3",
    groupName: "Kelderklasse",
    doel: 5,
    seed: 42,
  };

  it("bouwt kop, winnaar, versregel, stand en periodelabel", () => {
    const p = vendettaPoster(input);
    expect(p.kop).toBe("VENDETTA BESLIST");
    expect(p.winnaar).toBe("An");
    expect(p.versusRegel).toBe("verslaat Cas");
    expect(p.stand).toBe("5–3");
    expect(p.periodeLabel).toBe("Kelderklasse · eerste tot 5");
  });

  it("onderschrift is gevuld, deterministisch per seed en zonder sjabloonresten", () => {
    const p = vendettaPoster(input);
    expect(p.onderschrift.length).toBeGreaterThan(5);
    expect(p.onderschrift).not.toContain("{doel}");
    expect(vendettaPoster(input).onderschrift).toBe(p.onderschrift);
  });
});
