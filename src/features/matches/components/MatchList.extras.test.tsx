import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MatchList } from "@/features/matches/components/MatchList";
import { GEEN_EFFECTEN } from "@/features/matches/matchEffecten";
import type { MatchExtras } from "@/features/matches/useMatchEffecten";
import { MATCH_DONE, PROFILES, TEAMS } from "@/test/fixtures";
import type { Match, Profile, Team } from "@/types";

// De lijstvariant van de matchkaart (#1151). MatchList staat onder de
// profielpagina en kreeg tot dit issue géén lef- of jokerregel doorgegeven: je
// las daar dezelfde match zonder inzet en op de Spelen-pagina mét.

const tmap = Object.fromEntries(TEAMS.map((t) => [t.id, t])) as Record<string, Team>;
const pmap = Object.fromEntries(PROFILES.map((p) => [p.id, p])) as Record<
  string,
  Profile
>;

function toon(extras?: (m: Match) => MatchExtras) {
  return render(
    <MemoryRouter>
      <MatchList
        matches={[MATCH_DONE as Match]}
        teams={tmap}
        profiles={pmap}
        extras={extras}
      />
    </MemoryRouter>,
  );
}

describe("<MatchList /> met effect-extras (#1151)", () => {
  it("toont alle effectregels in één samengestelde badge", () => {
    const { container } = toon(() => ({
      lef: "🎲 lef ×2 · Carol — verlies",
      joker: "🃏 Bob — 🛡️ Schild, winst",
      effecten: { lef: true, joker: true, inzet: false },
    }));
    // De compacte effectbadge toont beide betekenissen rechtstreeks; de lange
    // regels blijven als screenreadertekst aanwezig, maar er is geen abstracte
    // "+1" meer nodig om een tweede zichtbaar effect te verstoppen.
    expect(screen.getByText(/schild, winst/i)).toBeInTheDocument();
    const kaart = container.querySelector(".match-card") as HTMLElement;
    expect(kaart.hasAttribute("data-fx-lef")).toBe(true);
    expect(kaart.hasAttribute("data-fx-joker")).toBe(true);
    expect(kaart.querySelectorAll(".match-effect-badge__part")).toHaveLength(2);
  });

  it("zwijgt wanneer de onthullingspoort de regels nog tegenhoudt", () => {
    // Vóór de aftrap leveren lefKaartRegel/jokerKaartRegel null. De kaart mag
    // dan niets laten zien — anders ligt andermans inzet alsnog open.
    toon(() => ({ lef: null, joker: null, effecten: GEEN_EFFECTEN }));
    expect(screen.queryByText(/lef/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/schild/i)).not.toBeInTheDocument();
  });

  it("blijft werken zonder extras — dat is de oude aanroep", () => {
    toon();
    expect(screen.queryByText(/lef/i)).not.toBeInTheDocument();
  });
});
