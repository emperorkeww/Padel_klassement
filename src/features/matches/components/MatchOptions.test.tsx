import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MatchOptions, type MatchOptie } from "./MatchOptions";

const OPTIES: MatchOptie[] = [
  {
    sleutel: "toto",
    icoon: "🎯",
    naam: "Toto",
    waarde: "2 voorspellingen",
    inhoud: <p>de toto-tegel</p>,
  },
  {
    sleutel: "inzet",
    icoon: "🍻",
    naam: "Inzet",
    waarde: "Nog niets afgesproken",
    inhoud: <p>de drankkeuze</p>,
  },
];

describe("<MatchOptions />", () => {
  it("toont per optie de stand van zaken zonder hem te openen", () => {
    render(<MatchOptions opties={OPTIES} />);
    expect(screen.getByText("Toto")).toBeInTheDocument();
    expect(screen.getByText("2 voorspellingen")).toBeInTheDocument();
    expect(screen.getByText("Nog niets afgesproken")).toBeInTheDocument();
    // De inhoud zit erachter, niet eronder — dat is het hele punt.
    expect(screen.queryByText("de toto-tegel")).toBeNull();
  });

  it("opent het blok in een dialoog", async () => {
    render(<MatchOptions opties={OPTIES} />);
    await userEvent.click(screen.getByRole("button", { name: /toto/i }));
    const dialoog = screen.getByRole("dialog");
    expect(dialoog).toHaveTextContent("de toto-tegel");
    // De andere optie komt niet mee.
    expect(screen.queryByText("de drankkeuze")).toBeNull();
  });

  it("houdt er hoogstens één tegelijk open", async () => {
    render(<MatchOptions opties={OPTIES} />);
    await userEvent.click(screen.getByRole("button", { name: /toto/i }));
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: /inzet/i }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog")).toHaveTextContent("de drankkeuze");
  });

  it("rendert niets zonder opties", () => {
    // Buiten een groep bestaan toto, lef en joker niet; dan hoort er ook geen
    // lege "Matchopties"-kop te blijven staan.
    const { container } = render(<MatchOptions opties={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("laat de rij een volwaardig tapdoel zijn", () => {
    render(<MatchOptions opties={OPTIES} />);
    // De rij is een echte knop, geen div met onClick: toetsenbord en
    // screenreader krijgen hem zo gratis mee.
    for (const naam of [/toto/i, /inzet/i]) {
      expect(screen.getByRole("button", { name: naam })).toHaveAttribute(
        "aria-haspopup",
        "dialog",
      );
    }
  });
});
