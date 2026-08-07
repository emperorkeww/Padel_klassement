import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { Mock } from "vitest";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

// De function-mock beslist per `action` wat er terugkomt, zodat één test kan
// nagaan dat er ná een afwijzende whoami niets meer gevraagd wordt.
const GEBRUIKERS = [
  {
    id: "u1",
    username: "stil",
    full_name: "Stille Sien",
    avatar_url: null,
    is_guest: false,
    owner_id: null,
    email: "sien@test.nl",
    created_at: "2026-02-01T10:00:00Z",
    last_sign_in_at: null,
    email_confirmed_at: null,
    banned_until: null,
    is_admin: false,
    aantal_groepen: 0,
    aantal_matches: 0,
    aantal_gasten: 0,
  },
  {
    id: "u2",
    username: "bob",
    full_name: "Bob Bakker",
    avatar_url: null,
    is_guest: false,
    owner_id: null,
    email: "bob@test.nl",
    created_at: "2026-03-01T10:00:00Z",
    last_sign_in_at: "2026-08-01T10:00:00Z",
    email_confirmed_at: "2026-03-01T10:00:00Z",
    banned_until: null,
    is_admin: true,
    aantal_groepen: 2,
    aantal_matches: 12,
    aantal_gasten: 0,
  },
];

// Inhoud (#1159): één afgeronde match in een groep waar de beheerder niet in
// zit — precies het geval dat via de gewone RLS onzichtbaar blijft.
const MATCHES = [
  {
    id: "m1",
    played_at: "2026-08-01T18:00:00Z",
    created_at: "2026-08-01T17:00:00Z",
    status: "completed",
    score_a: 6,
    score_b: 3,
    set_scores: null,
    winner_team_id: "ta",
    team_a_id: "ta",
    team_b_id: "tb",
    group_id: "grp1",
    groep_naam: "Vrijdagavond Padel",
    team_a_spelers: ["alice", "bob"],
    team_b_spelers: ["carol", "dave"],
    created_by: "u2",
    aanmaker_username: "bob",
    totaal: 743,
  },
];

const LEDEN = [
  {
    player_id: "u2",
    username: "bob",
    full_name: "Bob Bakker",
    role: "owner",
    is_guest: false,
    joined_at: "2026-01-01T10:00:00Z",
    is_eigenaar: true,
  },
  {
    player_id: "u1",
    username: "stil",
    full_name: "Stille Sien",
    role: "member",
    is_guest: false,
    joined_at: "2026-02-01T10:00:00Z",
    is_eigenaar: false,
  },
  {
    player_id: "g1",
    username: "gastje",
    full_name: "Gastje G",
    role: "member",
    is_guest: true,
    joined_at: "2026-03-01T10:00:00Z",
    is_eigenaar: false,
  },
];

const AUDIT = [
  {
    id: 9,
    actor_id: "u2",
    actor_username: "bob",
    action: "update_match_score",
    target_user_id: null,
    target_username: null,
    target_type: "match",
    target_id: "m1",
    details: { groep: "Vrijdagavond Padel", oude_uitslag: "6-3", nieuwe_uitslag: "3-6" },
    created_at: "2026-08-02T10:00:00Z",
  },
];

const inhoudCalls: Record<string, unknown>[] = [];

