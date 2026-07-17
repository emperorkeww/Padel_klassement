import { describe, expect, it } from "vitest";
import {
  JAGER_GAT,
  klassementFeiten,
  positieTier,
  type KlassementRij,
} from "./klassementFeiten";

const rij = (playerId: string, rating: number | null, games = 10): KlassementRij => ({
  playerId,
  naam: `Speler ${playerId}`,
  rating,
  games,
});

/** Acht spelers, rating aflopend van 1200 naar 780 in stappen van 60. */
const acht = ["a", "b", "c", "d", "e", "f", "g", "h"].map((id, i) => rij(id, 1200 - i * 60));

describe("positieTier", () => {
  it("geeft nieuw onder de THIN_GAMES-drempel, ongeacht positie", () => {
    expect(positieTier(1, 8, 2)).toBe("nieuw");
    expect(positieTier(8, 8, 0)).toBe("nieuw");
  });

  it("geeft troon voor de nummer 1", () => {
    expect(positieTier(1, 8, 10)).toBe("troon");
    expect(positieTier(1, 1, 10)).toBe("troon");
  });

  it("geeft jager voor plek 2 en 3", () => {
    expect(positieTier(2, 8, 10)).toBe("jager");
    expect(positieTier(3, 8, 10)).toBe("jager");
  });

  it("geeft kelder voor het onderste kwart vanaf vier spelers", () => {
    expect(positieTier(7, 8, 10)).toBe("kelder");
    expect(positieTier(8, 8, 10)).toBe("kelder");
    expect(positieTier(6, 8, 10)).toBe("middenmoot");
    expect(positieTier(4, 4, 10)).toBe("kelder");
  });

  it("geeft in een mini-groepje alleen de laatste de kelder", () => {
    expect(positieTier(3, 3, 10)).toBe("kelder");
    expect(positieTier(2, 3, 10)).toBe("jager");
    expect(positieTier(2, 2, 10)).toBe("kelder");
  });

  it("geeft middenmoot voor de rest", () => {
    expect(positieTier(4, 8, 10)).toBe("middenmoot");
    expect(positieTier(5, 8, 10)).toBe("middenmoot");
  });
});

describe("klassementFeiten", () => {
  it("geeft null als de speler niet in de lijst staat", () => {
    expect(klassementFeiten(acht, "onbekend", "globaal")).toBeNull();
    expect(klassementFeiten([], "a", "globaal")).toBeNull();
  });

  it("berekent rank, totaal en tier", () => {
    const f = klassementFeiten(acht, "e", "globaal");
    expect(f).toMatchObject({ rank: 5, totaal: 8, tier: "middenmoot", scope: "globaal" });
  });

  it("berekent de Elo-gaten naar boven en onder plus de buurman", () => {
    const f = klassementFeiten(acht, "e", "groep");
    expect(f?.deltaNaarBoven).toBe(60);
    expect(f?.deltaNaarOnder).toBe(60);
    expect(f?.buurmanBoven).toBe("Speler d");
    expect(f?.scope).toBe("groep");
  });

  it("laat de randen null: geen buurman boven bij #1, geen onder bij de laatste", () => {
    const top = klassementFeiten(acht, "a", "globaal");
    expect(top?.deltaNaarBoven).toBeNull();
    expect(top?.buurmanBoven).toBeNull();
    expect(top?.deltaNaarOnder).toBe(60);
    const laatste = klassementFeiten(acht, "h", "globaal");
    expect(laatste?.deltaNaarOnder).toBeNull();
    expect(laatste?.deltaNaarBoven).toBe(60);
  });

  it("berekent de afstand tot de top-3 alleen buiten de top-3", () => {
    expect(klassementFeiten(acht, "d", "globaal")?.deltaNaarTop3).toBe(60);
    expect(klassementFeiten(acht, "f", "globaal")?.deltaNaarTop3).toBe(180);
    expect(klassementFeiten(acht, "c", "globaal")?.deltaNaarTop3).toBeNull();
    expect(klassementFeiten(acht, "a", "globaal")?.deltaNaarTop3).toBeNull();
  });

  it("laat delta's null zodra een rating ontbreekt", () => {
    const rows = [rij("a", 1200), rij("b", null), rij("c", 1000)];
    const f = klassementFeiten(rows, "b", "globaal");
    expect(f?.deltaNaarBoven).toBeNull();
    expect(f?.deltaNaarOnder).toBeNull();
    expect(f?.buurmanBoven).toBe("Speler a");
  });

  it("geeft de shift ongewijzigd door, met null als hij ontbreekt", () => {
    expect(klassementFeiten(acht, "e", "globaal", -3)?.shift).toBe(-3);
    expect(klassementFeiten(acht, "e", "globaal", "nieuw")?.shift).toBe("nieuw");
    expect(klassementFeiten(acht, "e", "globaal")?.shift).toBeNull();
  });

  it("markeert een speler met te weinig matches als nieuw", () => {
    const rows = [rij("a", 1200), rij("b", 1100, 1), rij("c", 1000)];
    expect(klassementFeiten(rows, "b", "globaal")?.tier).toBe("nieuw");
  });

  it("houdt een negatief gat op nul (gelijke of omgekeerde ratings)", () => {
    const rows = [rij("a", 1000), rij("b", 1000)];
    expect(klassementFeiten(rows, "b", "globaal")?.deltaNaarBoven).toBe(0);
  });

  it("exporteert een positieve jager-drempel", () => {
    expect(JAGER_GAT).toBeGreaterThan(0);
  });
});
