import { describe, expect, it } from "vitest";
import { maskeerEmail, veiligeDetails } from "./adminAudit.ts";

describe("veiligeDetails", () => {
  it("laat nooit een wachtwoord, link of token in het auditspoor", () => {
    // De kern van het filter. Een allow-list per actie in plaats van een
    // deny-list op namen: een nieuw veld valt standaard buiten het logboek.
    const details = veiligeDetails("temp_password", {
      wachtwoord: "bal-boom-zon7",
      password: "bal-boom-zon7",
      link: "https://vamos/reset-wachtwoord?token_hash=abc",
      token_hash: "abc",
      action_link: "https://x/auth/v1/verify?token=abc",
    });
    expect(details).toEqual({});
    expect(JSON.stringify(details)).not.toContain("bal-boom-zon7");
    expect(JSON.stringify(details)).not.toContain("abc");
  });

  it("laat per actie alleen de velden door die erbij horen", () => {
    expect(veiligeDetails("recovery_link", { vervalt_over_minuten: 60, link: "geheim" })).toEqual(
      { vervalt_over_minuten: 60 },
    );
    expect(veiligeDetails("sign_out_all", { sessies: 3, jwt: "geheim" })).toEqual({
      sessies: 3,
    });
  });

  it("maskeert e-mailadressen bij een correctie", () => {
    expect(
      veiligeDetails("fix_email", { van: "oud@voorbeeld.be", naar: "nieuw@voorbeeld.be" }),
    ).toEqual({ van: "o***@voorbeeld.be", naar: "n***@voorbeeld.be" });
  });

  it("geeft een leeg object voor een onbekende actie", () => {
    // Fail-closed: wie een actie toevoegt zonder hier een regel te zetten,
    // krijgt een lege details — niet per ongeluk de hele payload.
    expect(veiligeDetails("iets_nieuws", { alles: "hier" })).toEqual({});
  });

  it("slaat ontbrekende velden over in plaats van ze op null te zetten", () => {
    expect(veiligeDetails("recovery_link", {})).toEqual({});
    expect(veiligeDetails("fix_email", { van: undefined, naar: "n@x.be" })).toEqual({
      naar: "n***@x.be",
    });
  });
});

describe("maskeerEmail", () => {
  it("houdt het domein leesbaar en de rest niet", () => {
    expect(maskeerEmail("remco@voorbeeld.be")).toBe("r***@voorbeeld.be");
  });

  it("geeft undefined voor iets dat geen adres is", () => {
    expect(maskeerEmail("geen adres")).toBeUndefined();
    expect(maskeerEmail(undefined)).toBeUndefined();
    expect(maskeerEmail(42)).toBeUndefined();
  });
});
