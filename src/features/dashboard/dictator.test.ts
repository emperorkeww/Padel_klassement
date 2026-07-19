import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import {
  defaultDictatorEnabled,
  laadWaarnemendPortret,
  waarnemendDictatorZichtbaar,
  setWaarnemendDictatorZichtbaar,
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

describe("waarnemend dictator per-gebruiker toggle (#542)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("is standaard zichtbaar (geen voorkeur opgeslagen)", () => {
    expect(waarnemendDictatorZichtbaar()).toBe(true);
  });

  it("onthoudt 'verborgen' in localStorage", () => {
    setWaarnemendDictatorZichtbaar(false);
    expect(waarnemendDictatorZichtbaar()).toBe(false);
    expect(window.localStorage.getItem("dictator-waarnemend-verborgen")).toBe(
      "1",
    );
  });

  it("wist de vlag weer bij opnieuw aanzetten (default = zichtbaar)", () => {
    setWaarnemendDictatorZichtbaar(false);
    setWaarnemendDictatorZichtbaar(true);
    expect(waarnemendDictatorZichtbaar()).toBe(true);
    expect(
      window.localStorage.getItem("dictator-waarnemend-verborgen"),
    ).toBeNull();
  });
});