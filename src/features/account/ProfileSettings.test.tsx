import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { TABLES, SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: TABLES }) };
});

// De push-module is de natuurlijke seam: browser-API's (service worker,
// PushManager) bestaan niet in jsdom, dus we mocken op moduleniveau.
vi.mock("@/lib/supabase/push", () => ({
  pushAvailability: vi.fn(() => "unsupported"),
  getPushSubscription: vi.fn(() => Promise.resolve(null)),
  enablePush: vi.fn(() => Promise.resolve()),
  disablePush: vi.fn(() => Promise.resolve()),
}));

import ProfileSettings from "./ProfileSettings";
import { supabase } from "@/lib/supabase/client";
import {
  disablePush,
  enablePush,
  getPushSubscription,
  pushAvailability,
} from "@/lib/supabase/push";
import { SESSION } from "@/test/fixtures";
import * as profilesApi from "@/features/profiles/api";

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <ProfileSettings />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("<ProfileSettings />", () => {
  it("toont profiel-, naam-, e-mail- en wachtwoordkaarten", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: /^profiel$/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/profielfoto/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("alice")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Alice Anders")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /e-mailadres/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /wachtwoord wijzigen/i }),
    ).toBeInTheDocument();
  });

  it("wisselt het thema via de weergavekaart", async () => {
    // jsdom kent geen matchMedia; alleen nodig zodra de keuze "systeem" is.
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    try {
      renderPage();
      expect(
        await screen.findByRole("heading", { name: /weergave/i }),
      ).toBeInTheDocument();
      const donker = screen.getByRole("radio", { name: /donker/i });
      await userEvent.click(donker);
      expect(donker).toHaveAttribute("aria-checked", "true");
      expect(document.documentElement.dataset.theme).toBe("dark");

      await userEvent.click(screen.getByRole("radio", { name: /licht/i }));
      expect(document.documentElement.dataset.theme).toBe("light");
    } finally {
      vi.unstubAllGlobals();
      delete document.documentElement.dataset.theme;
    }
  });

  it("zet de waarnemend dictator (Mbappé) uit via de weergavekaart (#542)", async () => {
    // Cross-device voorkeur: de toggle schrijft naar de profiles-kolom via
    // updateProfile. Het profiel heeft standaard geen waarde → aangevinkt.
    const spy = vi.spyOn(profilesApi, "updateProfile").mockResolvedValue();
    try {
      renderPage();
      const toggle = await screen.findByRole("checkbox", {
        name: /waarnemend dictator/i,
      });
      expect(toggle).toBeChecked();

      await userEvent.click(toggle);
      expect(spy).toHaveBeenCalledWith("p1", {
        toon_waarnemend_dictator: false,
      });
    } finally {
      spy.mockRestore();
    }
  });

  it("slaat een nieuwe naam op", async () => {
    renderPage();
    const veld = await screen.findByDisplayValue("Alice Anders");
    await userEvent.clear(veld);
    await userEvent.type(veld, "Alice A. Anders");
    await userEvent.click(screen.getAllByRole("button", { name: /^opslaan$/i })[1]);
    expect(await screen.findByText(/naam bijgewerkt/i)).toBeInTheDocument();
  });

  it("wijzigt het e-mailadres via supabase auth", async () => {
    renderPage();
    await screen.findByRole("heading", { name: /e-mailadres/i });
    await userEvent.type(
      screen.getByPlaceholderText(/nieuw@voorbeeld/i),
      "alice@nieuw.nl",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /e-mail wijzigen/i }),
    );
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      email: "alice@nieuw.nl",
    });
  });

  it("verifieert het huidige wachtwoord vóór wijziging", async () => {
    renderPage();
    await screen.findByRole("heading", { name: /e-mailadres/i });
    await userEvent.type(screen.getByLabelText(/huidig wachtwoord/i), "geheim1");
    await userEvent.type(screen.getByLabelText(/^nieuw wachtwoord$/i), "geheim2");
    await userEvent.type(
      screen.getByLabelText(/bevestig nieuw wachtwoord/i),
      "geheim2",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /wachtwoord wijzigen/i }),
    );
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "alice@example.com",
      password: "geheim1",
    });
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      password: "geheim2",
    });
  });
});

