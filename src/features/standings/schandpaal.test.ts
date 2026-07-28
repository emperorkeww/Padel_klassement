import { describe, it, expect } from "vitest";
import { schandpaalUit } from "./schandpaal";
import { editieVoor, type EditieContext } from "./edities";
import { currentPias, type GlobalePias } from "./pias";
import type { Profile } from "@/types";

const NU = new Date("2026-07-22T10:00:00Z"); // woensdag van de week van 20 juli

const pias = (over: Partial<GlobalePias> = {}): GlobalePias => ({
  isoYear: 2026,
  isoWeek: 30,
  weekStart: "2026-07-20",
  playerId: "p1",
  reden: "afdroging",
  ernst: 58,
  waarde: 8,
  winChance: null,
  beschermd: false,
  ...over,
});

const profiel = (over: Partial<Profile> = {}): Profile => ({
  id: "p1",
  username: "bartv",
  full_name: "Bart V.",
  avatar_url: null,
  created_at: "",
  ...over,
});

const profielen = (...ps: Profile[]): Record<string, Profile> =>
  Object.fromEntries(ps.map((p) => [p.id, p]));

describe("schandpaalUit (#682)", () => {
  it("levert naam, reden-regel en week van de globale pias", () => {
    const data = schandpaalUit([pias()], profielen(profiel()), "ik", NU);
    expect(data?.playerId).toBe("p1");
    expect(data?.naam).toBe("Bart V.");
    expect(data?.detail).toBe("werd met 8 games verschil vakkundig afgedroogd");
    expect(data?.weekStart).toBe("2026-07-20");
    expect(data?.link).toBe("/spelers/p1");
    expect(data?.isMe).toBe(false);
  });

  it("markeert de kijker als hij zelf aan de schandpaal staat", () => {
    const data = schandpaalUit([pias()], profielen(profiel()), "p1", NU);
    expect(data?.isMe).toBe(true);
  });

  it("null bij een leeg venster — geen pias deze of vorige week", () => {
    expect(schandpaalUit([], {}, "ik", NU)).toBeNull();
  });

  it("valt terug op de vorige week, net als de FUT-editie", () => {
    const data = schandpaalUit(
      [pias({ weekStart: "2026-07-13" })],
      profielen(profiel()),
      "ik",
      NU,
    );
    expect(data?.weekStart).toBe("2026-07-13");
  });

  it("null bij een roast-schild volgens de server (#183) — fail-closed", () => {
    const data = schandpaalUit(
      [pias({ beschermd: true })],
      profielen(profiel()),
      "ik",
      NU,
    );
    expect(data).toBeNull();
  });

  it("null bij een roast-schild op het profiel, ook als de server 'onbeschermd' zegt", () => {
    // Tweede slot op dezelfde deur: een profiel dat de kijker wél ziet mag
    // nooit uitvergroot worden als het schild opstaat.
    const data = schandpaalUit(
      [pias()],
      profielen(profiel({ roast_schild: true })),
      "ik",
      NU,
    );
    expect(data).toBeNull();
  });

  it("blijft staan zonder zichtbaar profiel — 'Onbekend' i.p.v. een verdwenen kaart", () => {
    const data = schandpaalUit([pias()], {}, "ik", NU);
    expect(data?.naam).toBe("Onbekend");
    expect(data?.profile).toBeNull();
  });

  it("zwijgt via Coach Rudy's schild-context i.p.v. een eigen sneer-tekst", () => {
    const data = schandpaalUit([pias()], profielen(profiel()), "ik", NU);
    // Club-brede scope: geen groeps-intensiteit, dus de standaardtoon.
    expect(data?.ctx).toEqual({ intensiteit: "radioactief", schild: false });
  });

  it("geeft dezelfde seed voor dezelfde week — de burn wisselt niet per render", () => {
    const a = schandpaalUit([pias()], profielen(profiel()), "ik", NU);
    const b = schandpaalUit([pias()], profielen(profiel()), "ik", NU);
    expect(a?.seed).toBe(b?.seed);
  });
});

describe("Schandpaal ↔ FUT-editie (#682): dezelfde bron, dezelfde speler", () => {
  const ctx = (over: Partial<EditieContext> = {}): EditieContext => ({
    dictatorId: null,
    iconKey: null,
    kampioen: null,
    inForm: null,
    onFire: {},
    pias: null,
    piet: null,
    ...over,
  });

  it("wijst dezelfde speler aan als de 🤡-editie", () => {
    const rows = [pias()];
    // Beide oppervlakken vertrekken van getGlobalePias → currentPias; de
    // editie-context krijgt in Leaderboard exact dezelfde rij.
    const data = schandpaalUit(rows, profielen(profiel()), "ik", NU);
    const editie = editieVoor("p1", ctx({ pias: currentPias(rows, NU) }));
    expect(editie).toBe("pias");
    expect(data?.playerId).toBe("p1");
  });

  it("valt samen dicht bij een roast-schild: geen kaart én geen editie", () => {
    const rows = [pias({ beschermd: true })];
    expect(schandpaalUit(rows, profielen(profiel()), "ik", NU)).toBeNull();
    expect(editieVoor("p1", ctx({ pias: currentPias(rows, NU) }))).toBeNull();
  });

  it("noemt ook de zittende dictator, terwijl zijn kaart de editie onderdrukt", () => {
    // Bewuste divergentie (zie schandpaal.ts): editieVoor houdt de dictator
    // editie-vrij omdat zijn troonkaart al de sterkste skin is — een regel over
    // de kaartskin, niet over de aanduiding. Wie boven én onder het volk staat,
    // staat er twee keer.
    const rows = [pias()];
    expect(
      editieVoor("p1", ctx({ pias: currentPias(rows, NU), dictatorId: "p1" })),
    ).toBeNull();
    expect(schandpaalUit(rows, profielen(profiel()), "ik", NU)?.playerId).toBe(
      "p1",
    );
  });
});
