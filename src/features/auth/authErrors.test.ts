import { describe, it, expect } from "vitest";
import {
  authErrorMessage,
  authErrorVeld,
  bevestigError,
  emailError,
  passwordError,
  PASSWORD_MIN_LENGTH,
} from "./authErrors";

describe("authErrorMessage", () => {
  it("mapt verkeerde inloggegevens naar NL", () => {
    expect(authErrorMessage({ code: "invalid_credentials" })).toMatch(
      /klopt niet/i,
    );
  });

  it("mapt onbevestigde e-mail naar NL", () => {
    expect(authErrorMessage({ code: "email_not_confirmed" })).toMatch(
      /bevestig eerst je e-mailadres/i,
    );
  });

  it("mapt een bestaand account naar NL", () => {
    expect(authErrorMessage({ code: "user_already_exists" })).toMatch(
      /bestaat al een account/i,
    );
  });

  it("valt terug op een generieke NL-tekst bij een onbekende code", () => {
    expect(authErrorMessage({ code: "iets_geks_uit_supabase" })).toMatch(
      /er ging iets mis/i,
    );
  });

  it("valt terug bij een fout zonder code en toont nooit de rauwe message", () => {
    const msg = authErrorMessage({ message: "Invalid login credentials" });
    expect(msg).not.toMatch(/invalid/i);
    expect(msg).toMatch(/er ging iets mis/i);
  });
});

describe("passwordError", () => {
  it("keurt een te kort wachtwoord af", () => {
    expect(passwordError("a".repeat(PASSWORD_MIN_LENGTH - 1))).toMatch(
      /minstens 6 tekens/i,
    );
  });

  it("keurt een wachtwoord van precies de minimumlengte goed", () => {
    expect(passwordError("a".repeat(PASSWORD_MIN_LENGTH))).toBeNull();
  });
});

describe("emailError", () => {
  it("vraagt om een adres als het veld leeg is", () => {
    expect(emailError("   ")).toMatch(/vul je e-mailadres in/i);
  });

  it("herkent een adres zonder @ of domein als onbruikbaar", () => {
    expect(emailError("remco")).toMatch(/geen geldig e-mailadres/i);
    expect(emailError("remco@localhost")).toMatch(/geen geldig e-mailadres/i);
  });

  it("laat een gewoon adres door, ook met spaties eromheen", () => {
    expect(emailError(" remco@voorbeeld.nl ")).toBeNull();
  });
});

describe("bevestigError", () => {
  it("vraagt om de herhaling als die leeg is", () => {
    expect(bevestigError("geheim123", "")).toMatch(/herhaal/i);
  });

  it("meldt het verschil tussen wachtwoord en herhaling", () => {
    expect(bevestigError("geheim123", "anders456")).toMatch(
      /komen niet overeen/i,
    );
  });

  it("keurt een gelijke herhaling goed", () => {
    expect(bevestigError("geheim123", "geheim123")).toBeNull();
  });
});

describe("authErrorVeld", () => {
  it("wijst e-mailfouten naar het e-mailveld", () => {
    expect(authErrorVeld({ code: "email_exists" })).toBe("email");
    expect(authErrorVeld({ code: "email_not_confirmed" })).toBe("email");
    expect(authErrorVeld({ code: "validation_failed" })).toBe("email");
  });

  it("wijst wachtwoordfouten naar het wachtwoordveld", () => {
    expect(authErrorVeld({ code: "weak_password" })).toBe("wachtwoord");
    expect(authErrorVeld({ code: "same_password" })).toBe("wachtwoord");
    // Dubbelzinnig van de server uit; het scherm markeert daarom béide velden.
    expect(authErrorVeld({ code: "invalid_credentials" })).toBe("wachtwoord");
  });

  it("laat formulierbrede fouten zonder veld", () => {
    expect(authErrorVeld({ code: "over_email_send_rate_limit" })).toBeNull();
    expect(authErrorVeld({ code: "iets_geks_uit_supabase" })).toBeNull();
    expect(authErrorVeld({ message: "geen code" })).toBeNull();
  });
});
