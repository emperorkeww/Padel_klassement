import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PiasBanner } from "@/features/standings/components/PiasBanner";
import type { RoastCtx } from "@/features/coach/roastTone";

const ctx: RoastCtx = { intensiteit: "gemeen", schild: false };

describe("<PiasBanner /> — groeps-scope in de tekst (#655)", () => {
  it("noemt de groepsnaam, zodat de banner niet verwart met de club-pias", () => {
    render(
      <PiasBanner
        pias={{
          naam: "Bob",
          reden: "bagel",
          waarde: 1,
          beschermd: false,
          ctx,
          seed: 7,
        }}
        groepsnaam="De Dinsdagavondploeg"
      />,
    );
    expect(
      screen.getByText(/Pias van de week in De Dinsdagavondploeg:/),
    ).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("houdt de groepsnaam ook in de beschermde 📊-variant", () => {
    render(
      <PiasBanner
        pias={{
          naam: "Bob",
          reden: "bagel",
          waarde: 1,
          beschermd: true,
          ctx: { ...ctx, schild: true },
          seed: 7,
        }}
        groepsnaam="De Dinsdagavondploeg"
      />,
    );
    expect(
      screen.getByText(/Opvallende week in De Dinsdagavondploeg:/),
    ).toBeInTheDocument();
  });
});