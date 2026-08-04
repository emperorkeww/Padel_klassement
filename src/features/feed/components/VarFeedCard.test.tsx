import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const play = vi.fn(() => Promise.resolve());

vi.mock("@/features/coach/components/var_fluit.mp3", () => ({
  default: "fluit.mp3",
}));

import { VarFeedCard } from "@/features/feed/components/VarFeedCard";
import { NEUTRAAL } from "@/features/coach/varUitspraak";
import { PROFILES } from "@/test/fixtures";
import type { FeedEvent } from "@/features/feed/feedLogic";
import type { Match, Profile } from "@/types";

const pmap = Object.fromEntries(PROFILES.map((p) => [p.id, p])) as Record<
  string,
  Profile
>;

function zaak(
  over: Partial<Extract<FeedEvent, { kind: "var" }>> = {},
): Extract<FeedEvent, { kind: "var" }> {
  return {
    kind: "var",
    at: "2026-07-12T21:00:00Z",
    appealId: "va-1",
    matchId: "m-var",
    match: { id: "m-var", score_a: 15, score_b: 16 } as Match,
    claimantId: "p3",
    reden: "ons-punt",
    toelichting: "die bal was binnen",
    status: "toegekend",
    setNumber: null,
    snapshotA: 16,
    snapshotB: 15,
    winnaarDraaitOm: true,
    ...over,
  };
}

function toon(
  event = zaak(),
  ctx = { intensiteit: "gemeen" as const, schild: false },
) {
  return render(
    <MemoryRouter>
      <VarFeedCard event={event} profiles={pmap} ctx={ctx} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  play.mockClear();
  window.sessionStorage.clear();
  vi.stubGlobal(
    "Audio",
    class {
      play = play;
      pause = vi.fn();
      preload = "";
      currentTime = 0;
    },
  );
});

describe("<VarFeedCard />", () => {
  it("toont wie wat betwistte en hoe de stand verschoof", () => {
    toon();
    expect(screen.getByText(/betwistte één punt/i)).toHaveTextContent("Carol");
    expect(screen.getByText("16 – 15")).toBeInTheDocument();
    expect(screen.getByText("15 – 16")).toBeInTheDocument();
  });

  it("kondigt een omgedraaide winnaar met zoveel woorden aan", () => {
    toon();
    expect(screen.getByText(/winnaar van de match om/i)).toBeInTheDocument();
  });

  it("zwijgt over de winnaar als die dezelfde bleef", () => {
    toon(zaak({ winnaarDraaitOm: false }));
    expect(screen.queryByText(/winnaar van de match om/i)).toBeNull();
  });

  it("toont geen scoreverschuiving bij een afwijzing", () => {
    toon(zaak({ status: "afgewezen", winnaarDraaitOm: false }));
    expect(screen.queryByText("16 – 15")).toBeNull();
    expect(screen.getByText("afgewezen")).toBeInTheDocument();
  });

  it("laat Rudy een neutrale zin zeggen bij een roast-schild", () => {
    toon(zaak(), { intensiteit: "gemeen", schild: true });
    expect(screen.getByText(new RegExp(NEUTRAAL.toegekend))).toBeInTheDocument();
  });

  it("fluit één keer per zaak", () => {
    const { rerender } = toon();
    rerender(
      <MemoryRouter>
        <VarFeedCard
          event={zaak()}
          profiles={pmap}
          ctx={{ intensiteit: "gemeen", schild: false }}
        />
      </MemoryRouter>,
    );
    expect(play).toHaveBeenCalledTimes(1);
  });
});
