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

import { VarBlock } from "@/features/matches/components/VarBlock";
import { MATCH_DONE, PROFILES, TEAMS } from "@/test/fixtures";
import type { Match, Profile, Team } from "@/types";

const pmap = Object.fromEntries(PROFILES.map((p) => [p.id, p])) as Record<
  string,
  Profile
>;
const tmap = Object.fromEntries(TEAMS.map((t) => [t.id, t])) as Record<
  string,
  Team
>;

const EEN_UUR_GELEDEN = new Date(Date.now() - 3600_000).toISOString();

/** MATCH_DONE ligt in het verleden; het VAR-venster duurt 24 uur. */
function verseMatch(over: Partial<Match> = {}): Match {
  return { ...MATCH_DONE, played_at: EEN_UUR_GELEDEN, ...over } as Match;
}

function zaak(over: Record<string, unknown> = {}) {
  return {
    id: "va-1",
    match_id: MATCH_DONE.id,
    claimant_id: "p3",
    set_number: null,
    reden: "ons-punt",
    toelichting: "die bal was binnen",
    status: "open",
    snapshot_a: 6,
    snapshot_b: 3,
    play_date: "2026-08-04",
    votes_close_at: new Date(Date.now() + 3600_000).toISOString(),
    resolved_at: null,
    created_at: EEN_UUR_GELEDEN,
    ...over,
  };
}

function toon(match: Match = verseMatch(), myId: string | null = "p1") {
  return render(
    <ToastProvider>
      <VarBlock
        match={match}
        teams={tmap}
        profiles={pmap}
        myId={myId}
        onChanged={() => {}}
      />
    </ToastProvider>,
  );
}

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key];
  tables.point_appeals = [];
  tables.point_appeal_votes = [];
});

describe("<VarBlock /> zonder lopende zaak", () => {
  it("biedt een deelnemer aan een punt te betwisten", async () => {
    toon();
    expect(
      await screen.findByRole("button", { name: /punt betwisten/i }),
    ).toBeInTheDocument();
  });

  it("blijft weg bij wie niet meespeelde", async () => {
    toon(verseMatch(), "p9");
    // Even wachten tot de queries binnen zijn; er hoort niets te verschijnen.
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByLabelText("Rudy's VAR")).toBeNull();
  });

  it("blijft weg zodra het venster van 24 uur gesloten is", async () => {
    const oud = verseMatch({
      played_at: new Date(Date.now() - 25 * 3600_000).toISOString(),
    });
    toon(oud);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByLabelText("Rudy's VAR")).toBeNull();
  });

  it("blijft weg op een match die nog gespeeld moet worden", async () => {
    toon(verseMatch({ status: "scheduled" }));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByLabelText("Rudy's VAR")).toBeNull();
  });
});

describe("<VarBlock /> met een lopende zaak", () => {
  it("toont de claim en wat er met de stand zou gebeuren", async () => {
    tables.point_appeals = [zaak()];
    toon();
    expect(await screen.findByText(/betwist één punt/i)).toHaveTextContent(
      "Carol",
    );
    expect(screen.getByText("6 – 3")).toBeInTheDocument();
    expect(screen.getByText("5 – 4")).toBeInTheDocument();
  });

  it("waarschuwt met zoveel woorden als de winnaar omdraait", async () => {
    tables.point_appeals = [zaak({ snapshot_a: 6, snapshot_b: 5 })];
    toon(verseMatch({ score_a: 6, score_b: 5 }));
    expect(
      await screen.findByText(/draait de winnaar om/i),
    ).toBeInTheDocument();
  });

  it("laat een stemgerechtigde kiezen tussen klopt en onzin", async () => {
    tables.point_appeals = [zaak()];
    toon();
    expect(
      await screen.findByRole("button", { name: "Klopt" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Onzin" })).toBeInTheDocument();
  });

  it("laat de klager niet over zijn eigen zaak stemmen", async () => {
    tables.point_appeals = [zaak()];
    toon(verseMatch(), "p3");
    await screen.findByText(/betwist één punt/i);
    expect(screen.queryByRole("button", { name: "Klopt" })).toBeNull();
  });

  it("toont de uitgebrachte stemmen met naam en geen knoppen meer", async () => {
    tables.point_appeals = [zaak()];
    tables.point_appeal_votes = [
      {
        appeal_id: "va-1",
        voter_id: "p1",
        akkoord: true,
        created_at: EEN_UUR_GELEDEN,
      },
    ];
    toon();
    expect(await screen.findByText("Alice Anders")).toBeInTheDocument();
    expect(screen.getByText("Klopt")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Klopt" })).toBeNull();
  });

  it("biedt geen tweede beroep aan zolang er één loopt", async () => {
    tables.point_appeals = [zaak()];
    toon();
    await screen.findByText(/betwist één punt/i);
    expect(screen.queryByRole("button", { name: /punt betwisten/i })).toBeNull();
  });
});

describe("<VarBlock /> na de uitspraak", () => {
  it("vertelt dat het punt verschoven is", async () => {
    tables.point_appeals = [
      zaak({ status: "toegekend", resolved_at: EEN_UUR_GELEDEN }),
    ];
    toon();
    expect(await screen.findByText(/het punt is verschoven/i)).toBeInTheDocument();
  });

  it("noemt een vervallen zaak bij naam in plaats van afgewezen", async () => {
    tables.point_appeals = [
      zaak({ status: "verlopen", resolved_at: EEN_UUR_GELEDEN }),
    ];
    toon();
    expect(
      await screen.findByText(/intussen al gewijzigd/i),
    ).toBeInTheDocument();
  });

  it("zegt het eerlijk als het tegoed op was", async () => {
    tables.point_appeals = [
      zaak({ status: "tegoed-op", resolved_at: EEN_UUR_GELEDEN }),
    ];
    toon();
    expect(
      await screen.findByText(/tegoed was op/i),
    ).toBeInTheDocument();
  });
});