let isAdminAntwoord = true;

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return {
    supabase: makeSupabaseMock({
      session: SESSION,
      functions: {
        "admin-users": (body: unknown) => {
          const actie = (body as { action?: string }).action;
          if (actie === "whoami") return { admin: isAdminAntwoord };
          if (actie === "list_users") return { users: GEBRUIKERS };
          if (actie === "audit_log") return { regels: [] };
          if (actie === "list_guests") {
            return {
              gasten: [
                {
                  id: "g1",
                  username: "gastje",
                  full_name: "Gastje G",
                  created_at: "2026-04-01T10:00:00Z",
                  owner_id: "u2",
                  owner_username: "bob",
                  aantal_matches: 4,
                  open_claim: {
                    player_id: "u1",
                    player_username: "stil",
                    requested_by: "u2",
                    created_at: "2026-05-01T10:00:00Z",
                  },
                },
              ],
            };
          }
          if (actie === "list_groups") {
            return {
              groepen: [
                {
                  id: "grp1",
                  name: "Vrijdagavond Padel",
                  created_at: "2026-01-01T10:00:00Z",
                  created_by: "u2",
                  eigenaar_username: "bob",
                  aantal_leden: 6,
                  aantal_matches: 12,
                  laatste_match: "2026-07-28T18:00:00Z",
                },
                {
                  id: "grp2",
                  name: "Verweesde Club",
                  created_at: "2026-01-01T10:00:00Z",
                  created_by: null,
                  eigenaar_username: null,
                  aantal_leden: 3,
                  aantal_matches: 0,
                  laatste_match: null,
                },
              ],
            };
          }
          if (actie === "user_detail") {
            return {
              detail: {
                groepen: [
                  {
                    id: "g1",
                    name: "Vrijdagavond Padel",
                    role: "owner",
                    joined_at: "2026-03-01T10:00:00Z",
                    is_eigenaar: true,
                  },
                ],
                matches: [],
                gasten: [],
                push_subscripties: 0,
              },
            };
          }
          return null;
        },
        // De tweede beheerfunction (#1159): matches, groepen en polls.
        "admin-content": (body: unknown) => {
          const { action, ...rest } = body as Record<string, unknown>;
          if (action === "list_matches") {
            return { matches: MATCHES, totaal: 743 };
          }
          if (action === "list_group_members") return { leden: LEDEN };
          if (action === "list_polls") return { polls: [] };
          if (action === "audit_recent") return { regels: AUDIT };
          // De mutaties: onthouden wát er gevraagd is, zodat een test kan
          // nagaan dat de winnaar uit de score volgt in plaats van los
          // meegestuurd te worden.
          inhoudCalls.push({ action: String(action), ...rest });
          return { ok: true };
        },
      },
    }),
  };
});

import { AdminPaneel } from "./AdminPaneel";
import { supabase } from "@/lib/supabase/client";
import { invalidateAll } from "@/lib/supabase/queryCache";

function renderPaneel() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <AdminPaneel />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function invokes() {
  return (supabase.functions.invoke as Mock).mock.calls;
}

describe("<AdminPaneel />", () => {
  beforeEach(() => {
    // whoami en de lijst worden gecachet; zonder legen ziet de tweede test
    // het antwoord van de eerste.
    invalidateAll();
    (supabase.functions.invoke as Mock).mockClear();
    isAdminAntwoord = true;
  });

  it("toont de gebruikerslijst met e-mail, aanmelddatum en laatste login", async () => {
    renderPaneel();
    expect(await screen.findByText("Bob Bakker")).toBeInTheDocument();
    expect(screen.getByText("bob@test.nl")).toBeInTheDocument();
    expect(screen.getByText("Stille Sien")).toBeInTheDocument();
    // "nooit ingelogd" is de vraag waarvoor dit paneel bestaat; die moet in de
    // lijst zelf te zien zijn en niet pas in een detailscherm.
    expect(screen.getByText("nooit")).toBeInTheDocument();
  });

  it("toont 'Geen toegang' en haalt geen gebruikers op voor een niet-beheerder", async () => {
    isAdminAntwoord = false;
    renderPaneel();
    expect(await screen.findByText("Geen toegang")).toBeInTheDocument();
    // De harde eis uit #1036: de route laadt geen data zonder rechten. Alleen
    // de whoami-vraag mag over de lijn zijn gegaan.
    const acties = invokes().map((c) => (c[1] as { body: { action: string } }).body.action);
    expect(acties).toEqual(["whoami"]);
  });

  it("filtert de lijst met het zoekveld", async () => {
    renderPaneel();
    await screen.findByText("Bob Bakker");
    await userEvent.type(
      screen.getByPlaceholderText(/Zoek op naam/),
      "sien",
    );
    expect(screen.queryByText("Bob Bakker")).not.toBeInTheDocument();
    expect(screen.getByText("Stille Sien")).toBeInTheDocument();
  });

  it("opent het detailpaneel bij een klik op een naam", async () => {
    renderPaneel();
    await userEvent.click(await screen.findByRole("button", { name: /Bob Bakker/ }));
    expect(await screen.findByText("Vrijdagavond Padel")).toBeInTheDocument();
  });
});

