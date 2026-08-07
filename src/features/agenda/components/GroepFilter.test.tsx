import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GroupSummary } from "@/features/groups/api";
import { GroepFilter } from "./GroepFilter";

function groep(id: string, name: string): GroupSummary {
  return {
    id,
    name,
    created_by: "p1",
    created_at: "2026-01-01T00:00:00Z",
    member_ids: [],
  };
}

const GROEPEN = [groep("g1", "Vamos!"), groep("g2", "Kantoorpadel")];

describe("<GroepFilter /> (#1121)", () => {
  // Eén groep is geen keuze; die rij zou alleen de hoogte opeten die het
  // raster eronder nodig heeft.
  it("blijft weg bij één groep", () => {
    const { container } = render(
      <GroepFilter groepen={[GROEPEN[0]]} gekozen={[]} onWissel={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("zet 'Alle groepen' aan zolang er niets gekozen is", () => {
    render(<GroepFilter groepen={GROEPEN} gekozen={[]} onWissel={() => {}} />);
    expect(screen.getByRole("button", { name: "Alle groepen" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Vamos!" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("zet een groep aan en weer uit", async () => {
    const onWissel = vi.fn();
    const { rerender } = render(
      <GroepFilter groepen={GROEPEN} gekozen={[]} onWissel={onWissel} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Vamos!" }));
    expect(onWissel).toHaveBeenCalledWith(["g1"]);

    rerender(
      <GroepFilter groepen={GROEPEN} gekozen={["g1"]} onWissel={onWissel} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Vamos!" }));
    expect(onWissel).toHaveBeenLastCalledWith([]);
  });

  it("kan er meerdere tegelijk aanzetten", async () => {
    const onWissel = vi.fn();
    render(
      <GroepFilter groepen={GROEPEN} gekozen={["g1"]} onWissel={onWissel} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Kantoorpadel" }));
    expect(onWissel).toHaveBeenCalledWith(["g1", "g2"]);
  });

  it("wist de keuze via 'Alle groepen'", async () => {
    const onWissel = vi.fn();
    render(
      <GroepFilter groepen={GROEPEN} gekozen={["g1"]} onWissel={onWissel} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Alle groepen" }));
    expect(onWissel).toHaveBeenCalledWith([]);
  });
});
