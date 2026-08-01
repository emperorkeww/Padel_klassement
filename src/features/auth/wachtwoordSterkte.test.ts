import { describe, it, expect } from "vitest";
import { wachtwoordSterkte } from "./wachtwoordSterkte";
import { PASSWORD_MIN_LENGTH } from "./authErrors";

describe("wachtwoordSterkte", () => {
  it("noemt alles onder de minimumlengte 'te kort' (niveau 0)", () => {
    expect(wachtwoordSterkte("")).toEqual({ niveau: 0, label: "Te kort" });
    expect(wachtwoordSterkte("Ab1!x")).toMatchObject({ niveau: 0 });
  });

  it("geeft een net-lang-genoeg wachtwoord niveau 1", () => {
    expect(wachtwoordSterkte("a".repeat(PASSWORD_MIN_LENGTH))).toMatchObject({
      niveau: 1,
      label: "Zwak",
    });
  });

  it("beloont lengte zwaarder dan variatie", () => {
    // Kort met veel variatie blijft onder een lang zonder variatie.
    const kortGevarieerd = wachtwoordSterkte("Ab1!ab");
    const langSaai = wachtwoordSterkte("a".repeat(14));
    expect(kortGevarieerd.niveau).toBeLessThan(langSaai.niveau);
  });

  it("geeft lang én gevarieerd het hoogste niveau", () => {
    expect(wachtwoordSterkte("Padel-Vamos-2026!")).toEqual({
      niveau: 3,
      label: "Sterk",
    });
  });

  it("komt nooit boven niveau 3 uit", () => {
    expect(wachtwoordSterkte("x".repeat(80) + "A1!").niveau).toBe(3);
  });
});
