import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { Aankondiging } from "./Aankondiging";

const regio = () => screen.getByRole("status");
const tik = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe("<Aankondiging />", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  // Zonder deze regel dreunt elke pagina bij het laden zijn eigen inhoud op.
  it("zwijgt bij het laden, ook als de inhoud daarna binnenkomt", () => {
    const { rerender } = render(
      <Aankondiging sleutel="alles" bericht="geen berichten." />,
    );
    tik(1000);
    expect(regio().textContent).toBe("");

    // Data arriveert; de gebruiker heeft niets gedaan.
    rerender(<Aankondiging sleutel="alles" bericht="12 berichten." />);
    tik(1000);
    expect(regio().textContent).toBe("");
  });

  it("meldt de uitkomst na een keuzewissel, pas als het rustig is", () => {
    const { rerender } = render(
      <Aankondiging sleutel="alles" bericht="12 berichten." />,
    );
    rerender(<Aankondiging sleutel="roast" bericht="3 berichten." />);

    tik(200);
    expect(regio().textContent).toBe("");
    tik(300);
    expect(regio().textContent).toBe("3 berichten.");
  });

  // Typen in een zoekveld mag niet elke toetsaanslag aankondigen.
  it("houdt bij snel wisselen alleen de laatste stand over", () => {
    const { rerender } = render(<Aankondiging sleutel="a" bericht="8 spelers." />);
    rerender(<Aankondiging sleutel="al" bericht="4 spelers." />);
    tik(100);
    rerender(<Aankondiging sleutel="ali" bericht="2 spelers." />);
    tik(100);
    rerender(<Aankondiging sleutel="alic" bericht="1 speler." />);
    tik(500);

    expect(regio().textContent).toBe("1 speler.");
  });

  // Een trage zoekopdracht komt terug ná de melding; die correctie hoort mee.
  it("volgt een uitkomst die later alsnog verandert", () => {
    const { rerender } = render(<Aankondiging sleutel="" bericht="" />);
    rerender(<Aankondiging sleutel="bob" bericht="" />);
    tik(500);
    expect(regio().textContent).toBe("");

    rerender(<Aankondiging sleutel="bob" bericht="2 spelers gevonden." />);
    tik(500);
    expect(regio().textContent).toBe("2 spelers gevonden.");
  });
});
