import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Wegvegen is zacht (#1273): de rij blijft staan met een `dismissed_at`. Dat
 * werkt alleen als élke lijst en élke teller dat filter meedraagt — vergeet er
 * één, en een weggelegde melding komt terug of blijft in de badge meetellen.
 * Eén vergeten `.is("dismissed_at", null)` is precies het soort fout dat geen
 * enkele UI-test opmerkt, dus wordt de bron zelf gelezen.
 */
const bron = readFileSync("src/features/meldingen/api.ts", "utf8");

/** De body van één exported functie uit api.ts. */
function functie(naam: string): string {
  const m = new RegExp(
    `export (?:async )?function ${naam}\\([\\s\\S]*?\\n\\}`,
  ).exec(bron);
  expect(m, `functie ${naam} niet gevonden`).toBeTruthy();
  return m![0];
}

describe("weggelegde meldingen blijven weg", () => {
  it.each(["getMeldingen", "getMeldingenVenster", "getOngelezenAantal"])(
    "%s filtert op dismissed_at",
    (naam) => {
      expect(functie(naam)).toMatch(/\.is\("dismissed_at", null\)/);
    },
  );

  it("markeerAllesGelezen raakt geen weggelegde rijen", () => {
    expect(functie("markeerAllesGelezen")).toMatch(/\.is\("dismissed_at", null\)/);
  });

  it("wegvegen zet ook read_at, zodat de tag-index vrijkomt", () => {
    // De partiële unieke index (user_id, tag) where read_at is null houdt anders
    // een weggelegde-maar-ongelezen rij als open plek vast, en dan vouwt het
    // volgende bericht over dezelfde gebeurtenis in de rij die jij net weglegde.
    expect(functie("veegWeg")).toMatch(/read_at: melding\.read_at \?\? nu/);
  });
});
