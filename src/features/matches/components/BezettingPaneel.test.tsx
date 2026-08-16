import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/ui/ToastProvider";

// Het paneel stelt twee vragen en leidt uit het antwoord op de tweede af wélke
// handeling het wordt. Dát is wat hier fout kan gaan: een invaller hoort langs
// `wisselSpeler` te gaan, iemand die al meespeelt langs `ruilSpelers`.
const beheer = vi.hoisted(() => ({
  wisselSpeler:
    vi.fn<(p: Record<string, string>, admin: boolean) => Promise<void>>(
      async () => {},
    ),
  ruilSpelers:
    vi.fn<(p: Record<string, string>, admin: boolean) => Promise<void>>(
      async () => {},
    ),
}));
vi.mock("@/features/admin/matchBeheer", () => beheer);

vi.mock("@/features/groups/api", () => ({
  getGroupMembers: vi.fn(async () => [
    { player_id: "p1" },
    { player_id: "p2" },
    { player_id: "p3" },
    { player_id: "p4" },
    { player_id: "p5" },
    { player_id: "p6" },
    { player_id: "p9" },
  ]),
}));

vi.mock("@/features/friends/api", () => ({
  getMyFriendships: vi.fn(async () => []),
  categorize: () => ({ accepted: [] }),
  otherId: (f: { a: string }) => f.a,
}));

vi.mock("@/features/profiles/api", async (echt) => ({
  ...(await echt<Record<string, unknown>>()),
  getProfilesByIds: vi.fn(async (ids: string[]) =>
    Object.fromEntries(ids.map((id) => [id, profiel(id)])),
  ),
}));

import { BezettingPaneel } from "./BezettingPaneel";
import type { Match, Profile, Team } from "@/types";

function profiel(id: string): Profile {
  return {
    id,
    username: id,
    full_name: `Speler ${id.toUpperCase()}`,
    avatar_url: null,
    created_at: "2026-08-16T10:00:00.000Z",
  } as Profile;
}

const PROFIELEN: Record<string, Profile> = Object.fromEntries(
  ["p1", "p2", "p3", "p4", "p5", "p6", "p9"].map((id) => [id, profiel(id)]),
);

const TEAMS: Record<string, Team> = {
  "t-12": { id: "t-12", player1_id: "p1", player2_id: "p2" } as Team,
  "t-34": { id: "t-34", player1_id: "p3", player2_id: "p4" } as Team,
  "t-56": { id: "t-56", player1_id: "p5", player2_id: "p6" } as Team,
  "t-9x": { id: "t-9x", player1_id: "p9", player2_id: null } as Team,
};

const MATCH = {
  id: "m1",
  team_a_id: "t-12",
  team_b_id: "t-34",
  status: "scheduled",
  group_id: "g1",
  created_by: "p1",
} as Match;

/** De tweede baan van dezelfde ronde. */
const BUUR = {
  id: "m2",
  team_a_id: "t-56",
  team_b_id: "t-9x",
  status: "scheduled",
  group_id: "g1",
  created_by: "p1",
} as Match;

function toon(props: Partial<Parameters<typeof BezettingPaneel>[0]> = {}) {
  return render(
    <ToastProvider>
      <BezettingPaneel
        match={MATCH}
        teams={TEAMS}
        profiles={PROFIELEN}
        myId="p1"
        alsBeheerder={false}
        onSaved={() => {}}
        {...props}
      />
    </ToastProvider>,
  );
}

/** De tweede keuzelijst, apart opgezocht: dezelfde naam kan in beide lijsten
 *  staan (wie hier weg mag, kan daar de ruilpartner zijn). */
async function kiesTegenpartij(naar: string) {
  const select = screen.getByLabelText(/wie komt op die plek/i);
  await userEvent.setup().selectOptions(
    select,
    await within(select).findByRole("option", { name: naar }),
  );
}

