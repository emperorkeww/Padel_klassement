import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Mock } from "vitest";
import { ToastProvider } from "@/ui/ToastProvider";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  return {
    supabase: makeSupabaseMock({
      functions: {
        "admin-users": (body: unknown) => {
          const { action } = body as { action: string };
          if (action === "recovery_link") {
            return {
              link: "https://vamos.test/auth/bevestigen?token_hash=xyz&type=recovery",
              vervalt_over_minuten: 60,
            };
          }
          if (action === "temp_password") return { wachtwoord: "bal-boom-zon7" };
          if (action === "delete_user") return { ok: true, groepen_zonder_eigenaar: 1 };
          if (action === "export_user") {
            return {
              export: { profiel: { username: "alice" }, matches: [], groepen: [] },
            };
          }
          return { ok: true };
        },
      },
    }),
  };
});

import { GebruikerActies } from "./GebruikerActies";
import { supabase } from "@/lib/supabase/client";
import { invalidateAll } from "@/lib/supabase/queryCache";
import type { AdminDetail, AdminGebruiker } from "../types";

const GEBRUIKER: AdminGebruiker = {
  id: "u1",
  username: "alice",
  full_name: "Alice Anders",
  avatar_url: null,
  is_guest: false,
  owner_id: null,
  email: "alice@test.nl",
  created_at: "2026-02-01T10:00:00Z",
  last_sign_in_at: null,
  email_confirmed_at: null,
  banned_until: null,
  is_admin: false,
  aantal_groepen: 1,
  aantal_matches: 3,
  aantal_gasten: 2,
};

const DETAIL: AdminDetail = {
  groepen: [
    {
      id: "g1",
      name: "Vrijdagavond Padel",
      role: "owner",
      joined_at: "2026-02-01T10:00:00Z",
      is_eigenaar: true,
    },
  ],
  matches: [],
  gasten: [],
  push_subscripties: 0,
};

function renderActies(onVerwijderd = vi.fn()) {
  render(
    <ToastProvider>
      <GebruikerActies
        gebruiker={GEBRUIKER}
        detail={DETAIL}
        onVerwijderd={onVerwijderd}
      />
    </ToastProvider>,
  );
  return onVerwijderd;
}

function acties() {
  return (supabase.functions.invoke as Mock).mock.calls.map(
    (c) => (c[1] as { body: { action: string } }).body.action,
  );
}

