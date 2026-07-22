import { describe, it, expect } from "vitest";
import {
  authErrorMessage,
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
