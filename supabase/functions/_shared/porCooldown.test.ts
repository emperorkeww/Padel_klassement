import { describe, expect, it } from "vitest";
import { magPorren, POR_COOLDOWN_MIN } from "./porCooldown.ts";

const nu = new Date("2026-08-13T14:00:00Z");
const geleden = (minuten: number) =>
  new Date(nu.getTime() - minuten * 60_000).toISOString();

describe("magPorren", () => {
  it("laat de eerste por gewoon door", () => {
    expect(magPorren(null, nu)).toEqual({ mag: true, minutenResterend: 0 });
  });

  it("houdt een tweede por binnen het uur tegen", () => {
    // Dit is het gat: de knop verbergt zichzelf alleen in client-state, dus een
    // paginaverversing of een tweede groepslid porde er zo overheen.
    expect(magPorren(geleden(5), nu)).toEqual({
      mag: false,
      minutenResterend: 55,
    });
  });

  it("laat weer porren zodra de cooldown om is", () => {
    expect(magPorren(geleden(POR_COOLDOWN_MIN), nu).mag).toBe(true);
    expect(magPorren(geleden(POR_COOLDOWN_MIN + 1), nu).mag).toBe(true);
  });

  it("rondt de resterende tijd naar boven af", () => {
    // "Nog 0 minuten wachten" bestaat niet zolang je moet wachten.
    expect(magPorren(geleden(59.5), nu).minutenResterend).toBe(1);
  });

  it("respecteert een andere cooldown", () => {
    expect(magPorren(geleden(5), nu, 10)).toEqual({
      mag: false,
      minutenResterend: 5,
    });
    expect(magPorren(geleden(5), nu, 3).mag).toBe(true);
  });

  it("faalt open bij een onleesbare of toekomstige stempel", () => {
    expect(magPorren("gisteren", nu).mag).toBe(true);
    expect(magPorren(new Date(nu.getTime() + 60_000).toISOString(), nu).mag).toBe(
      true,
    );
  });
});