describe("<GebruikerActies /> (#1036)", () => {
  beforeEach(() => {
    invalidateAll();
    (supabase.functions.invoke as Mock).mockClear();
  });

  it("toont de herstel-link met een kopieerknop", async () => {
    renderActies();
    await userEvent.click(screen.getByRole("button", { name: /herstel-link maken/i }));

    const veld = await screen.findByLabelText("Herstel-link");
    expect(veld).toHaveValue(
      "https://vamos.test/auth/bevestigen?token_hash=xyz&type=recovery",
    );
    expect(screen.getByRole("button", { name: "Kopieer" })).toBeInTheDocument();
  });

  it("vraagt eerst om bevestiging vóór een tijdelijk wachtwoord", async () => {
    renderActies();
    await userEvent.click(screen.getByRole("button", { name: /tijdelijk wachtwoord/i }));

    // Nog niets gebeurd: eerst de dialoog.
    expect(acties()).not.toContain("temp_password");
    await userEvent.click(await screen.findByRole("button", { name: "Zetten" }));

    expect(await screen.findByLabelText("Tijdelijk wachtwoord")).toHaveValue(
      "bal-boom-zon7",
    );
  });

  it("toont het tijdelijke wachtwoord met de waarschuwing over het kanaal", async () => {
    renderActies();
    await userEvent.click(screen.getByRole("button", { name: /tijdelijk wachtwoord/i }));
    await userEvent.click(await screen.findByRole("button", { name: "Zetten" }));

    expect(await screen.findByText(/ligt het wachtwoord in dat kanaal/i)).toBeInTheDocument();
    expect(screen.getByText(/één keer getoond en nergens bewaard/i)).toBeInTheDocument();
  });

  it("vervangt de herstel-link door het wachtwoord — nooit allebei tegelijk", async () => {
    renderActies();
    await userEvent.click(screen.getByRole("button", { name: /herstel-link maken/i }));
    await screen.findByLabelText("Herstel-link");

    await userEvent.click(screen.getByRole("button", { name: /tijdelijk wachtwoord/i }));
    await userEvent.click(await screen.findByRole("button", { name: "Zetten" }));

    await screen.findByLabelText("Tijdelijk wachtwoord");
    expect(screen.queryByLabelText("Herstel-link")).toBeNull();
  });

  it("waarschuwt bij verwijderen voor de groepen die zonder eigenaar achterblijven", async () => {
    renderActies();
    await userEvent.click(screen.getByRole("button", { name: /account verwijderen/i }));

    // De helft van deze knop die je niet ziet aankomen: groups.created_by is
    // `on delete set null`, en dan is de groep voor niemand meer te beheren.
    expect(await screen.findByText(/zonder eigenaar achter/i)).toBeInTheDocument();
    expect(screen.getByText(/Vrijdagavond Padel/)).toBeInTheDocument();
    // En dat er gasten meegaan.
    expect(screen.getByText(/2 gastspeler\(s\) verdwijnen mee/i)).toBeInTheDocument();
  });

  // De missende helft van de waarschuwing (#1049): sinds #1164 is er wél iets
  // aan te doen, maar alleen vóóraf. Ná het verwijderen is created_by null.
  it("wijst bij verwijderen de weg naar eerst overdragen", async () => {
    renderActies();
    await userEvent.click(screen.getByRole("button", { name: /account verwijderen/i }));

    expect(
      await screen.findByText(/Draag ze eerst over/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Eigenaar aanwijzen/i)).toBeInTheDocument();
  });

  it("wijst bij verwijderen op de export, want daarna kan het niet meer", async () => {
    renderActies();
    await userEvent.click(screen.getByRole("button", { name: /account verwijderen/i }));

    expect(
      await screen.findByText(/Na het verwijderen kan dat niet meer/i),
    ).toBeInTheDocument();
  });

  it("exporteert de gegevens van een ander account als JSON", async () => {
    // jsdom kent geen echte downloads; we vangen de blob-URL en de klik.
    const maak = vi.fn(() => "blob:nep");
    const ruim = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL: maak, revokeObjectURL: ruim });
    const klik = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    renderActies();
    await userEvent.click(screen.getByRole("button", { name: /gegevens exporteren/i }));

    await waitFor(() => expect(klik).toHaveBeenCalled());
    expect(maak).toHaveBeenCalled();
    // Opruimen hoort erbij, anders blijft de blob hangen tot de pagina herlaadt.
    expect(ruim).toHaveBeenCalledWith("blob:nep");

    klik.mockRestore();
    vi.unstubAllGlobals();
  });

  it("verwijdert pas als de gebruikersnaam exact overgetikt is", async () => {
    const onVerwijderd = renderActies();
    await userEvent.click(screen.getByRole("button", { name: /account verwijderen/i }));

    const knop = await screen.findByRole("button", { name: /definitief verwijderen/i });
    expect(knop).toBeDisabled();
    expect(acties()).not.toContain("delete_user");

    await userEvent.type(screen.getByRole("textbox"), "alice");
    expect(knop).toBeEnabled();
    await userEvent.click(knop);

    await waitFor(() => expect(acties()).toContain("delete_user"));
    expect(onVerwijderd).toHaveBeenCalled();
  });

  it("stuurt de username mee zodat de server de bevestiging kan hercontroleren", async () => {
    renderActies();
    await userEvent.click(screen.getByRole("button", { name: /account verwijderen/i }));
    await userEvent.type(screen.getByRole("textbox"), "alice");
    await userEvent.click(
      screen.getByRole("button", { name: /definitief verwijderen/i }),
    );

    await waitFor(() => {
      const call = (supabase.functions.invoke as Mock).mock.calls.find(
        (c) => (c[1] as { body: { action: string } }).body.action === "delete_user",
      );
      expect((call?.[1] as { body: Record<string, unknown> }).body).toMatchObject({
        user_id: "u1",
        username: "alice",
      });
    });
  });
});
