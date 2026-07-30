import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  FutKaart,
  FutKaartVoorkant,
} from "@/features/rating/components/FutKaart";
import { tierFor } from "@/features/rating/tiers";
import {
  onderdelenPerSlot,
  type SpelerStatBron,
} from "@/features/rating/components/layouts/kaartLayout";
import { divisieLayout } from "@/features/rating/components/layouts/divisieLayouts";
import { SLOF_LAYOUT, SLOF_STATS } from "./slofLayout";

const lees = (pad: string) => readFileSync(resolve(process.cwd(), pad), "utf8");

/** Een speler die past bij de onderste divisie: veel verlies, weinig punten. */
const BRON: SpelerStatBron = {
  gespeeld: 20,
  gewonnen: 2,
  gelijk: 3,
  verloren: 15,
  punten: 9,
  doelsaldo: -48,
  vorm: ["L", "L", "W", "L", "L", "L"],
};

function kaart(bron: SpelerStatBron | null = BRON) {
  return render(
    <FutKaart
      tier={tierFor(350)}
      voor={
        <FutKaartVoorkant
          elo={350}
          tier={tierFor(350)}
          naam="Alice Anders"
          avatar={<span data-testid="avatar">AA</span>}
          statBron={bron}
        />
      }
    />,
  ).container;
}

describe("slof-divisielayout (#834)", () => {
  it("vervangt de generieke FUT-stapel door de eigen compositie", () => {
    const container = kaart();
    expect(container.querySelector(".divisie-voorkant--slof")).not.toBeNull();
    // Geen naamplaat en geen eloblok: de referentie zet daar het statblok neer.
    expect(container.querySelector(".fut-kaart__naam")).toBeNull();
    expect(container.querySelector(".fut-kaart__eloblok")).toBeNull();
  });

  it("houdt de spelersnaam in de accessibility tree", () => {
    // De naam staat niet in beeld maar moet wel voorleesbaar blijven: het is de
    // kaart van díe speler.
    expect(kaart().textContent).toContain("Alice Anders");
  });

  it("toont rating, subniveau en divisietitel uit de kaartdata", () => {
    const container = kaart();
    const tekst = (sel: string) =>
      container.querySelector(sel)?.textContent ?? null;
    expect(tekst(".divisie-voorkant__rating")).toBe("350");
    expect(tekst(".divisie-voorkant__subniveau")).toBe(tierFor(350)!.subLabel);
    expect(tekst(".divisie-voorkant__titel")).toBe(tierFor(350)!.label);
    expect(tekst(".divisie-voorkant__emoji")).toBe(tierFor(350)!.emoji);
  });

  it("rekent alle zes de statwaarden uit de échte cijfers", () => {
    const container = kaart();
    const waarden = [
      ...container.querySelectorAll(".divisie-voorkant__stat-waarde"),
    ].map((el) => el.textContent);
    expect(waarden).toHaveLength(6);
    // Elke waarde is negatief en afgeleid — geen enkele komt uit de referentie.
    for (const waarde of waarden) expect(waarde).toMatch(/^-\d{1,3}$/);
    // Een speler die 2 van de 20 wint mist 90% van zijn winnaarsinstinct.
    expect(waarden[0]).toBe("-90");
    expect(
      [...container.querySelectorAll(".divisie-voorkant__stat-label")].map(
        (el) => el.textContent,
      ),
    ).toEqual(SLOF_STATS.map((regel) => regel.label));
  });

  it("valt zonder statbron terug op streepjes zonder de compositie te breken", () => {
    const waarden = [
      ...kaart(null).querySelectorAll(".divisie-voorkant__stat-waarde"),
    ];
    expect(waarden).toHaveLength(6);
    for (const el of waarden) expect(el.textContent).toBe("—");
  });

  it("reageert op andere spelersdata", () => {
    // Twee verschillende spelers horen twee verschillende kaarten op te
    // leveren; is dat niet zo, dan staat er ergens een vaste waarde.
    const beter: SpelerStatBron = { ...BRON, gewonnen: 10, punten: 33 };
    const a = kaart().querySelector(".divisie-voorkant__stat-waarde");
    const b = kaart(beter).querySelector(".divisie-voorkant__stat-waarde");
    expect(a?.textContent).not.toBe(b?.textContent);
  });

  it("monteert de drie delen op hun eigen montagepunt", () => {
    const container = kaart();
    const delen = [
      ...container.querySelectorAll<HTMLImageElement>(".kaart-onderdelen__beeld"),
    ];
    expect(delen).toHaveLength(SLOF_LAYOUT.onderdelen.length);
    // Geen enkele achtergrondafbeelding: elk deel heeft zijn eigen bron.
    expect(new Set(delen.map((el) => el.getAttribute("src"))).size).toBe(
      delen.length,
    );
    expect(onderdelenPerSlot(SLOF_LAYOUT, "achter").map((o) => o.id)).toEqual([
      "buiten",
    ]);
    expect(onderdelenPerSlot(SLOF_LAYOUT, "binnen").map((o) => o.id)).toEqual([
      "plaat",
    ]);
    expect(onderdelenPerSlot(SLOF_LAYOUT, "voor").map((o) => o.id)).toEqual([
      "omlijsting",
    ]);
  });

  it("zet de generieke schil uit, want het artwork brengt zijn eigen contour mee", () => {
    expect(SLOF_LAYOUT.eigenSilhouet).toBe(true);
    expect(
      kaart().querySelector(".fut-kaart")?.classList.contains(
        "fut-kaart--eigen-silhouet",
      ),
    ).toBe(true);
  });

  it("laat een editie vóór de divisielayout gaan", () => {
    // Een editie brengt haar eigen skin en ornamenten mee en wint dus.
    expect(divisieLayout("slof", "pias")).toBeUndefined();
    expect(divisieLayout("slof", null)).toBe(SLOF_LAYOUT);
  });

  it("raakt de Ballenraper-layout niet", () => {
    // Beide divisies delen het layoutsysteem; een nieuwe layout mag de
    // bestaande niet uit zijn register duwen.
    expect(divisieLayout("hout", null)?.id).toBe("ballenraper");
  });

  it("houdt de layout en het onderdelenmanifest op één kaartbox", () => {
    // scripts/slof-master.py schrijft per deel zijn plek als fractie van de
    // kaartbox. De layout neemt die één op één over — de drie delen komen uit
    // één bron en mogen niet t.o.v. elkaar schuiven.
    const manifest = JSON.parse(
      lees("src/features/rating/components/slof/assets/slof-onderdelen.json"),
    ) as Record<
      string,
      { links: number; boven: number; breedte: number; hoogte: number }
    >;
    for (const deel of SLOF_LAYOUT.onderdelen) {
      const m = manifest[deel.id];
      expect(m, deel.id).toBeDefined();
      expect(deel.x, `${deel.id} x`).toBeCloseTo(m.links, 4);
      expect(deel.y, `${deel.id} y`).toBeCloseTo(m.boven, 4);
      expect(deel.breedte, `${deel.id} breedte`).toBeCloseTo(m.breedte, 4);
      expect(deel.hoogte, `${deel.id} hoogte`).toBeCloseTo(m.hoogte, 4);
    }
  });
});
