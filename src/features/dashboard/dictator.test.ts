import { describe, it, expect, afterEach, vi } from "vitest";
import { defaultDictatorEnabled, laadWaarnemendPortret } from "./dictator";

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