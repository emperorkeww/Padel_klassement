import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Mock } from "vitest";
import { ToastProvider } from "@/ui/ToastProvider";
import { HerberekenBlok } from "./HerberekenBlok";

vi.mock("../api", () => ({
  herbereken: vi.fn(),
  // Dezelfde volgorde als de echte lijst: die volgt de triggers op `matches`.
  HERBEREKEN_STAPPEN: [
    { id: "ratings", label: "Elo-ratings" },
    { id: "pias", label: "Pias van de week" },
    { id: "rank_state", label: "Stijgers en dalers" },
    { id: "dictator", label: "Dictator-termijnen" },
    { id: "zwarte_piet", label: "Zwarte Piet" },
  ],
}));

const { herbereken } = await import("../api");

function toon() {
  return render(
    <ToastProvider>
      <HerberekenBlok />
    </ToastProvider>,
  );
}

/** Klikt de bevestigingsdialoog weg. */
async function bevestig() {
  await userEvent.click(await screen.findByRole("button", { name: "Herberekenen" }));
}

describe("<HerberekenBlok />", () => {
  beforeEach(() => {
    (herbereken as Mock).mockReset();
    (herbereken as Mock).mockImplementation(async (wat: string) => ({
      wat,
      duur_ms: 12,
    }));
  });

  it("vraagt eerst om bevestiging", async () => {
    toon();
    await userEvent.click(screen.getByRole("button", { name: "Alles herberekenen" }));

    expect(
      await screen.findByText(/Hele klassementketen herberekenen/),
    ).toBeInTheDocument();
    // Nog niets gedaan zolang er niet bevestigd is.
    expect(herbereken).not.toHaveBeenCalled();
  });

  it("doet niets als je de bevestiging afbreekt", async () => {
    toon();
    await userEvent.click(screen.getByRole("button", { name: "Alles herberekenen" }));
    await screen.findByText(/Hele klassementketen herberekenen/);
    await userEvent.click(screen.getByRole("button", { name: /Annuleren|Annuleer/i }));

    expect(herbereken).not.toHaveBeenCalled();
  });

  // De volgorde ís de correctheid: ratings eerst (row-trigger), daarna de
  // statement-triggers op alfabetische vololgorde van hun triggernaam. Wie hem
  // omgooit, krijgt een klassement dat afwijkt van een gewone matchwijziging.
  it("draait de vijf onderdelen in de volgorde van de triggers", async () => {
    toon();
    await userEvent.click(screen.getByRole("button", { name: "Alles herberekenen" }));
    await bevestig();

    await screen.findByText(/Zwarte Piet: 12 ms/);
    expect((herbereken as Mock).mock.calls.map((c) => c[0])).toEqual([
      "ratings",
      "pias",
      "rank_state",
      "dictator",
      "zwarte_piet",
    ]);
  });

  it("toont per onderdeel hoe lang het duurde", async () => {
    toon();
    await userEvent.click(screen.getByRole("button", { name: "Alles herberekenen" }));
    await bevestig();

    expect(await screen.findByText(/Elo-ratings: 12 ms/)).toBeInTheDocument();
    expect(screen.getByText(/Dictator-termijnen: 12 ms/)).toBeInTheDocument();
  });

  it("stopt bij een fout en meldt hem", async () => {
    (herbereken as Mock).mockImplementation(async (wat: string) => {
      if (wat === "rank_state") throw new Error("Geen toegang");
      return { wat, duur_ms: 1 };
    });
    toon();
    await userEvent.click(screen.getByRole("button", { name: "Alles herberekenen" }));
    await bevestig();

    expect(await screen.findByText("Geen toegang")).toBeInTheDocument();
    // Niet doorgedenderd na de fout.
    expect((herbereken as Mock).mock.calls.map((c) => c[0])).toEqual([
      "ratings",
      "pias",
      "rank_state",
    ]);
    // En de knop staat weer klaar in plaats van op "Bezig…" te blijven hangen.
    expect(
      screen.getByRole("button", { name: "Alles herberekenen" }),
    ).toBeEnabled();
  });

  it("belooft geen pushmeldingen — dat is het verschil met de dummy-update", async () => {
    toon();
    await userEvent.click(screen.getByRole("button", { name: "Alles herberekenen" }));
    expect(
      await screen.findByText(/géén pushmeldingen uit/),
    ).toBeInTheDocument();
  });
});
