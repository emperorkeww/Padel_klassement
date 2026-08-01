import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "./AuthProvider";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  return { supabase: makeSupabaseMock({ session: null }) };
});

import LoginScreen from "./LoginScreen";
import { supabase } from "@/lib/supabase/client";
import { makeQuery } from "@/test/supabaseMock";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <AuthProvider>
        <LoginScreen />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("<LoginScreen />", () => {
  it("logt in met e-mail en wachtwoord", async () => {
    renderPage();
    await userEvent.type(
      await screen.findByPlaceholderText(/jij@voorbeeld/i),
      "alice@example.com",
    );
    const [wachtwoord] = screen.getAllByPlaceholderText("••••••••");
    await userEvent.type(wachtwoord, "geheim123");
    await userEvent.click(screen.getByRole("button", { name: /^inloggen$/i }));
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "alice@example.com",
      password: "geheim123",
    });
  });

  it("weigert registratie met niet-overeenkomende wachtwoorden", async () => {
    renderPage();
    await userEvent.click(
      await screen.findByRole("tab", { name: /registreren/i }),
    );
    await userEvent.type(
      screen.getByPlaceholderText(/jij@voorbeeld/i),
      "nieuw@example.com",
    );
    const velden = screen.getAllByPlaceholderText("••••••••");
    await userEvent.type(velden[0], "geheim123");
    await userEvent.type(velden[1], "anders456");
    await userEvent.click(
      screen.getByRole("button", { name: /account aanmaken/i }),
    );
    expect(
      await screen.findByText(/wachtwoorden komen niet overeen/i),
    ).toBeInTheDocument();
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it("registreert met naam en gebruikersnaam in de metadata", async () => {
    renderPage();
    await userEvent.click(
      await screen.findByRole("tab", { name: /registreren/i }),
    );
    await userEvent.type(
      screen.getByPlaceholderText(/voor- en achternaam/i),
      "Erik Elzinga",
    );
    await userEvent.type(screen.getByPlaceholderText(/bijv\. remco/i), "erik");
    await userEvent.type(
      screen.getByPlaceholderText(/jij@voorbeeld/i),
      "erik@example.com",
    );
    const velden = screen.getAllByPlaceholderText("••••••••");
    await userEvent.type(velden[0], "geheim123");
    await userEvent.type(velden[1], "geheim123");
    await userEvent.click(
      screen.getByRole("button", { name: /account aanmaken/i }),
    );
    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: "erik@example.com",
      password: "geheim123",
      options: {
        data: { full_name: "Erik Elzinga", username: "erik" },
      },
    });
  });

  it("vervangt het formulier door 'check je mail' als signUp geen sessie oplevert", async () => {
    // Default mock: { data: { user: {}, session: null } }.
    renderPage();
    await userEvent.click(
      await screen.findByRole("tab", { name: /registreren/i }),
    );
    await userEvent.type(
      screen.getByPlaceholderText(/jij@voorbeeld/i),
      "check@example.com",
    );
    const velden = screen.getAllByPlaceholderText("••••••••");
    await userEvent.type(velden[0], "geheim123");
    await userEvent.type(velden[1], "geheim123");
    await userEvent.click(
      screen.getByRole("button", { name: /account aanmaken/i }),
    );
    expect(
      await screen.findByText(/bevestigingsmail gestuurd naar/i),
    ).toBeInTheDocument();
    expect(screen.getByText("check@example.com")).toBeInTheDocument();
    expect(screen.queryByText(/je wordt ingelogd/i)).not.toBeInTheDocument();
    // Het formulier heeft niets meer te vragen (#922).
    expect(
      screen.queryByPlaceholderText(/jij@voorbeeld/i),
    ).not.toBeInTheDocument();
    expect(screen.queryAllByPlaceholderText("••••••••")).toHaveLength(0);
  });

  it("brengt je vanuit 'check je mail' terug met een leeg e-mailveld", async () => {
    renderPage();
    await userEvent.click(
      await screen.findByRole("tab", { name: /registreren/i }),
    );
    await userEvent.type(
      screen.getByPlaceholderText(/jij@voorbeeld/i),
      "typo@example.com",
    );
    const velden = screen.getAllByPlaceholderText("••••••••");
    await userEvent.type(velden[0], "geheim123");
    await userEvent.type(velden[1], "geheim123");
    await userEvent.click(
      screen.getByRole("button", { name: /account aanmaken/i }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /ander e-mailadres/i }),
    );
    expect(await screen.findByPlaceholderText(/jij@voorbeeld/i)).toHaveValue("");
  });

  it("logt direct in als signUp meteen een sessie geeft (bevestiging uit)", async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({
      data: { user: {}, session: {} },
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.signUp>>);
    renderPage();
    await userEvent.click(
      await screen.findByRole("tab", { name: /registreren/i }),
    );
    await userEvent.type(
      screen.getByPlaceholderText(/jij@voorbeeld/i),
      "direct@example.com",
    );
    const velden = screen.getAllByPlaceholderText("••••••••");
    await userEvent.type(velden[0], "geheim123");
    await userEvent.type(velden[1], "geheim123");
    await userEvent.click(
      screen.getByRole("button", { name: /account aanmaken/i }),
    );
    expect(await screen.findByText(/je wordt ingelogd/i)).toBeInTheDocument();
  });

  it("toont een NL-melding bij verkeerde inloggegevens (geen Engelse Supabase-tekst)", async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { code: "invalid_credentials", message: "Invalid login credentials" },
    } as Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>);
    renderPage();
    await userEvent.type(
      await screen.findByPlaceholderText(/jij@voorbeeld/i),
      "alice@example.com",
    );
    const [wachtwoord] = screen.getAllByPlaceholderText("••••••••");
    await userEvent.type(wachtwoord, "fout");
    await userEvent.click(screen.getByRole("button", { name: /^inloggen$/i }));
    expect(await screen.findByText(/klopt niet/i)).toBeInTheDocument();
    expect(screen.queryByText(/invalid/i)).not.toBeInTheDocument();
  });

  it("meldt een te kort wachtwoord bij registratie vóór submit", async () => {
    vi.mocked(supabase.auth.signUp).mockClear();
    renderPage();
    await userEvent.click(
      await screen.findByRole("tab", { name: /registreren/i }),
    );
    await userEvent.type(
      screen.getByPlaceholderText(/jij@voorbeeld/i),
      "kort@example.com",
    );
    const velden = screen.getAllByPlaceholderText("••••••••");
    await userEvent.type(velden[0], "123");
    await userEvent.type(velden[1], "123");
    await userEvent.click(
      screen.getByRole("button", { name: /account aanmaken/i }),
    );
    expect(
      await screen.findByText(/kies een wachtwoord van minstens 6 tekens/i),
    ).toBeInTheDocument();
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it("hangt de foutmelding aan het veld waar het misging", async () => {
    renderPage();
    await userEvent.click(
      await screen.findByRole("tab", { name: /registreren/i }),
    );
    const emailVeld = screen.getByPlaceholderText(/jij@voorbeeld/i);
    await userEvent.type(emailVeld, "geen-adres");
    const velden = screen.getAllByPlaceholderText("••••••••");
    await userEvent.type(velden[0], "geheim123");
    await userEvent.type(velden[1], "geheim123");
    await userEvent.click(
      screen.getByRole("button", { name: /account aanmaken/i }),
    );

    const fout = await screen.findByText(/geen geldig e-mailadres/i);
    expect(emailVeld).toHaveAttribute("aria-invalid", "true");
    expect(emailVeld).toHaveAttribute("aria-describedby", fout.id);
    // Het foutveld krijgt de focus, zodat je meteen kunt verbeteren.
    expect(emailVeld).toHaveFocus();
    expect(supabase.auth.signUp).not.toHaveBeenCalled();

    // Tijdens het corrigeren verdwijnt de melding weer.
    await userEvent.type(emailVeld, "@example.com");
    expect(
      screen.queryByText(/geen geldig e-mailadres/i),
    ).not.toBeInTheDocument();
  });

  it("markeert bij verkeerde inloggegevens beide velden (de server zegt niet welke)", async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { code: "invalid_credentials", message: "Invalid login credentials" },
    } as Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>);
    renderPage();
    const emailVeld = await screen.findByPlaceholderText(/jij@voorbeeld/i);
    await userEvent.type(emailVeld, "alice@example.com");
    const [wachtwoord] = screen.getAllByPlaceholderText("••••••••");
    await userEvent.type(wachtwoord, "fout123");
    await userEvent.click(screen.getByRole("button", { name: /^inloggen$/i }));

    const fout = await screen.findByText(/klopt niet/i);
    expect(wachtwoord).toHaveAttribute("aria-describedby", fout.id);
    expect(wachtwoord).toHaveAttribute("aria-invalid", "true");
    expect(emailVeld).toHaveAttribute("aria-invalid", "true");
  });

  it("toont de wachtwoordsterkte terwijl je typt", async () => {
    renderPage();
    await userEvent.click(
      await screen.findByRole("tab", { name: /registreren/i }),
    );
    const [wachtwoord] = screen.getAllByPlaceholderText("••••••••");
    expect(screen.getByText("Te kort")).toBeInTheDocument();
    await userEvent.type(wachtwoord, "Padel-Vamos-2026!");
    expect(await screen.findByText("Sterk")).toBeInTheDocument();
  });

  it("waarschuwt als Caps Lock aanstaat", async () => {
    renderPage();
    const [wachtwoord] = await screen.findAllByPlaceholderText("••••••••");
    // user-event houdt de lock-status wél bij, maar jsdom laat die niet
    // doorwerken in getModifierState — dus stellen we het toetsevent zelf op.
    const toets = (capsLock: boolean) => {
      const ev = new KeyboardEvent("keydown", { key: "A", bubbles: true });
      Object.defineProperty(ev, "getModifierState", {
        value: () => capsLock,
      });
      fireEvent(wachtwoord, ev);
    };

    toets(true);
    expect(await screen.findByText(/caps lock staat aan/i)).toBeInTheDocument();
    toets(false);
    expect(screen.queryByText(/caps lock staat aan/i)).not.toBeInTheDocument();
  });

  it("blokkeert registreren met een bezette gebruikersnaam", async () => {
    vi.mocked(supabase.auth.signUp).mockClear();
    // De beschikbaarheidscheck vindt een bestaand profiel. (De mock is losjes
    // getypeerd, vandaar de cast — net als in Feed.test.tsx.)
    const fromMock = supabase.from as unknown as {
      mockReturnValueOnce: (v: unknown) => void;
    };
    fromMock.mockReturnValueOnce(
      makeQuery({ data: [{ id: "bestaat-al" }], error: null }),
    );
    renderPage();
    await userEvent.click(
      await screen.findByRole("tab", { name: /registreren/i }),
    );
    await userEvent.type(screen.getByPlaceholderText(/bijv\. remco/i), "erik");
    await userEvent.type(
      screen.getByPlaceholderText(/jij@voorbeeld/i),
      "erik@example.com",
    );
    const velden = screen.getAllByPlaceholderText("••••••••");
    await userEvent.type(velden[0], "geheim123");
    await userEvent.type(velden[1], "geheim123");

    // Debounce van 400ms vóór de check.
    expect(await screen.findByText(/al bezet/i)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /account aanmaken/i }),
    );
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it("stuurt een herstellink bij wachtwoord vergeten", async () => {
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: /wachtwoord vergeten/i }),
    );
    await userEvent.type(
      screen.getByPlaceholderText(/jij@voorbeeld/i),
      "alice@example.com",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /stuur herstellink/i }),
    );
    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "alice@example.com",
      expect.objectContaining({
        redirectTo: expect.stringContaining("/reset-wachtwoord"),
      }),
    );
    expect(await screen.findByText(/herstellink gemaild/i)).toBeInTheDocument();
  });
});
