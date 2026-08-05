import { describe, it, expect, vi, beforeEach } from "vitest";
import { StrictMode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const verifyOtp = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock("./api", () => ({ verifyOtp }));
vi.mock("@/ui/ToastProvider", () => ({
  useToast: () => ({ success: toastSuccess, error: vi.fn(), info: vi.fn() }),
}));

import { AuthBevestigen } from "./AuthBevestigen";

/** Rendert de route met een querystring en zichtbare bestemmingen erachter. */
function renderLink(zoekstring: string, wrapper: "strict" | "normaal" = "normaal") {
  const boom = (
    <MemoryRouter initialEntries={[`/auth/bevestigen${zoekstring}`]}>
      <Routes>
        <Route path="/auth/bevestigen" element={<AuthBevestigen />} />
        <Route path="/" element={<p>DASHBOARD</p>} />
        <Route path="/reset-wachtwoord" element={<p>NIEUW WACHTWOORD</p>} />
        <Route path="/profiel" element={<p>PROFIEL</p>} />
      </Routes>
    </MemoryRouter>
  );
  return render(wrapper === "strict" ? <StrictMode>{boom}</StrictMode> : boom);
}

describe("<AuthBevestigen />", () => {
  beforeEach(() => {
    verifyOtp.mockReset().mockResolvedValue({ data: {}, error: null });
    toastSuccess.mockReset();
  });

  // De kern van #1037: de link uit de mail draagt een token_hash, niet de
  // PKCE-code. Die eerste heeft geen code_verifier uit localStorage nodig en
  // werkt dus ook als je de mail op een ander apparaat opent.
  it.each([
    ["recovery", "NIEUW WACHTWOORD"],
    ["invite", "NIEUW WACHTWOORD"],
    ["signup", "DASHBOARD"],
    ["email_change", "PROFIEL"],
    ["magiclink", "DASHBOARD"],
  ])("stuurt %s door naar de juiste pagina", async (type, bestemming) => {
    renderLink(`?token_hash=abc123&type=${type}`);
    expect(await screen.findByText(bestemming)).toBeInTheDocument();
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "abc123", type });
  });

  it("meldt succes bij bevestiging en aanmelding, maar niet bij herstel", async () => {
    renderLink("?token_hash=abc123&type=signup");
    await screen.findByText("DASHBOARD");
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringMatching(/bevestigd/i));

    toastSuccess.mockReset();
    renderLink("?token_hash=abc123&type=recovery");
    await screen.findByText("NIEUW WACHTWOORD");
    // Het herstelscherm spreekt voor zich; een toast eroverheen is ruis.
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  // Het token is eenmalig: een tweede verifyOtp faalt gegarandeerd. StrictMode
  // draait effecten in dev dubbel, dus zonder guard verbruikt de eerste ronde
  // het token en loopt de tweede tegen een fout aan.
  it("wisselt het token precies één keer in, ook onder StrictMode", async () => {
    renderLink("?token_hash=abc123&type=recovery", "strict");
    expect(await screen.findByText("NIEUW WACHTWOORD")).toBeInTheDocument();
    expect(verifyOtp).toHaveBeenCalledTimes(1);
  });

  it("toont een fout als het inwisselen mislukt", async () => {
    verifyOtp.mockResolvedValue({ data: {}, error: { message: "Token has expired" } });
    renderLink("?token_hash=verlopen&type=recovery");
    expect(
      await screen.findByText(/ongeldig of verlopen/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /terug naar inloggen/i })).toBeInTheDocument();
    // Geen doorstuur naar een pagina die zonder sessie toch niets toont.
    expect(screen.queryByText("NIEUW WACHTWOORD")).toBeNull();
  });

  it.each([
    ["?type=recovery", "zonder token_hash"],
    ["?token_hash=abc123", "zonder type"],
    ["", "zonder parameters"],
    ["?token_hash=abc123&type=onzin", "met een onbekend type"],
  ])("weigert %s (%s) zonder het endpoint te bellen", async (zoekstring) => {
    renderLink(zoekstring);
    expect(await screen.findByText(/onvolledig/i)).toBeInTheDocument();
    // Niets te winnen bij een aanroep die sowieso faalt.
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});
