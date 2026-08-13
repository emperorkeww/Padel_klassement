import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { SOORTEN, soortInfo, zonderEmoji } from "./soorten";

/**
 * De soortenmap is een spiegel (#1273): de waarheid staat in de
 * check-constraint op public.notifications en in de Soort-union van de Edge
 * Functions, en de app-bundel kan geen van beide importeren. Deze suite leest
 * daarom de twee bronnen en houdt de drie lijsten op elkaar — precies het
 * patroon van glasIntegratie.test.ts, dat om dezelfde reden de CSS-bron leest.
 */

const lees = (pad: string) => readFileSync(pad, "utf8");

function soortenUitConstraint(): string[] {
  const sql = lees("supabase/schemas/tables/27_notifications.sql");
  const blok = sql.match(/soort\s+text\s+not null[\s\S]*?check\s*\(([\s\S]*?)\)\s*\)/i);
  expect(blok, "check-constraint op notifications.soort niet gevonden").toBeTruthy();
  return [...blok![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

function soortenUitUnion(): string[] {
  const ts = lees("supabase/functions/_shared/meldingen.ts");
  const blok = ts.match(/export type Soort =([\s\S]*?);/);
  expect(blok, "Soort-union in _shared/meldingen.ts niet gevonden").toBeTruthy();
  return [...blok![1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
}

describe("soortenmap", () => {
  it("dekt exact de soorten uit de database-constraint", () => {
    expect([...Object.keys(SOORTEN)].sort()).toEqual(soortenUitConstraint().sort());
  });

  it("dekt exact de soorten uit de Soort-union van de Edge Functions", () => {
    expect([...Object.keys(SOORTEN)].sort()).toEqual(soortenUitUnion().sort());
  });

  it("geeft elke soort een eigen icoon en een label", () => {
    const iconen = new Set(Object.values(SOORTEN).map((s) => s.icoon));
    expect(iconen.size).toBe(Object.keys(SOORTEN).length);
    for (const s of Object.values(SOORTEN)) expect(s.label.length).toBeGreaterThan(2);
  });

  it("valt terug op een neutrale presentatie voor een soort die de bundel nog niet kent", () => {
    // De functions worden apart uitgerold: de server kan een tiende soort
    // schrijven vóór deze bundel hem kent. Dat mag geen lege kolom geven.
    const onbekend = soortInfo("teleportatie");
    expect(onbekend.familie).toBe("neutraal");
    expect(onbekend.icoon).toBeTypeOf("function");
  });
});

describe("zonderEmoji", () => {
  it("haalt de emoji vooraan weg", () => {
    expect(zonderEmoji("🎾 Nieuwe ronde staat klaar")).toBe("Nieuwe ronde staat klaar");
  });

  it("haalt de emoji achteraan weg", () => {
    expect(zonderEmoji("Nieuw vriendschapsverzoek 🎾")).toBe("Nieuw vriendschapsverzoek");
    expect(zonderEmoji("Gewonnen 🎉")).toBe("Gewonnen");
  });

  it("laat een titel zonder emoji met rust", () => {
    expect(zonderEmoji("De VAR heeft gesproken")).toBe("De VAR heeft gesproken");
  });

  it("houdt een titel die alleen uit emoji bestaat heel", () => {
    expect(zonderEmoji("🎾🎉")).toBe("🎾🎉");
  });
});
