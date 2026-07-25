import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { EregalerijTab } from "@/features/seizoen/components/EregalerijTab";
import { ToastProvider } from "@/components/ui/ToastProvider";
import type { Match, Profile, Team } from "@/types";

const NOW = "2026-01-01T12:00:00";
/** "Nu" ligt in Q3 2026: Q1 en Q2 zijn afgesloten, Q3 loopt nog. */
const NU = new Date(2026, 7, 15);

const TEAMS: Record<string, Team> = {
  "t-ab": { id: "t-ab", name: null, player1_id: "a", player2_id: "b", created_at: NOW },
  "t-cd": { id: "t-cd", name: null, player1_id: "c", player2_id: "d", created_at: NOW },
};

const profile = (id: string, naam: string, over: Partial<Profile> = {}): Profile => ({
  id,
  username: id,
  full_name: naam,
  avatar_url: null,
  created_at: NOW,
  ...over,
});

const PROFILES: Record<string, Profile> = {
  a: profile("a", "Alice"),
  b: profile("b", "Bob"),
  c: profile("c", "Carol"),
  d: profile("d", "Daan"),
};

let seq = 0;
const match = (over: Partial<Match> = {}): Match => ({
  id: `m${++seq}`,
  team_a_id: "t-ab",
  team_b_id: "t-cd",
  status: "completed",
  winner_team_id: "t-ab",
  score_a: 6,
  score_b: 0,
  played_at: "2026-02-10T19:00:00",
  created_at: "2026-02-10T18:00:00",
  created_by: null,
  group_id: "g1",
  round_number: null,
  format: "2v2",
  ...over,
});

function setup(matches: Match[], profiles = PROFILES) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <EregalerijTab
          matches={matches}
          teams={TEAMS}
          profiles={profiles}
          myId="a"
          now={NU}
        />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("<EregalerijTab />", () => {
  it("nodigt uit zolang er geen afgesloten seizoen is", () => {
    setup([match({ played_at: "2026-07-20T19:00:00" })]); // lopend kwartaal
    expect(screen.getByText(/Nog geen afgesloten seizoen/)).toBeInTheDocument();
  });

  it("toont per afgesloten seizoen de seizoensnaam en de kampioen", () => {
    setup([
      match({ played_at: "2026-02-10T19:00:00" }),
      match({ played_at: "2026-05-04T19:00:00" }),
    ]);
    expect(screen.getByText("🌱 Lente 2026")).toBeInTheDocument();
    expect(screen.getByText("❄️ Winter 2026")).toBeInTheDocument();
    // Twee seizoenen, dus twee kampioenslabels.
    expect(screen.getAllByText("Kampioen")).toHaveLength(2);
    expect(screen.getAllByText(/Alice/).length).toBeGreaterThan(0);
  });

  it("markeert de eigen naam op het podium", () => {
    setup([match({ played_at: "2026-02-10T19:00:00" })]);
    expect(screen.getByText("jij")).toBeInTheDocument();
  });

  it("noemt de pias van het seizoen bij naam", () => {
    setup([
      match({ played_at: "2026-02-03T19:00:00" }),
      match({ played_at: "2026-02-10T19:00:00" }),
      match({ played_at: "2026-02-17T19:00:00" }),
    ]);
    expect(screen.getByText("Pias van het seizoen:")).toBeInTheDocument();
  });

  it("houdt de pias-regel neutraal bij een roast-schild (#183)", () => {
    const beschermd = {
      ...PROFILES,
      c: profile("c", "Carol", { roast_schild: true }),
      d: profile("d", "Daan", { roast_schild: true }),
    };
    setup(
      [
        match({ played_at: "2026-02-03T19:00:00" }),
        match({ played_at: "2026-02-10T19:00:00" }),
        match({ played_at: "2026-02-17T19:00:00" }),
      ],
      beschermd,
    );
    expect(screen.queryByText("Pias van het seizoen:")).not.toBeInTheDocument();
    expect(screen.getByText(/Opvallend seizoen voor/)).toBeInTheDocument();
    expect(screen.getByText(/roast-schild staat aan/)).toBeInTheDocument();
  });

  it("toont het recordboek met houder en waarde", () => {
    setup([
      match({ played_at: "2026-02-03T19:00:00" }),
      match({ played_at: "2026-02-10T19:00:00" }),
      match({ played_at: "2026-02-17T19:00:00" }),
    ]);
    expect(screen.getByText("📖 Recordboek")).toBeInTheDocument();
    expect(screen.getByText("Langste winreeks")).toBeInTheDocument();
    expect(screen.getByText("3 op rij")).toBeInTheDocument();
    expect(screen.getByText("Meeste bagels uitgedeeld")).toBeInTheDocument();
  });

  it("laat het recordboek weg zonder records", () => {
    setup([match({ played_at: "2026-07-20T19:00:00", score_a: 6, score_b: 5 })]);
    expect(screen.queryByText("📖 Recordboek")).not.toBeInTheDocument();
  });

  it("biedt de kampioensposter per seizoen aan", () => {
    setup([match({ played_at: "2026-02-10T19:00:00" })]);
    expect(screen.getByRole("button", { name: /Deel poster/ })).toBeInTheDocument();
  });
});
