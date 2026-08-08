import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Mock } from "vitest";
import { ToastProvider } from "@/ui/ToastProvider";
import { SchakelaarsBlok } from "./SchakelaarsBlok";
import type { AppInstelling } from "../types";

vi.mock("../api", () => ({
  lijstInstellingen: vi.fn(),
  zetInstelling: vi.fn(),
}));

const { lijstInstellingen, zetInstelling } = await import("../api");

function instelling(over: Partial<AppInstelling> = {}): AppInstelling {
  return {
    sleutel: "push",
    waarde: { aan: true },
    publiek: false,
    omschrijving: "Uitgaande pushmeldingen.",
    bijgewerkt_at: "2026-08-08T10:00:00Z",
    bijgewerkt_door: null,
    bijgewerkt_door_username: null,
    ...over,
  };
}

function toon() {
  return render(
    <ToastProvider>
      <SchakelaarsBlok />
    </ToastProvider>,
  );
}

describe("<SchakelaarsBlok />", () => {
  beforeEach(() => {
    (lijstInstellingen as Mock).mockReset();
    (zetInstelling as Mock).mockReset();
    (zetInstelling as Mock).mockResolvedValue(undefined);
  });

  it("toont per schakelaar de stand en waar hij over gaat", async () => {
    (lijstInstellingen as Mock).mockResolvedValue([instelling()]);
    toon();

    expect(await screen.findByText("push")).toBeInTheDocument();
    expect(screen.getByText("aan")).toBeInTheDocument();
    expect(screen.getByText("Uitgaande pushmeldingen.")).toBeInTheDocument();
  });

  it("zet een schakelaar om zonder deploy", async () => {
    (lijstInstellingen as Mock).mockResolvedValue([instelling()]);
    toon();

    await userEvent.click(await screen.findByRole("button", { name: "Uitzetten" }));
    expect(zetInstelling).toHaveBeenCalledWith("push", false);
  });

  it("biedt aanzetten aan als hij uit staat", async () => {
    (lijstInstellingen as Mock).mockResolvedValue([
      instelling({ waarde: { aan: false } }),
    ]);
    toon();

    expect(await screen.findByText("uit")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Aanzetten" }));
    expect(zetInstelling).toHaveBeenCalledWith("push", true);
  });

  // Een ontbrekende `aan` mag niet als "uit" lezen: fail-open, net als
  // instellingen.ts serverkant doet.
  it("leest een ontbrekende waarde als aan", async () => {
    (lijstInstellingen as Mock).mockResolvedValue([instelling({ waarde: {} })]);
    toon();
    expect(await screen.findByText("aan")).toBeInTheDocument();
  });

  it("toont het dagbudget van de portretten met de teller", async () => {
    (lijstInstellingen as Mock).mockResolvedValue([
      instelling({
        sleutel: "ai_portretten",
        waarde: { aan: true, dagbudget: 20, dag: "2026-08-08", gebruikt: 7 },
        publiek: true,
      }),
    ]);
    toon();

    expect(await screen.findByText(/Dagbudget 7\/20/)).toBeInTheDocument();
    expect(screen.getByText(/leesbaar voor de app/)).toBeInTheDocument();
  });

  it("meldt wie hem laatst omzette", async () => {
    (lijstInstellingen as Mock).mockResolvedValue([
      instelling({ bijgewerkt_door: "u1", bijgewerkt_door_username: "bob" }),
    ]);
    toon();
    expect(await screen.findByText(/door @bob/)).toBeInTheDocument();
  });

  it("laat een mislukte omzetting niet als gelukt ogen", async () => {
    (lijstInstellingen as Mock).mockResolvedValue([instelling()]);
    (zetInstelling as Mock).mockRejectedValue(new Error("Geen toegang"));
    toon();

    await userEvent.click(await screen.findByRole("button", { name: "Uitzetten" }));
    expect(await screen.findByText("Geen toegang")).toBeInTheDocument();
    // En de knop staat weer klaar in plaats van op "Bezig…" te blijven hangen.
    expect(screen.getByRole("button", { name: "Uitzetten" })).toBeEnabled();
  });
});
