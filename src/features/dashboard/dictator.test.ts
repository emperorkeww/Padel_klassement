import { describe, it, expect, afterEach, vi } from "vitest";
import {
  defaultDictatorEnabled,
  laadWaarnemendPortret,
  regeerduurLabel,
  regeerduurZin,
} from "./dictator";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("waarnemend dictator-flag (#536)", () => {
  it("staat standaard aan (leeg = aan, huidig gedrag)", () => {
    vi.stubEnv("VITE_DEFAULT_DICTATOR", "");
    expect(defaultDictatorEnabled()).toBe(true);
  });

  it("is uit te zetten met VITE_DEFAULT_DICTATOR=false", () => {
    vi.stubEnv("VITE_DEFAULT_DICTATOR", "false");
    expect(defaultDictatorEnabled()).toBe(false);
  });

  it("laadt het portret wanneer de flag aan staat", async () => {
    vi.stubEnv("VITE_DEFAULT_DICTATOR", "");
    await expect(laadWaarnemendPortret()).resolves.toBeTruthy();
  });

  it("laadt géén portret (null) wanneer de flag uit staat", async () => {
    vi.stubEnv("VITE_DEFAULT_DICTATOR", "false");
    await expect(laadWaarnemendPortret()).resolves.toBeNull();
  });
});

const UUR = 3_600_000;
const DAG = 24 * UUR;

describe("regeerduurLabel (#545)", () => {
  it("toont dagen vanaf 24 uur, met enkelvoud/meervoud", () => {
    expect(regeerduurLabel(3 * DAG)).toBe("3 dagen");
    expect(regeerduurLabel(DAG)).toBe("1 dag");
    expect(regeerduurLabel(DAG + 5 * UUR)).toBe("1 dag");
  });

  it("toont uren onder een dag", () => {
    expect(regeerduurLabel(5 * UUR)).toBe("5 uur");
    expect(regeerduurLabel(23 * UUR)).toBe("23 uur");
  });

  it("vangt een heel korte termijn op met '< 1 uur'", () => {
    expect(regeerduurLabel(10 * 60_000)).toBe("< 1 uur");
    expect(regeerduurLabel(0)).toBe("< 1 uur");
  });
});

describe("regeerduurZin (#545)", () => {
  it("spreekt in de tegenwoordige tijd voor de zittende dictator", () => {
    expect(regeerduurZin(3 * DAG, 1, true)).toBe(
      "Regeert al 3 dagen als El Padelissimo",
    );
  });

  it("spreekt in de verleden tijd voor een afgezette dictator", () => {
    expect(regeerduurZin(12 * DAG, 1, false)).toBe("Heerste in totaal 12 dagen");
  });

  it("noemt het aantal ambtstermijnen vanaf twee", () => {
    expect(regeerduurZin(12 * DAG, 2, false)).toBe(
      "Heerste in totaal 12 dagen · 2 ambtstermijnen",
    );
    expect(regeerduurZin(5 * DAG, 3, true)).toBe(
      "Regeert al 5 dagen als El Padelissimo · 3 ambtstermijnen",
    );
  });
});
