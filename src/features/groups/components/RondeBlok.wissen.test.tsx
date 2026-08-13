import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";
import type { Match, Profile, Team } from "@/types";

// #1271 — er was geen weg terug.
//
// Een verkeerd gegenereerde ronde moest match voor match weg via ⋯ →
// "Verwijderen", met zes seconden undo, keer drie banen keer N rondes. En een
// late afmelding ging nergens over: de ja-stemmen werden herladen, maar dat
// veranderde alleen de standaardselectie voor de vólgende generatie — de ronde
// die al klaarstond bleef staan met iemand erin die niet komt.

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: {} }) };
});

import { RondeBlok } from "./RondeBlok";
import { MATCH_PLANNED, PROFILES, TEAMS } from "@/test/fixtures";

const tmap = Object.fromEntries(TEAMS.map((t) => [t.id, t])) as Record<
  string,
  Team
>;
const pmap = Object.fromEntries(PROFILES.map((p) => [p.id, p])) as Record<
  string,
  Profile
>;

const GEPLAND = {
  ...MATCH_PLANNED,
  id: "m-1",
  round_number: 2,
  played_at: "2026-09-04T18:00:00.000Z",
} as Match;

const KLAAR = { ...GEPLAND, id: "m-2", status: "completed" } as Match;

function toon(over: Partial<Parameters<typeof RondeBlok>[0]> = {}) {
  const onWissen = vi.fn();
  render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <RondeBlok
            round={2}
            list={[GEPLAND]}
            open
            onToggle={() => {}}
            teams={tmap}
            profiles={pmap}
            myId="p1"
            isOwner
            matches={[GEPLAND]}
            intensiteit="radioactief"
            upsets={new Map()}
            onMatches={() => {}}
            onWissen={onWissen}
            {...over}
          />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
  return { onWissen };
}

describe("<RondeBlok /> weg terug (#1271)", () => {
  it("biedt een wisknop op een ronde zonder uitslagen", async () => {
    const { onWissen } = toon();
    await userEvent.click(screen.getByRole("button", { name: /^wissen$/i }));
    expect(onWissen).toHaveBeenCalledOnce();
  });

  it("verbergt hem zodra er een uitslag in staat", () => {
    // Dan raakt wissen de stand en de Elo-keten; dat gaat per match, met de
    // undo-strook erbij.
    toon({ list: [KLAAR] });
    expect(screen.queryByRole("button", { name: /^wissen$/i })).toBeNull();
  });

  it("laat losse matches met rust", () => {
    // Ronde 0 is geen ronde maar een verzamelbak.
    toon({ round: 0 });
    expect(screen.queryByRole("button", { name: /^wissen$/i })).toBeNull();
  });

  it("meldt wie zich afmeldde en wat je eraan kunt doen", () => {
    // p1 speelt mee in de fixture-match.
    toon({ afgemeld: new Set(["p1"]) });
    const melding = screen.getByText(/heeft zich afgemeld/i);
    expect(melding).toHaveTextContent(/wis deze ronde en genereer opnieuw/i);
  });

  it("zwijgt over een afmelding bij een ronde die al gespeeld is", () => {
    toon({ list: [KLAAR], afgemeld: new Set(["p1"]) });
    expect(screen.queryByText(/afgemeld/i)).toBeNull();
  });
});
