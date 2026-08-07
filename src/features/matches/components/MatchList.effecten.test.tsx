import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MatchCard } from "@/features/matches/components/MatchList";
import { MATCH_DONE, PROFILES, TEAMS } from "@/test/fixtures";
import type { Match, Profile, Team } from "@/types";

// De effect-achtergrond op de matchkaart (#1151). De kaart zet per actief effect
// één data-attribuut; de effect-surface rendert daar één SVG-ribbon voor. Deze
// tests bewaken dat er voor élke combinatie precies de juiste losse lagen én
// badges staan — zodra een samengestelde toestand insluipt is het ontwerp weg.

const tmap = Object.fromEntries(TEAMS.map((t) => [t.id, t])) as Record<string, Team>;
const pmap = Object.fromEntries(PROFILES.map((p) => [p.id, p])) as Record<
  string,
  Profile
>;

const KAAL = { ...MATCH_DONE, wager_drink: null } as unknown as Match;
const MET_DRANKJE = {
  ...MATCH_DONE,
  wager_drink: "duvel",
  wager_drink_qty: 2,
} as unknown as Match;

const LEF_REGEL = "🎲 lef ×2 · Carol — verlies";
const JOKER_REGEL = "🃏 Bob — 🛡️ Schild, winst";

function kaart(opts: { match: Match; lef?: string | null; joker?: string | null }) {
  const { container } = render(
    <MemoryRouter>
      <MatchCard
        match={opts.match}
        teams={tmap}
        profiles={pmap}
        lef={opts.lef}
        joker={opts.joker}
      />
    </MemoryRouter>,
  );
  return container.querySelector(".match-card") as HTMLElement;
}

/** Welke effectlagen deze kaart aanzet, in vaste volgorde. */
function lagen(el: HTMLElement): string[] {
  return (["lef", "joker", "inzet"] as const).filter((k) =>
    el.hasAttribute(`data-fx-${k}`),
  );
}

describe("<MatchCard /> — de acht effecttoestanden (#1151)", () => {
  const gevallen: [string, { match: Match; lef?: string; joker?: string }, string[]][] =
    [
      ["gewone match", { match: KAAL }, []],
      ["lef", { match: KAAL, lef: LEF_REGEL }, ["lef"]],
      ["joker", { match: KAAL, joker: JOKER_REGEL }, ["joker"]],
      ["inzet", { match: MET_DRANKJE }, ["inzet"]],
      [
        "lef + joker",
        { match: KAAL, lef: LEF_REGEL, joker: JOKER_REGEL },
        ["lef", "joker"],
      ],
      ["lef + inzet", { match: MET_DRANKJE, lef: LEF_REGEL }, ["lef", "inzet"]],
      [
        "joker + inzet",
        { match: MET_DRANKJE, joker: JOKER_REGEL },
        ["joker", "inzet"],
      ],
      [
        "lef + joker + inzet",
        { match: MET_DRANKJE, lef: LEF_REGEL, joker: JOKER_REGEL },
        ["lef", "joker", "inzet"],
      ],
    ];

  it.each(gevallen)("%s", (_naam, opts, verwacht) => {
    const el = kaart(opts);
    expect(lagen(el)).toEqual(verwacht);
    expect(
      Array.from(el.querySelectorAll(".match-effect-ribbon")).map((ribbon) =>
        (["lef", "joker", "inzet"] as const).find((naam) =>
          ribbon.classList.contains(`match-effect-ribbon--${naam}`),
        ),
      ),
    ).toEqual(verwacht);
    expect(
      Array.from(el.querySelectorAll(".match-effect-badge__part")).map((part) =>
        (["lef", "joker", "inzet"] as const).find((naam) =>
          part.classList.contains(`match-effect-badge__part--${naam}`),
        ),
      ),
    ).toEqual(verwacht);
    // `data-fx` staat er zodra er íets ligt: dat schakelt de tekstkleur om.
    expect(el.hasAttribute("data-fx")).toBe(verwacht.length > 0);
  });

  it("laat een gewone match volledig met rust", () => {
    const el = kaart({ match: KAAL });
    expect(el.hasAttribute("data-fx")).toBe(false);
    expect(lagen(el)).toEqual([]);
    expect(el.querySelector(".match-effect-surface")).toBeNull();
    expect(el.querySelector(".match-effect-badge")).toBeNull();
  });
});

describe("<MatchCard /> — de effectlagen blijven los van elkaar", () => {
  it("zet bij een combinatie geen samengestelde toestand", () => {
    const el = kaart({ match: MET_DRANKJE, lef: LEF_REGEL, joker: JOKER_REGEL });
    // Elke laag staat op zijn eigen attribuut. Zou er ooit één klasse per
    // combinatie bijkomen, dan valt dit om — en dat is precies de bedoeling.
    expect(el.className).not.toMatch(/lef|joker|inzet/);
    expect(lagen(el)).toEqual(["lef", "joker", "inzet"]);
    expect(el.querySelectorAll(".match-effect-ribbon")).toHaveLength(3);
    expect(el.querySelectorAll(".match-effect-badge__part")).toHaveLength(3);
  });

  it("houdt de winnaarstyling los van de effectstyling", () => {
    // Effectkleur en uitslag zijn twee semantische lagen; de linkerrand is en
    // blijft van de uitslag.
    const { container } = render(
      <MemoryRouter>
        <MatchCard
          match={MET_DRANKJE}
          teams={tmap}
          profiles={pmap}
          perspectiveId="p1"
          lef={LEF_REGEL}
        />
      </MemoryRouter>,
    );
    const el = container.querySelector(".match-card") as HTMLElement;
    expect(el.className).toContain("match-card--win");
    expect(lagen(el)).toEqual(["lef", "inzet"]);
  });
});

describe("<MatchCard /> — de onthullingspoort kleurt niets", () => {
  it("laat de kaart kaal zolang de regels nog verborgen zijn", () => {
    // Vóór de aftrap leveren lefKaartRegel/jokerKaartRegel null. Kleurde de
    // kaart dan tóch, dan lag andermans inzet alsnog open — de tekstregel is
    // dan wel weg, maar paars is paars.
    const el = kaart({ match: KAAL, lef: null, joker: null });
    expect(lagen(el)).toEqual([]);
  });
});

describe("<MatchCard /> — een vervallen inzet dooft", () => {
  it("kleurt niet op een afgelaste match", () => {
    const m = { ...MET_DRANKJE, status: "cancelled" } as unknown as Match;
    expect(lagen(kaart({ match: m }))).toEqual([]);
  });

  it("kleurt niet bij gelijkspel", () => {
    const m = { ...MET_DRANKJE, winner_team_id: null } as unknown as Match;
    expect(lagen(kaart({ match: m }))).toEqual([]);
  });

  it("kleurt wél na een ingeloste traktatie", () => {
    const m = {
      ...MET_DRANKJE,
      wager_settled_at: MATCH_DONE.played_at,
    } as unknown as Match;
    expect(lagen(kaart({ match: m }))).toEqual(["inzet"]);
  });
});