describe("<ProfileSettings /> — meldingen (#412)", () => {
  afterEach(() => {
    // Terug naar de defaults uit de mock-factory, zodat de overige tests
    // (die dezelfde pagina renderen) niets van deze scenario's merken.
    vi.mocked(pushAvailability).mockReturnValue("unsupported");
    vi.mocked(getPushSubscription).mockResolvedValue(null);
    vi.mocked(enablePush).mockReset();
    vi.mocked(enablePush).mockResolvedValue(undefined);
    vi.mocked(disablePush).mockReset();
    vi.mocked(disablePush).mockResolvedValue(undefined);
  });

  it("toont op iOS zonder installatie een gerichte beginscherm-instructie", async () => {
    vi.mocked(pushAvailability).mockReturnValue("needs-install");
    renderPage();
    expect(
      await screen.findByText(/zet op beginscherm/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /meldingen aanzetten/i }),
    ).not.toBeInTheDocument();
  });

  it("legt bij geweigerde permissie uit waar je die weer aanzet", async () => {
    vi.mocked(pushAvailability).mockReturnValue("denied");
    renderPage();
    expect(await screen.findByText(/geweigerd/i)).toBeInTheDocument();
    expect(screen.getByText(/instellingen → meldingen/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /meldingen aanzetten/i }),
    ).not.toBeInTheDocument();
  });

  it("meldt kort dat het niet kan in een niet-ondersteunde browser", async () => {
    renderPage();
    expect(
      await screen.findByText(/in deze browser niet ondersteund/i),
    ).toBeInTheDocument();
  });

  it("komt uit 'Controleren…' zodra bekend is dat er geen abonnement is", async () => {
    vi.mocked(pushAvailability).mockReturnValue("ready");
    renderPage();
    const knop = await screen.findByRole("button", {
      name: /meldingen aanzetten/i,
    });
    expect(knop).toBeEnabled();
  });

  it("zet meldingen aan en toont een bevestiging", async () => {
    vi.mocked(pushAvailability).mockReturnValue("ready");
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: /meldingen aanzetten/i }),
    );
    expect(enablePush).toHaveBeenCalledWith(SESSION.user.id);
    expect(await screen.findByText(/vamos/i)).toBeInTheDocument();
  });

  it("zet meldingen uit bij een bestaand abonnement", async () => {
    vi.mocked(pushAvailability).mockReturnValue("ready");
    vi.mocked(getPushSubscription).mockResolvedValue({
      endpoint: "https://push.example/abc",
    } as PushSubscription);
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: /meldingen uitzetten/i }),
    );
    expect(disablePush).toHaveBeenCalled();
    expect(await screen.findByText(/uitgeschakeld/i)).toBeInTheDocument();
  });

  it("toont de foutmelding wanneer aanzetten mislukt", async () => {
    vi.mocked(pushAvailability).mockReturnValue("ready");
    vi.mocked(enablePush).mockRejectedValue(
      new Error("Meldingen zijn geweigerd — zet ze aan via Instellingen."),
    );
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: /meldingen aanzetten/i }),
    );
    expect(
      await screen.findByText(/meldingen zijn geweigerd/i),
    ).toBeInTheDocument();
  });
});

describe("<ProfileSettings /> — notificatie-voorkeuren (#57)", () => {
  // De fixture-profielen hebben de notify_*-kolommen niet; de ?? true-defaults
  // in getNotificationPrefs moeten dan "alles aan" opleveren.
  it("toont vier per-type toggles, standaard aangevinkt — ook zonder push-support", async () => {
    // pushAvailability is standaard "unsupported": bewijst dat de voorkeuren
    // zichtbaar blijven als push op dít apparaat niet kan.
    renderPage();
    expect(
      await screen.findByRole("heading", { name: /welke meldingen wil je/i }),
    ).toBeInTheDocument();
    const toggles = [
      await screen.findByRole("checkbox", { name: /nieuwe ronde/i }),
      screen.getByRole("checkbox", { name: /uitslagen/i }),
      // Niet op /vriendschapsverzoeken/ matchen: de privacykaart heeft ook
      // een toggle "Vriendschapsverzoeken toestaan" — de hint is uniek.
      screen.getByRole("checkbox", { name: /verzoek stuurt/i }),
      screen.getByRole("checkbox", { name: /match-herinneringen/i }),
    ];
    for (const t of toggles) expect(t).toBeChecked();
  });

  it("slaat een uitgezette voorkeur op en bevestigt met een toast", async () => {
    renderPage();
    await userEvent.click(
      await screen.findByRole("checkbox", { name: /nieuwe ronde/i }),
    );
    expect(await screen.findByText(/meldingen bijgewerkt/i)).toBeInTheDocument();
  });
});
