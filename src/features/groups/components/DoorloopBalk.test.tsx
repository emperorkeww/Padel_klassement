import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DoorloopBalk } from "./DoorloopBalk";

// #1271 — de speeldagpagina had geen enkele plek die zei: stemmen → moment →
// baan → indeling → uitslagen, en waar je nu staat. PollCard klapte zichzelf
// dicht na het boeken, MakeTeams stond open tot er één ronde was en verdween
// dan, RondeBlok klapte per status: drie antwoorden op "wat is nu belangrijk".

describe("<DoorloopBalk /> (#1271)", () => {
  it("markeert de stap waar je staat", () => {
    render(
      <DoorloopBalk
        status="locked"
        heeftMoment
        totaal={0}
        gespeeld={0}
      />,
    );
    const nu = screen.getByText("Baan").closest("li");
    expect(nu).toHaveAttribute("aria-current", "step");
    expect(screen.getByText(/boek de baan/i)).toBeInTheDocument();
  });

  it("zegt het ook in woorden voor wie de vormen niet ziet", () => {
    render(<DoorloopBalk status="booked" heeftMoment totaal={0} gespeeld={0} />);
    // "Stemmen (klaar)" staat er als sr-only tekst naast het vinkje.
    expect(screen.getByText("Stemmen").closest("li")).toHaveTextContent(
      /klaar/i,
    );
  });

  it("telt de uitslagen zodra de wedstrijden staan", () => {
    render(<DoorloopBalk status="booked" heeftMoment totaal={4} gespeeld={2} />);
    expect(screen.getByText("2 van de 4 uitslagen binnen.")).toBeInTheDocument();
  });

  it("is stil trots als alles rond is", () => {
    render(<DoorloopBalk status="booked" heeftMoment totaal={4} gespeeld={4} />);
    expect(screen.getByText(/alles is rond/i)).toBeInTheDocument();
    expect(screen.queryByRole("listitem", { current: "step" })).toBeNull();
  });
});