/** Kiest wie er weg moet en wie ervoor in de plaats komt, en bevestigt. */
async function wijzig(wie: string, naar: string) {
  const user = userEvent.setup();
  await user.selectOptions(
    await screen.findByLabelText(/wie verandert van plek/i),
    wie,
  );
  await kiesTegenpartij(naar);
  await user.click(screen.getByRole("button", { name: /bezetting wijzigen/i }));
  await user.click(screen.getByRole("button", { name: /^wijzigen$/i }));
}

describe("<BezettingPaneel /> (#1327)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("vervangt een speler door iemand die nog niet meespeelt", async () => {
    toon();
    await wijzig("p2", "Speler P5");
    expect(beheer.wisselSpeler).toHaveBeenCalledWith(
      { matchId: "m1", vanSpeler: "p2", naarSpeler: "p5" },
      false,
    );
    expect(beheer.ruilSpelers).not.toHaveBeenCalled();
  });

  it("wisselt van team met iemand uit het andere team van dezelfde wedstrijd", async () => {
    toon();
    await wijzig("p2", "Speler P3");
    // Beide kanten dezelfde match: dát is wat de RPC als "van team wisselen"
    // leest.
    expect(beheer.ruilSpelers).toHaveBeenCalledWith(
      { matchA: "m1", spelerA: "p2", matchB: "m1", spelerB: "p3" },
      false,
    );
    expect(beheer.wisselSpeler).not.toHaveBeenCalled();
  });

  it("ruilt met een speler van een andere baan", async () => {
    toon({ buurmatches: [MATCH, BUUR] });
    await wijzig("p2", "Speler P5");
    expect(beheer.ruilSpelers).toHaveBeenCalledWith(
      { matchA: "m1", spelerA: "p2", matchB: "m2", spelerB: "p5" },
      false,
    );
  });

  it("biedt de teamgenoot niet aan — die ruil verandert niets", async () => {
    toon();
    const user = userEvent.setup();
    await user.selectOptions(
      await screen.findByLabelText(/wie verandert van plek/i),
      "p2",
    );
    // p1 speelt mét p2 in team A. De RPC weigert dat ("staan al in hetzelfde
    // team"), dus de lijst hoort hem niet eens te tonen.
    const naar = screen.getByLabelText(/wie komt op die plek/i);
    expect(
      [...naar.querySelectorAll("option")].map((o) => o.textContent),
    ).not.toContain("Speler P1");
  });

  it("waarschuwt dat de ratings herberekend worden bij een gespeelde wedstrijd", async () => {
    const user = userEvent.setup();
    toon({ match: { ...MATCH, status: "completed" } as Match });
    await user.selectOptions(
      await screen.findByLabelText(/wie verandert van plek/i),
      "p2",
    );
    await kiesTegenpartij("Speler P5");
    await user.click(
      screen.getByRole("button", { name: /bezetting wijzigen/i }),
    );
    expect(
      screen.getByText(/alle ratings worden opnieuw berekend/i),
    ).toBeTruthy();
  });

  it("gaat langs het beheerderspad wanneer het recht daar vandaan komt", async () => {
    toon({ alsBeheerder: true });
    expect(
      await screen.findByText(/als beheerder van de app/i),
    ).toBeTruthy();
    await wijzig("p2", "Speler P5");
    expect(beheer.wisselSpeler).toHaveBeenCalledWith(expect.anything(), true);
  });

  it("sluit de gastheer pas na een gelukte wijziging", async () => {
    const onKlaar = vi.fn();
    const onSaved = vi.fn();
    toon({ onKlaar, onSaved });
    await wijzig("p2", "Speler P5");
    expect(onSaved).toHaveBeenCalled();
    expect(onKlaar).toHaveBeenCalled();
  });

  it("houdt de gastheer open wanneer de server weigert", async () => {
    beheer.wisselSpeler.mockRejectedValueOnce(
      new Error("Die speler staat al in deze match"),
    );
    const onKlaar = vi.fn();
    toon({ onKlaar });
    await wijzig("p2", "Speler P5");
    expect(onKlaar).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/die speler staat al in deze match/i),
    ).toBeTruthy();
  });
});