// Tabbladen en filterchips (#1036 deel 3).
describe("<AdminPaneel /> tabbladen en filters (#1036)", () => {
  beforeEach(() => {
    invalidateAll();
    (supabase.functions.invoke as Mock).mockClear();
    isAdminAntwoord = true;
  });

  it("filtert op *nooit ingelogd* en laat gasten daarbuiten", async () => {
    renderPaneel();
    await screen.findByText("Bob Bakker");
    await userEvent.click(screen.getByRole("button", { name: /nooit ingelogd/i }));
    expect(screen.getByText("Stille Sien")).toBeInTheDocument();
    expect(screen.queryByText("Bob Bakker")).not.toBeInTheDocument();
  });

  it("stapelt filters als EN, niet als OF", async () => {
    renderPaneel();
    await screen.findByText("Bob Bakker");
    await userEvent.click(screen.getByRole("button", { name: /geen groep/i }));
    await userEvent.click(screen.getByRole("button", { name: /geen match/i }));
    // Alleen Sien heeft 0 groepen én 0 matches.
    expect(screen.getByText("Stille Sien")).toBeInTheDocument();
    expect(screen.queryByText("Bob Bakker")).not.toBeInTheDocument();
  });

  it("zet een chip weer uit bij een tweede klik", async () => {
    renderPaneel();
    await screen.findByText("Bob Bakker");
    const chip = screen.getByRole("button", { name: /geen groep/i });
    await userEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Bob Bakker")).toBeInTheDocument();
  });

  it("laadt het gastenoverzicht pas als je dat tabblad opent", async () => {
    renderPaneel();
    await screen.findByText("Bob Bakker");
    const acties = () =>
      (supabase.functions.invoke as Mock).mock.calls.map(
        (c) => (c[1] as { body: { action: string } }).body.action,
      );
    expect(acties()).not.toContain("list_guests");

    await userEvent.click(screen.getByRole("tab", { name: /gasten/i }));
    expect(await screen.findByText("Gastje G")).toBeInTheDocument();
    // Eigenaar en het openstaande koppelverzoek staan erbij.
    expect(screen.getByText("@bob")).toBeInTheDocument();
    expect(screen.getByText(/wacht op @stil/i)).toBeInTheDocument();
  });

  it("markeert in het groepenoverzicht de groep zonder eigenaar", async () => {
    renderPaneel();
    await screen.findByText("Bob Bakker");
    await userEvent.click(screen.getByRole("tab", { name: /groepen/i }));

    expect(await screen.findByText("Verweesde Club")).toBeInTheDocument();
    // Een groep zonder created_by is permanent onbeheerbaar; dat mag niet als
    // een leeg celletje wegvallen — er hoort een waarschuwing bovenaan én een
    // markering op de rij zelf te staan.
    expect(
      screen.getByText(/groep zonder eigenaar\. Die is niet meer te/i),
    ).toBeInTheDocument();
    expect(screen.getByText("geen eigenaar")).toBeInTheDocument();
  });

  it("toont in het groepenoverzicht geen hernoem-knop — dat blijft bij de eigenaar", async () => {
    renderPaneel();
    await screen.findByText("Bob Bakker");
    await userEvent.click(screen.getByRole("tab", { name: /groepen/i }));
    await screen.findByText("Verweesde Club");
    // Het dagelijkse groepsbeheer blijft bij de eigenaar (#978). Wat #1159
    // toevoegt, is precies wat de eigenaar zélf niet kan; hernoemen hoort daar
    // niet bij en mag hier dus ook niet opduiken.
    expect(screen.queryByRole("button", { name: /hernoemen/i })).toBeNull();
  });
});

