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

  it("toont in het groepenoverzicht geen enkele muterende knop", async () => {
    renderPaneel();
    await screen.findByText("Bob Bakker");
    await userEvent.click(screen.getByRole("tab", { name: /groepen/i }));
    await screen.findByText("Verweesde Club");
    // Groepsbeheer blijft bij de eigenaar (#978); dit tabblad is alleen lezen.
    for (const naam of [/verwijderen/i, /hernoemen/i, /overdragen/i]) {
      expect(screen.queryByRole("button", { name: naam })).toBeNull();
    }
  });
});
