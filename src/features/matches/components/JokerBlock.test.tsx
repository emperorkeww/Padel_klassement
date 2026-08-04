import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ToastProvider } from "@/ui/ToastProvider";

const { tables } = vi.hoisted(() => ({
  tables: {} as Record<string, unknown[]>,
}));

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables }) };
});

import { JokerBlock } from "@/features/matches/components/JokerBlock";
import { periodeMaand } from "@/features/matches/jokers";
import { MATCH_DONE, MATCH_PLANNED, PROFILES } from "@/test/fixtures";
import type { Match, Profile } from "@/types";

const pmap = Object.fromEntries(PROFILES.map((p) => [p.id, p])) as Record<
  string,
  Profile
>;

const STRAKS = new Date(Date.now() + 3600_000).toISOString();
const GEPLAND = { ...MATCH_PLANNED, played_at: STRAKS } as Match;

function kaart(over: Record<string, unknown> = {}) {
  return {
    match_id: MATCH_DONE.id,
    player_id: "p2",
    group_id: "g1",
    joker: "schild",
    period_month: periodeMaand(STRAKS),
    created_at: STRAKS,
    ...over,
  };
}

function setJokers(rows: unknown[]) {
  for (const key of Object.keys(tables)) delete tables[key];
  tables.match_jokers = rows;
}

function renderBlok(
  match: Match = MATCH_DONE as Match,
  props: { isDeelnemer?: boolean; games?: number; myId?: string | null } = {},
) {
  return render(
    <ToastProvider>
      <JokerBlock
        match={match}
        profiles={pmap}
        myId={props.myId === undefined ? "p1" : props.myId}
        isDeelnemer={props.isDeelnemer ?? true}
        mijnKans={0.5}
        games={props.games ?? 12}
      />
    </ToastProvider>,
  );
}

beforeEach(() => setJokers([]));

describe("<JokerBlock /> op een afgeronde match", () => {
  it("onthult welke kaart er gespeeld is", async () => {
    setJokers([kaart()]);
    renderBlok();
    expect(await screen.findByText(/bob boers speelde .*schild/i)).toBeInTheDocument();
  });

  it("biedt geen kaarten meer aan om te spelen", async () => {
    setJokers([kaart()]);
    renderBlok();
    await screen.findByText(/bob boers speelde .*schild/i);
    // Uitgegrijsde knoppen zouden suggereren dat het nog kan; die horen weg.
    expect(
      screen.queryByRole("button", { name: /dubbel of niets/i }),
    ).not.toBeInTheDocument();
  });

  it("blijft weg als er geen kaart lag", async () => {
    renderBlok();
    // Even wachten tot de (lege) jokers geladen zijn, anders bewijst de
    // assertie alleen dat het blok nog niet gerenderd wás.
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(/🃏 joker/i)).not.toBeInTheDocument();
  });
});

// De onthulling hangt aan de aftrap en niet aan de vraag of jíj nog mag spelen:
// anders lekt elke geblokkeerde kijker andermans risicokeuze vooraf. Van kant
// wisselen is de uitzondering — die moet iedereen vooraf weten.
describe("<JokerBlock /> vóór de aftrap", () => {
  it("verklapt andermans schild niet aan wie zelf niet meespeelt", async () => {
    setJokers([kaart({ match_id: GEPLAND.id })]);
    renderBlok(GEPLAND, { isDeelnemer: false });
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(/bob boers speelde/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/🃏 joker/i)).not.toBeInTheDocument();
  });

  it("verklapt andermans schild niet aan een medespeler", async () => {
    setJokers([kaart({ match_id: GEPLAND.id })]);
    renderBlok(GEPLAND);
    await screen.findByText(/🃏 joker/i);
    expect(screen.queryByText(/bob boers speelde/i)).not.toBeInTheDocument();
  });

  it("toont andermans wissel van kant wél meteen", async () => {
    setJokers([kaart({ match_id: GEPLAND.id, joker: "wissel_van_kant" })]);
    renderBlok(GEPLAND);
    expect(
      await screen.findByText(/bob boers speelde .*wissel van kant/i),
    ).toBeInTheDocument();
    // Ook in de kop: wie de tegel dichtklapt moet nog steeds weten dat hij
    // straks aan de andere kant staat.
    expect(screen.getByText(/bob boers: wissel van kant/i)).toBeInTheDocument();
  });
});

describe("<JokerBlock /> als keuze", () => {
  it("biedt de drie kaarten aan met hun prijs erbij", async () => {
    renderBlok(GEPLAND);
    await screen.findByText(/🃏 joker/i);
    expect(screen.getByRole("button", { name: /schild/i })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /dubbel of niets/i }),
    ).toBeEnabled();
    // De prijs van het schild hoort vóór de keuze zichtbaar te zijn.
    expect(screen.getByText(/je winst ook/i)).toBeInTheDocument();
  });

  it("grijst de rating-kaarten uit zolang de rating niet ingelopen is", async () => {
    renderBlok(GEPLAND, { games: 3 });
    await screen.findByText(/🃏 joker/i);
    expect(screen.getByRole("button", { name: /schild/i })).toBeDisabled();
    // De sociale kaart mag wél: die raakt de rating niet.
    expect(
      screen.getByRole("button", { name: /wissel van kant/i }),
    ).toBeEnabled();
    // Twee rating-kaarten, dus twee keer dezelfde uitleg — één per kaart, zodat
    // de reden staat waar de knop staat.
    expect(screen.getAllByText(/nog 7 matches te gaan/i)).toHaveLength(2);
  });

  it("laat je eigen gespeelde kaart wél intrekken", async () => {
    setJokers([kaart({ match_id: GEPLAND.id, player_id: "p1" })]);
    renderBlok(GEPLAND);
    await screen.findByText(/🃏 joker/i);
    // Het tegoed staat op "bezet" door precies deze kaart; intrekken moet
    // daarom bedienbaar blijven.
    expect(screen.getByRole("button", { name: /schild/i })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /schild/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("toont het blok niet buiten een groep", async () => {
    renderBlok({ ...GEPLAND, group_id: null } as Match);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(/🃏 joker/i)).not.toBeInTheDocument();
  });
});