// Inhoudsbeheer (#1159).
describe("<AdminPaneel /> matches, groepsacties en logboek (#1159)", () => {
  beforeEach(() => {
    invalidateAll();
    (supabase.functions.invoke as Mock).mockClear();
    inhoudCalls.length = 0;
    isAdminAntwoord = true;
  });

  it("laadt de matches pas als je dat tabblad opent, en meldt wat er níet getoond wordt", async () => {
    renderPaneel();
    await screen.findByText("Bob Bakker");
    const acties = () =>
      (supabase.functions.invoke as Mock).mock.calls.map(
        (c) => (c[1] as { body: { action: string } }).body.action,
      );
    expect(acties()).not.toContain("list_matches");

    await userEvent.click(screen.getByRole("tab", { name: /matches/i }));
    expect(await screen.findByText(/alice & bob vs carol & dave/i)).toBeInTheDocument();
    // Ook in de groepenkeuze staat die naam; het gaat hier om de cel in de rij.
    expect(screen.getByRole("cell", { name: "Vrijdagavond Padel" })).toBeInTheDocument();
    // Geen stille afkap: 1 van 743 moet als zodanig te lezen zijn.
    expect(screen.getByText(/1 van 743 getoond/)).toBeInTheDocument();
  });

  it("leidt bij een correctie de winnaar af uit de score", async () => {
    renderPaneel();
    await screen.findByText("Bob Bakker");
    await userEvent.click(screen.getByRole("tab", { name: /matches/i }));
    await userEvent.click(
      await screen.findByRole("button", { name: /alice & bob vs carol & dave/i }),
    );

    // 6-3 wordt 3-6: de winnaar moet meeschuiven naar team B, anders staat er
    // een uitslag in het klassement die niet bij de winnaar hoort.
    // spinbutton en niet getByLabelText: de ±-knoppen van de stepper dragen
    // hetzelfde label als voorvoegsel.
    const scoreA = screen.getByRole("spinbutton", { name: "Score alice & bob" });
    await userEvent.clear(scoreA);
    await userEvent.type(scoreA, "3");
    const scoreB = screen.getByRole("spinbutton", { name: "Score carol & dave" });
    await userEvent.clear(scoreB);
    await userEvent.type(scoreB, "6");
    await userEvent.click(screen.getByRole("button", { name: /uitslag opslaan/i }));

    const call = inhoudCalls.find((c) => c.action === "update_match_score");
    expect(call).toMatchObject({
      match_id: "m1",
      score_a: 3,
      score_b: 6,
      winner_team_id: "tb",
    });
  });

  it("zegt er in het matchpaneel bij dat je als beheerder ingrijpt", async () => {
    renderPaneel();
    await screen.findByText("Bob Bakker");
    await userEvent.click(screen.getByRole("tab", { name: /matches/i }));
    await userEvent.click(
      await screen.findByRole("button", { name: /alice & bob vs carol & dave/i }),
    );
    // Onzichtbaar ingrijpen in andermans groep is precies wat je niet wilt.
    expect(
      screen.getByText(/als beheerder van de app, niet als deelnemer/i),
    ).toBeInTheDocument();
  });

  it("biedt een stuurloze groep een nieuwe eigenaar aan, en gasten niet", async () => {
    renderPaneel();
    await screen.findByText("Bob Bakker");
    await userEvent.click(screen.getByRole("tab", { name: /groepen/i }));
    await userEvent.click(await screen.findByRole("button", { name: "Verweesde Club" }));

    expect(
      await screen.findByText(/geen eigenaar en is daardoor onbeheerbaar/i),
    ).toBeInTheDocument();
    // Een gast heeft geen account en zou de groep meteen weer stuurloos maken.
    const opties = screen
      .getAllByRole("option")
      .map((o) => o.textContent ?? "");
    expect(opties.some((t) => t.includes("@stil"))).toBe(true);
    expect(opties.some((t) => t.includes("@gastje"))).toBe(false);
    // En de eigenaar zelf staat er niet tussen — die ís het al.
    expect(opties.some((t) => t.includes("@bob"))).toBe(false);
  });

  it("draagt het eigenaarschap over via de function", async () => {
    renderPaneel();
    await screen.findByText("Bob Bakker");
    await userEvent.click(screen.getByRole("tab", { name: /groepen/i }));
    await userEvent.click(await screen.findByRole("button", { name: "Verweesde Club" }));

    await userEvent.selectOptions(
      await screen.findByRole("combobox"),
      "u1",
    );
    await userEvent.click(screen.getByRole("button", { name: /eigenaar maken/i }));

    expect(inhoudCalls.find((c) => c.action === "set_group_owner")).toMatchObject({
      group_id: "grp2",
      user_id: "u1",
    });
  });

  it("toont het logboek met de leesbare actienaam en de details", async () => {
    renderPaneel();
    await screen.findByText("Bob Bakker");
    await userEvent.click(screen.getByRole("tab", { name: /logboek/i }));

    expect(await screen.findByText("Uitslag gecorrigeerd")).toBeInTheDocument();
    expect(screen.getByText(/oude uitslag: 6-3/)).toBeInTheDocument();
  });
});
