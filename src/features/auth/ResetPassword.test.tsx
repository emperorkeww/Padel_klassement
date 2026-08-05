import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { Mock } from "vitest";
import { AuthProvider } from "./AuthProvider";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  // Een herstellink levert een (recovery-)sessie op; het formulier is dan zichtbaar.
  return { supabase: makeSupabaseMock({ session: SESSION }) };
});

import ResetPassword from "./ResetPassword";
import { supabase } from "@/lib/supabase/client";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/reset-wachtwoord"]}>
      <AuthProvider>
        <ResetPassword />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("<ResetPassword />", () => {
  it("weigert een te kort of niet-overeenkomend wachtwoord", async () => {
    renderPage();
    const velden = await screen.findAllByPlaceholderText("••••••••");
    await userEvent.type(velden[0], "kort");
    await userEvent.type(velden[1], "kort");
    await userEvent.click(screen.getByRole("button", { name: /wachtwoord opslaan/i }));
    expect(
      await screen.findByText(/kies een wachtwoord van minstens 6 tekens/i),
    ).toBeInTheDocument();

    await userEvent.type(velden[0], "erbij-lang-genoeg");
    await userEvent.click(screen.getByRole("button", { name: /wachtwoord opslaan/i }));
    expect(
      await screen.findByText(/komen niet overeen/i),
    ).toBeInTheDocument();
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it("zet het nieuwe wachtwoord via supabase auth", async () => {
    renderPage();
    const velden = await screen.findAllByPlaceholderText("••••••••");
    await userEvent.type(velden[0], "nieuwgeheim");
    await userEvent.type(velden[1], "nieuwgeheim");
    await userEvent.click(screen.getByRole("button", { name: /wachtwoord opslaan/i }));
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      password: "nieuwgeheim",
    });
    expect(await screen.findByText(/wachtwoord gewijzigd/i)).toBeInTheDocument();
  });

  it("toont een NL-melding bij een serverfout (geen rauwe Supabase-tekst)", async () => {
    (supabase.auth.updateUser as Mock).mockResolvedValueOnce({
      error: { code: "same_password", message: "New password should be different" },
    });
    renderPage();
    const velden = await screen.findAllByPlaceholderText("••••••••");
    await userEvent.type(velden[0], "nieuwgeheim");
    await userEvent.type(velden[1], "nieuwgeheim");
    await userEvent.click(
      screen.getByRole("button", { name: /wachtwoord opslaan/i }),
    );
    expect(await screen.findByText(/verschilt van je huidige/i)).toBeInTheDocument();
    expect(screen.queryByText(/should be different/i)).not.toBeInTheDocument();
  });

  it("meldt een ongeldige herstellink zonder sessie", async () => {
    (supabase.auth.getSession as Mock).mockResolvedValueOnce({
      data: { session: null },
    });
    renderPage();
    expect(
      await screen.findByText(/herstellink is ongeldig of verlopen/i),
    ).toBeInTheDocument();
  });
});

// Herstel-link uit het adminpaneel en de gedwongen wissel (#1036).
describe("<ResetPassword /> en het adminpaneel (#1036)", () => {
  function renderMet(zoek: string) {
    return render(
      <MemoryRouter initialEntries={[`/reset-wachtwoord${zoek}`]}>
        <AuthProvider>
          <ResetPassword />
        </AuthProvider>
      </MemoryRouter>,
    );
  }

  it("verzilvert een token_hash uit de URL met verifyOtp", async () => {
    // De link uit het paneel draagt het token in de URL i.p.v. via
    // /auth/v1/verify; anders brandt een link-preview-bot hem op zodra je hem
    // in een chat plakt. Verzilveren gebeurt daarom hier, in JavaScript.
    renderMet("?token_hash=abc123&type=recovery");
    await waitFor(() =>
      expect(supabase.auth.verifyOtp as Mock).toHaveBeenCalledWith({
        type: "recovery",
        token_hash: "abc123",
      }),
    );
  });

  it("meldt een verlopen link in plaats van een leeg formulier", async () => {
    (supabase.auth.verifyOtp as Mock).mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { message: "Token has expired" },
    });
    renderMet("?token_hash=oud&type=recovery");
    expect(await screen.findByText(/ongeldig of verlopen/i)).toBeInTheDocument();
  });

  it("toont bij ?verplicht=1 de tijdelijk-wachtwoordtekst én een uitweg", async () => {
    renderMet("?verplicht=1");
    expect(
      await screen.findByText(/tijdelijk wachtwoord gekregen/i),
    ).toBeInTheDocument();
    // Zonder deze knop zit iemand die zijn tijdelijke wachtwoord kwijt is vast:
    // elke andere route stuurt hem hierheen terug.
    expect(screen.getByRole("button", { name: /uitloggen/i })).toBeInTheDocument();
  });

  it("toont zonder ?verplicht de gewone tekst en géén uitlogknop", async () => {
    renderMet("");
    expect(
      await screen.findByText(/kies een nieuw wachtwoord voor je account/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /uitloggen/i })).toBeNull();
  });

  it("leegt de profielcache na een geslaagde wijziging", async () => {
    const { cached, cacheSize, invalidateAll } = await import(
      "@/lib/supabase/queryCache"
    );
    invalidateAll();
    await cached("profiles:one:abc", async () => ({ moet_wachtwoord_wijzigen: true }));
    expect(cacheSize()).toBeGreaterThan(0);

    renderMet("?verplicht=1");
    // Het formulier verschijnt pas als de sessie geladen is.
    await userEvent.type(
      await screen.findByLabelText(/nieuw wachtwoord/i),
      "geheim123",
    );
    await userEvent.type(screen.getByLabelText(/bevestig wachtwoord/i), "geheim123");
    await userEvent.click(screen.getByRole("button", { name: /opslaan/i }));

    // Zónder dit serveert getProfile de oude rij met de vlag nog aan, en stuurt
    // ProtectedRoute je meteen terug hierheen — een strakke lus.
    await waitFor(() => expect(cacheSize()).toBe(0));
  });
});
