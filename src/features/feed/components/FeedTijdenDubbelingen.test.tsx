import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FeedItem } from "@/features/feed/components/FeedItem";
import { PROFILES, TEAMS } from "@/test/fixtures";
import type { FeedEvent } from "@/features/feed/feedLogic";
import type { Profile, Team } from "@/types";

// Twee afspraken die de highlight-kaarten hiervóór niet nakwamen (#1272):
// een kaart toont alleen een kloktijd bij een écht gebeurtenismoment, en één
// gebeurtenis levert één blok op. FeedLine had de eerste regel al expliciet in
// een comment staan; FeedHighlight kende hem niet en toonde bij de pias van de
// maand "00:00", alsof er om middernacht iets gebeurde.

const tmap = Object.fromEntries(TEAMS.map((t) => [t.id, t])) as Record<string, Team>;
const pmap = Object.fromEntries(PROFILES.map((p) => [p.id, p])) as Record<string, Profile>;
const [ik, ander, derde] = PROFILES;

function toon(event: FeedEvent, profielen: Record<string, Profile> = pmap) {
  return render(
    <MemoryRouter>
      <FeedItem
        event={event}
        pmap={profielen}
        tmap={tmap}
        myId={ik.id}
        name={(pid) => (pid === ik.id ? "Jij" : (profielen[pid]?.username ?? pid))}
      />
    </MemoryRouter>,
  );
}

/** De kloktijd staat als enige in .feed-hi__time. */
const klok = (container: HTMLElement) =>
  container.querySelector(".feed-hi__time")?.textContent ?? null;

const maandPias: FeedEvent = {
  kind: "maand-pias",
  at: "2026-08-01T00:00:00.000Z", // periodegrens, geen gebeurtenismoment
  groupId: "g1",
  groupName: "Vrijdagavond Padel",
  playerId: ander.id,
  reden: "choke",
  detail: "verloor drie keer na een 5-2-voorsprong",
  periodeLabel: "juli 2026",
};

const piasWeek = (over: Partial<Extract<FeedEvent, { kind: "pias-week" }>> = {}) =>
  ({
    kind: "pias-week",
    at: "2026-07-12T19:30:00.000Z",
    tijdEcht: true,
    matchId: "m1",
    groupId: "g1",
    groupName: "Vrijdagavond Padel",
    playerId: ander.id,
    reden: "choke",
    waarde: 0.8,
    winChance: 0.8,
    weekStart: "2026-07-06",
    ...over,
  }) as FeedEvent;

describe("<FeedItem /> — geen verzonnen kloktijden (#1272)", () => {
  it("toont geen klok bij de pias van de maand", () => {
    const { container } = toon(maandPias);
    expect(klok(container)).toBeNull();
  });

  it("toont geen klok bij een klassementsprong of de seizoenskampioen", () => {
    const rank = toon({ kind: "rank", at: "2026-08-01T00:00:00.000Z", playerId: ander.id, shift: 3, rank: 4 });
    expect(klok(rank.container)).toBeNull();
    rank.unmount();

    const champ = toon({
      kind: "season-champion",
      at: "2026-07-01T00:00:00.000Z",
      groupId: "g1",
      groupName: "Vrijdagavond Padel",
      playerId: ander.id,
      seasonLabel: "Q2 2026",
    });
    expect(klok(champ.container)).toBeNull();
  });

  it("houdt de klok wél op een pias-kaart die op zijn ankermatch staat", () => {
    const { container } = toon(piasWeek());
    expect(klok(container)).toMatch(/\d{2}:\d{2}/);
  });

  it("laat de klok weg zodra de pias terugvalt op het week-einde", () => {
    const { container } = toon(piasWeek({ tijdEcht: false, at: "2026-07-12T23:59:59Z" }));
    expect(klok(container)).toBeNull();
  });

  it("noemt de groep bij de pias van de maand, zodat twee groepen niet als dubbele melding lezen", () => {
    toon(maandPias);
    expect(screen.getByText(/Vrijdagavond Padel/)).toBeInTheDocument();
  });
});

describe("<FeedItem /> — pias en Zwarte Piet uit dezelfde partij (#1272)", () => {
  const metPiet = (toPlayerId: string) =>
    piasWeek({
      piet: {
        toPlayerId,
        fromPlayerId: derde.id,
        reden: "choke",
        detail: "verloor met 5 games verschil",
      },
    });

  it("zet de Piet op dezelfde kaart als de pias — één blok, geen tweede kaart", () => {
    const { container } = toon(metPiet(ik.id));
    expect(container.querySelectorAll(".feed-hi")).toHaveLength(1);
    expect(screen.getByText(/pias van de week/)).toBeInTheDocument();
    expect(screen.getByText(/Zwarte Piet/)).toBeInTheDocument();
    expect(screen.getByText(/verloor met 5 games verschil/)).toBeInTheDocument();
  });

  it("noemt de Piet-drager apart als het een ander is dan de pias", () => {
    toon(metPiet(ik.id));
    expect(screen.getByText(/In diezelfde partij pakte jij/)).toBeInTheDocument();
  });

  it("koppelt beide rollen aan elkaar als het dezelfde speler is", () => {
    toon(metPiet(ander.id));
    expect(screen.getByText(/Daarmee pakt/)).toBeInTheDocument();
  });

  it("respecteert het roast-schild van de Piet-drager, ook als de pias er geen heeft", () => {
    const beschermd = {
      ...pmap,
      [ik.id]: { ...pmap[ik.id], roast_schild: true },
    };
    toon(metPiet(ik.id), beschermd);
    expect(screen.getByText(/schande-token/)).toBeInTheDocument();
    expect(screen.queryByText(/Zwarte Piet/)).not.toBeInTheDocument();
    // De pias zelf is niet beschermd en blijft dus gewoon staan.
    expect(screen.getByText(/pias van de week/)).toBeInTheDocument();
  });
});
