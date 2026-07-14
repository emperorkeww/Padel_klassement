import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ScoreStepper } from "@/ui/ScoreStepper";

function Harness() {
  const [value, setValue] = useState("");
  return <ScoreStepper value={value} onChange={setValue} label="Score team A" />;
}

describe("<ScoreStepper />", () => {
  it("telt op en af met de ±-knoppen, niet onder nul", async () => {
    render(<Harness />);
    const plus = screen.getByRole("button", { name: /één meer/i });
    const min = screen.getByRole("button", { name: /één minder/i });
    const veld = screen.getByLabelText("Score team A");

    // Leeg: min zet de score met één tik op 0 (team dat niets scoorde).
    await userEvent.click(min);
    expect(veld).toHaveValue(0);
    expect(min).toBeDisabled();

    await userEvent.click(plus);
    await userEvent.click(plus);
    expect(veld).toHaveValue(2);
    await userEvent.click(min);
    expect(veld).toHaveValue(1);
  });

  it("blijft gewoon typbaar", async () => {
    render(<Harness />);
    const veld = screen.getByLabelText("Score team A");
    await userEvent.type(veld, "12");
    expect(veld).toHaveValue(12);
  });

  it("meldt wijzigingen via onChange", async () => {
    const onChange = vi.fn();
    render(<ScoreStepper value="4" onChange={onChange} label="Score team B" />);
    await userEvent.click(screen.getByRole("button", { name: /één meer/i }));
    expect(onChange).toHaveBeenCalledWith("5");
    await userEvent.click(screen.getByRole("button", { name: /één minder/i }));
    expect(onChange).toHaveBeenCalledWith("3");
  });
});
