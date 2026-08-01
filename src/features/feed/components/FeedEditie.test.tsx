import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FeedItem } from "@/features/feed/components/FeedItem";
import { PROFILES, TEAMS } from "@/test/fixtures";
import type { FeedEvent } from "@/features/feed/feedLogic";
import type { Profile, Team } from "@/types";

// De twee editie-kaarten in de feed (#986). Wat hier getest wordt is niet het
// materiaal zelf (dat is CSS, en contrast-check.mjs meet de inkt erop) maar de
// afspraak eromheen: dezelfde highlight-opbouw als elk ander groot moment, met
// alleen een andere skin — plus de tekst die het item leesbaar maakt.

const tmap = Object.fromEntries(TEAMS.map((t) => [t.id, t])) as Record<string, Team>;
const pmap = Object.fromEntries(PROFILES.map((p) => [p.id, p])) as Record<
  string,
  Profile
>;
const [ik, ander] = PROFILES;

function toon(event: FeedEvent, myId = ik.id) {
  return render(
    <MemoryRouter>
      <FeedItem
        event={event}
        pmap={pmap}
        tmap={tmap}
        myId={myId}
        name={(pid) => (pid === myId ? "Jij" : (pmap[pid]?.username ?? pid))}
      />
    </MemoryRouter>,
  );
}

const inForm = (playerId: string): FeedEvent => ({
  kind: "in-form",
  at: "2026-07-14T18:00:00.000Z",
  playerId,
  delta: 48,
  matches: 4,
  weekStart: "2026-07-13",
});

const onFire = (playerId: string): FeedEvent => ({
  kind: "on-fire",
  at: "2026-07-14T18:00:00.000Z",
  playerId,
  streak: 5,
  matchId: "m5",
});

describe("<FeedItem /> — editie-kaarten (#986)", () => {
  it("houdt de highlight-opbouw aan en zet er de In-Form-skin op", () => {
    const { container } = toon(inForm(ander.id));
    const kaart = container.querySelector(".feed-hi");
    expect(kaart).toHaveClass("feed-hi--inform");
    // De soort blijft "rank": de filterchip Klassement en zijn stip rekenen
    // daarop, de skin verandert alleen het materiaal.
    expect(kaart).toHaveAttribute("data-cat", "rank");
    expect(kaart).toHaveAttribute("href", `/spelers/${ander.id}`);
  });

  it("noemt de winst en het aantal matches van de speler van de week", () => {
    toon(inForm(ander.id));
    expect(screen.getByText(/speler van de week/)).toBeInTheDocument();
    expect(screen.getByText(/\+48 in 4 matches/)).toBeInTheDocument();
  });

  it("spreekt je in de tweede persoon aan als je het zelf bent", () => {
    toon(inForm(ik.id));
    expect(screen.getByText(/Jij bent de/)).toBeInTheDocument();
  });

  it("zet de On Fire-skin op de reeks, met de reekslengte erbij", () => {
    const { container } = toon(onFire(ander.id));
    const kaart = container.querySelector(".feed-hi");
    expect(kaart).toHaveClass("feed-hi--onfire");
    expect(kaart).not.toHaveClass("feed-hi--inform");
    expect(screen.getByText(/5 zeges op rij/)).toBeInTheDocument();
  });

  it("laat het roast-schild de eer met rust", () => {
    // Het schild dempt pias en Zwarte Piet; In-Form en On Fire zijn verdienste,
    // en daar valt niets tegen te beschermen (heroThema.ts).
    const beschermd = {
      ...pmap,
      [ander.id]: { ...pmap[ander.id], roast_schild: true },
    };
    render(
      <MemoryRouter>
        <FeedItem
          event={onFire(ander.id)}
          pmap={beschermd}
          tmap={tmap}
          myId={ik.id}
          name={(pid) => pmap[pid]?.username ?? pid}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/5 zeges op rij/)).toBeInTheDocument();
  });
});
