import { describe, expect, it } from "vitest";
import { ADMIN_FILTERS, pasFiltersToe, zoekGebruikers } from "./adminFilters";
import type { AdminGebruiker } from "./types";

const NU = Date.parse("2026-08-05T12:00:00Z");

function maak(over: Partial<AdminGebruiker> = {}): AdminGebruiker {
  return {
    id: over.username ?? "id",
    username: "speler",
    full_name: null,
    avatar_url: null,
    is_guest: false,
    owner_id: null,
    email: "speler@test.nl",
    created_at: "2026-01-01T00:00:00Z",
    last_sign_in_at: "2026-08-01T00:00:00Z",
    email_confirmed_at: "2026-01-01T00:00:00Z",
    banned_until: null,
    is_admin: false,
    aantal_groepen: 1,
    aantal_matches: 5,
    aantal_gasten: 0,
    ...over,
  };
}

describe("zoekGebruikers", () => {
  const lijst = [
    maak({ username: "rene", full_name: "René Devos", email: "rene@test.nl" }),
    maak({ username: "bob", full_name: "Bob Bakker", email: "bob@elders.be" }),
  ];

  it("geeft bij een lege term de hele lijst terug", () => {
    expect(zoekGebruikers(lijst, "")).toHaveLength(2);
    expect(zoekGebruikers(lijst, "   ")).toHaveLength(2);
  });

  it("zoekt op username, volledige naam én e-mailadres", () => {
    expect(zoekGebruikers(lijst, "bob")).toHaveLength(1);
    expect(zoekGebruikers(lijst, "Bakker")[0].username).toBe("bob");
    expect(zoekGebruikers(lijst, "elders.be")[0].username).toBe("bob");
  });

  it("negeert hoofdletters en accenten", () => {
    // Wie "rene" tikt hoort René te vinden; anders is het zoekveld waardeloos
    // voor precies de namen waarvoor je het nodig hebt.
    expect(zoekGebruikers(lijst, "rene")).toHaveLength(1);
    expect(zoekGebruikers(lijst, "RENÉ")).toHaveLength(1);
  });

  it("verdraagt een ontbrekende naam of e-mail", () => {
    const zonder = [maak({ username: "gast1", full_name: null, email: null })];
    expect(zoekGebruikers(zonder, "gast")).toHaveLength(1);
    expect(zoekGebruikers(zonder, "test.nl")).toHaveLength(0);
  });
});

describe("pasFiltersToe", () => {
  const nooitIngelogd = maak({ username: "stil", last_sign_in_at: null });
  const gast = maak({ username: "gastje", is_guest: true, last_sign_in_at: null, email: null });
  const actief = maak({ username: "actief" });

  it("geeft zonder filters alles terug", () => {
    expect(pasFiltersToe([nooitIngelogd, actief], [], NU)).toHaveLength(2);
  });

  it("houdt bij *nooit ingelogd* alleen echte accounts zonder login over", () => {
    // Gasten hebben per definitie nooit ingelogd; die horen hier niet tussen,
    // anders verzuipt het signaal waar het filter voor bedoeld is.
    const uit = pasFiltersToe([nooitIngelogd, gast, actief], ["nooit-ingelogd"], NU);
    expect(uit.map((u) => u.username)).toEqual(["stil"]);
  });

  it("filtert op geen groep en geen match", () => {
    const leeg = maak({ username: "leeg", aantal_groepen: 0, aantal_matches: 0 });
    expect(pasFiltersToe([leeg, actief], ["geen-groep"], NU)).toHaveLength(1);
    expect(pasFiltersToe([leeg, actief], ["geen-match"], NU)).toHaveLength(1);
  });

  it("stapelt filters als EN, niet als OF", () => {
    const alleenGeenGroep = maak({ username: "a", aantal_groepen: 0, aantal_matches: 3 });
    const allebei = maak({ username: "b", aantal_groepen: 0, aantal_matches: 0 });
    const uit = pasFiltersToe(
      [alleenGeenGroep, allebei],
      ["geen-groep", "geen-match"],
      NU,
    );
    expect(uit.map((u) => u.username)).toEqual(["b"]);
  });

  it("rekent *laatste 7 dagen* vanaf het meegegeven moment", () => {
    const nieuw = maak({ username: "nieuw", created_at: "2026-08-03T00:00:00Z" });
    const oud = maak({ username: "oud", created_at: "2026-07-01T00:00:00Z" });
    const uit = pasFiltersToe([nieuw, oud], ["nieuw"], NU);
    expect(uit.map((u) => u.username)).toEqual(["nieuw"]);
  });

  it("heeft voor elk filter een label", () => {
    for (const f of ADMIN_FILTERS) expect(f.label).toBeTruthy();
  });
});
