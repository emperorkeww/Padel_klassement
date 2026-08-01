import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
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
import { PASSWORD_RULE } from "@/features/auth/authErrors";

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

// De secties zitten sinds #70 achter tabs (Profiel / Meldingen & privacy /
// Account); open eerst de juiste tab voor de kaart die de test nodig heeft.
// Sinds #910 draait die rij op de gedeelde PageTabs: role="tab", geen button.
async function openTab(name: RegExp) {
  await userEvent.click(await screen.findByRole("tab", { name }));
}

describe("<ProfileSettings />", () => {
  it("toont de algemene tab met foto- en naamkaart", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: /^instellingen$/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/profielfoto/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("alice")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Alice Anders")).toBeInTheDocument();
  });

  // De "Ik"-tab en de topbalk-avatar landen hier; zonder deze link is je eigen
  // profielweergave vanaf de instellingen onbereikbaar (#706).
  it("linkt vanuit de kop naar de eigen profielweergave", async () => {
    renderPage();
    const link = await screen.findByRole("link", { name: /mijn profiel/i });
    expect(link).toHaveAttribute("href", `/spelers/${SESSION.user.id}`);
  });

  it("toont e-mail- en wachtwoordkaart onder de accounttab", async () => {
    renderPage();
    await screen.findByText(/profielfoto/i);
    // Standaard staat de algemene tab open; account zit achter een tab.
    expect(
      screen.queryByRole("heading", { name: /e-mailadres/i }),
    ).not.toBeInTheDocument();
    await openTab(/^account$/i);
    expect(
      await screen.findByRole("heading", { name: /e-mailadres/i }),
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
      const toggle = await screen.findByRole("switch", {
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

  it("zet het pias-portret uit via de weergavekaart (#682)", async () => {
    // Losse opt-out van het dictator-portret: aan de troon als generalissimo
    // verschijnen zegt niets over de schandpaal. Standaard aangevinkt.
    const spy = vi.spyOn(profilesApi, "updateProfile").mockResolvedValue();
    try {
      renderPage();
      const toggle = await screen.findByRole("switch", {
        name: /pias-portret/i,
      });
      expect(toggle).toBeChecked();

      await userEvent.click(toggle);
      expect(spy).toHaveBeenCalledWith("p1", { pias_portret: false });
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
    await openTab(/^account$/i);
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
    await openTab(/^account$/i);
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
    await openTab(/meldingen & privacy/i);
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
    await openTab(/meldingen & privacy/i);
    expect(await screen.findByText(/geweigerd/i)).toBeInTheDocument();
    expect(screen.getByText(/instellingen → meldingen/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /meldingen aanzetten/i }),
    ).not.toBeInTheDocument();
  });

  it("meldt kort dat het niet kan in een niet-ondersteunde browser", async () => {
    renderPage();
    await openTab(/meldingen & privacy/i);
    expect(
      await screen.findByText(/in deze browser niet ondersteund/i),
    ).toBeInTheDocument();
  });

  it("komt uit 'Controleren…' zodra bekend is dat er geen abonnement is", async () => {
    vi.mocked(pushAvailability).mockReturnValue("ready");
    renderPage();
    await openTab(/meldingen & privacy/i);
    const knop = await screen.findByRole("button", {
      name: /meldingen aanzetten/i,
    });
    expect(knop).toBeEnabled();
  });

  it("zet meldingen aan en toont een bevestiging", async () => {
    vi.mocked(pushAvailability).mockReturnValue("ready");
    renderPage();
    await openTab(/meldingen & privacy/i);
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
    await openTab(/meldingen & privacy/i);
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
    await openTab(/meldingen & privacy/i);
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
    await openTab(/meldingen & privacy/i);
    expect(
      await screen.findByRole("heading", { name: /welke meldingen wil je/i }),
    ).toBeInTheDocument();
    const toggles = [
      await screen.findByRole("switch", { name: /nieuwe ronde/i }),
      screen.getByRole("switch", { name: /uitslagen/i }),
      // Niet op /vriendschapsverzoeken/ matchen: de privacykaart heeft ook
      // een toggle "Vriendschapsverzoeken toestaan" — de hint is uniek.
      screen.getByRole("switch", { name: /verzoek stuurt/i }),
      screen.getByRole("switch", { name: /match-herinneringen/i }),
    ];
    for (const t of toggles) expect(t).toBeChecked();
  });

  it("slaat een uitgezette voorkeur op en bevestigt met een toast", async () => {
    renderPage();
    await openTab(/meldingen & privacy/i);
    await userEvent.click(
      await screen.findByRole("switch", { name: /nieuwe ronde/i }),
    );
    expect(await screen.findByText(/meldingen bijgewerkt/i)).toBeInTheDocument();
  });
});

describe("<ProfileSettings /> — tabs (#70)", () => {
  function renderAt(path: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <ToastProvider>
            <ProfileSettings />
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>,
    );
  }

  it("opent standaard de algemene tab en verbergt de andere secties", async () => {
    renderAt("/profiel");
    expect(await screen.findByText(/profielfoto/i)).toBeInTheDocument();
    // Privacy- en accountkaarten zitten achter hun eigen tab.
    expect(
      screen.queryByRole("heading", { name: /privacy/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /e-mailadres/i }),
    ).not.toBeInTheDocument();
  });

  it("respecteert een deeplink naar de accounttab (?tab=account)", async () => {
    renderAt("/profiel?tab=account");
    expect(
      await screen.findByRole("heading", { name: /e-mailadres/i }),
    ).toBeInTheDocument();
    // De algemene-tab-inhoud staat dan niet in beeld.
    expect(screen.queryByText(/profielfoto/i)).not.toBeInTheDocument();
  });

  it("valt bij een onbekende tab terug op de algemene tab", async () => {
    renderAt("/profiel?tab=onzin");
    expect(await screen.findByText(/profielfoto/i)).toBeInTheDocument();
  });

  // ── #921 ────────────────────────────────────────────────────────────────

  it("markeert onopgeslagen werk en waarschuwt bij een tabwissel", async () => {
    renderPage();
    await screen.findByLabelText(/gebruikersnaam/i);

    // Schoon: geen badge.
    expect(screen.queryByText(/nog niet opgeslagen/i)).toBeNull();

    await userEvent.type(screen.getByLabelText(/gebruikersnaam/i), "x");
    expect(screen.getByText(/nog niet opgeslagen/i)).toBeInTheDocument();

    // Van tab wisselen gooit dat weg, dus eerst bevestigen (#921).
    await userEvent.click(screen.getByRole("tab", { name: /^account$/i }));
    const dialoog = await screen.findByRole("dialog", {
      name: /wijzigingen niet opgeslagen/i,
    });
    // Annuleren houdt je op de tab, mét je invoer.
    await userEvent.click(
      within(dialoog).getByRole("button", { name: /annuleren/i }),
    );
    expect(screen.getByLabelText(/gebruikersnaam/i)).toBeInTheDocument();
  });

  it("toont de wachtwoordeis uit dezelfde bron als het loginscherm", async () => {
    renderPage();
    await openTab(/^account$/i);
    expect(await screen.findByText(PASSWORD_RULE)).toBeInTheDocument();
  });

  it("splitst meldingen in dit apparaat en al je apparaten", async () => {
    renderPage();
    await openTab(/meldingen & privacy/i);
    expect(
      await screen.findByRole("heading", { name: /meldingen op dit apparaat/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /welke meldingen wil je/i }),
    ).toBeInTheDocument();
  });

  it("biedt een download van je eigen gegevens", async () => {
    renderPage();
    await openTab(/^account$/i);
    expect(
      await screen.findByRole("button", { name: /download mijn gegevens/i }),
    ).toBeInTheDocument();
  });
});
