import { describe, it, expect } from "vitest";
import {
  huidigeStap,
  speeldagStappen,
  voortgangZin,
  type VoortgangInput,
} from "./speeldagVoortgang";

// #1271 — de pagina had geen enkele plek die zei: poll → moment → baan →
// indeling → uitslagen, en waar je nu staat. Elke kaart wist het van zichzelf.

const basis: VoortgangInput = {
  status: "open",
  heeftMoment: false,
  totaal: 0,
  gespeeld: 0,
};

const nu = (v: Partial<VoortgangInput>) =>
  huidigeStap(speeldagStappen({ ...basis, ...v }))?.id ?? null;

describe("speeldagVoortgang (#1271)", () => {
  it("begint bij stemmen", () => {
    expect(nu({})).toBe("stemmen");
  });

  it("wijst naar de baan zodra het moment vaststaat", () => {
    expect(nu({ status: "locked", heeftMoment: true })).toBe("baan");
  });

  it("wijst naar de indeling zodra de baan geboekt is", () => {
    expect(nu({ status: "booked", heeftMoment: true })).toBe("indeling");
  });

  it("wijst naar de uitslagen zodra de wedstrijden staan", () => {
    expect(nu({ status: "booked", heeftMoment: true, totaal: 4 })).toBe(
      "uitslagen",
    );
  });

  it("is klaar als alle uitslagen binnen zijn", () => {
    expect(
      nu({ status: "booked", heeftMoment: true, totaal: 4, gespeeld: 4 }),
    ).toBeNull();
  });

  it("laat de baanstap staan bij een gelockte speeldag met wedstrijden", () => {
    // Klaarzetten kan vóór het boeken; de balk hoort dan niet te doen alsof de
    // baan geregeld is.
    const stappen = speeldagStappen({
      ...basis,
      status: "locked",
      heeftMoment: true,
      totaal: 4,
    });
    expect(stappen.find((s) => s.id === "baan")?.klaar).toBe(false);
    expect(stappen.find((s) => s.id === "indeling")?.klaar).toBe(true);
  });

  it("zegt bij een geannuleerde speeldag dat hij niet doorgaat", () => {
    expect(
      voortgangZin({ ...basis, status: "cancelled", heeftMoment: false }),
    ).toMatch(/gaat niet door/i);
  });

  it("telt de uitslagen in de zin", () => {
    expect(
      voortgangZin({
        ...basis,
        status: "booked",
        heeftMoment: true,
        totaal: 4,
        gespeeld: 1,
      }),
    ).toBe("1 van de 4 uitslagen binnen.");
  });
});
