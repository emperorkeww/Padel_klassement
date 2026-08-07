import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SpeelformaatKaart } from "./SpeelformaatKaart";
import type { Speelvorm } from "@/features/groups/speelformaat";

function Harness({
  aanwezig = 8,
  blokkade = null,
  onStart = () => {},
}: {
  aanwezig?: number;
  blokkade?: string | null;
  onStart?: () => void;
}) {
  const [vorm, setVorm] = useState<Speelvorm>("eerlijk");
  const [rondes, setRondes] = useState(1);
  return (
    <SpeelformaatKaart
      vorm={vorm}
      onVorm={setVorm}
      aanwezig={aanwezig}
      americanoRondes={rondes}
      onAmericanoRondes={setRondes}
      bezig={false}
      blokkade={blokkade}
      onStart={onStart}
    />
  );
}

/** De waarde die onder een meta-label staat ("Spelers" → "8 aan"). */
const meta = (label: string) =>
  screen.getByText(label).closest("div")!.querySelector("dd")!;

describe("SpeelformaatKaart", () => {
  it("opent op Eerlijk, met de aanbeveling en de bijbehorende CTA", () => {
    render(<Harness />);
    expect(screen.getByRole("tab", { name: "Eerlijk" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Aanbevolen")).toHaveAttribute("data-aan", "ja");
    expect(
      screen.getByRole("button", { name: "Stel eerlijke teams voor" }),
    ).toBeInTheDocument();
  });

  it("wisselt beschrijving, CTA en badge mee met de vorm", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("tab", { name: "Mexicano" }));

    expect(screen.getByRole("button", { name: "Start Mexicano" })).toBeInTheDocument();
    expect(screen.getByText(/nummer 1 speelt met nummer 4/)).toBeInTheDocument();
    // De badge blijft staan (anders verspringt de rij) maar hoort niet meer bij
    // deze vorm.
    expect(screen.getByText("Aanbevolen")).toHaveAttribute("data-aan", "nee");
  });

  it("rekent de meta-rij op de aanwezigen, inclusief de bank", () => {
    render(<Harness aanwezig={6} />);
    expect(meta("Spelers")).toHaveTextContent("6 aan");
    expect(meta("Spelers")).toHaveTextContent("2 op de bank");
    expect(meta("Banen")).toHaveTextContent("1");
  });

  it("maakt het rondegetal bij Americano de keuze zelf", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // Eerlijk en Mexicano kunnen er maar één, dus daar staat het als feit.
    expect(meta("Rondes")).toHaveTextContent("1");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Americano" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Rondes" }), "3");

    expect(screen.getByRole("combobox", { name: "Rondes" })).toHaveValue("3");
  });

  it("toont de blokkade en zet de knop uit", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(
      <Harness
        aanwezig={3}
        blokkade="Minimaal 4 deelnemers nodig om teams te maken."
        onStart={onStart}
      />,
    );

    const knop = screen.getByRole("button", { name: "Stel eerlijke teams voor" });
    expect(knop).toBeDisabled();
    expect(
      screen.getByText("Minimaal 4 deelnemers nodig om teams te maken."),
    ).toBeInTheDocument();

    await user.click(knop);
    expect(onStart).not.toHaveBeenCalled();
  });

  it("meldt de start pas als er niets in de weg staat", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<Harness onStart={onStart} />);

    await user.click(screen.getByRole("button", { name: "Stel eerlijke teams voor" }));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("opent het verschil tussen de vormen als sheet", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: /wat is het verschil/i }));

    const dialoog = await screen.findByRole("dialog");
    expect(dialoog).toHaveTextContent("Iedereen wisselt constant door");
  });

  it("laat de vormtabs met de pijltjestoetsen bedienen", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    screen.getByRole("tab", { name: "Eerlijk" }).focus();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: "Americano" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
