import { useState } from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SpelersKiezer } from "./SpelersKiezer";
import type { KiesbareSpeler } from "@/features/groups/spelersKiezer";
import type { Profile } from "@/types";

const SPELERS: KiesbareSpeler[] = [
  { id: "p1", naam: "Papapadel" },
  { id: "p2", naam: "Ciska Slowack" },
  { id: "p3", naam: "Gilles Smet" },
  { id: "p4", naam: "Brecht" },
  { id: "p5", naam: "Obe" },
];

// De kaart is presentatie; de selectie leeft bij de parent. Deze harness speelt
// die parent, zodat een tik op een chip echt door alle afgeleide waarden heen
// werkt in plaats van tegen een vaste prop aan te lopen.
function Harness({ start = SPELERS.map((s) => s.id) }: { start?: string[] }) {
  const [gekozen, setGekozen] = useState<Set<string>>(new Set(start));
  return (
    <SpelersKiezer
      spelers={SPELERS}
      profielen={{} as Record<string, Profile>}
      gekozen={gekozen}
      moment="20:00"
      onToggle={(id) =>
        setGekozen((cur) => {
          const next = new Set(cur);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        })
      }
      onAlles={(aan) =>
        setGekozen(new Set(aan ? SPELERS.map((s) => s.id) : []))
      }
      onHerstel={() => setGekozen(new Set(SPELERS.map((s) => s.id)))}
    />
  );
}

const chip = (naam: string) => screen.getByRole("switch", { name: naam });
const tab = (naam: RegExp) => screen.getByRole("tab", { name: naam });

describe("SpelersKiezer", () => {
  it("toont het moment, de teller en iedereen als aanwezig", () => {
    render(<Harness />);
    expect(screen.getByText("Vandaag · 20:00")).toBeInTheDocument();
    expect(screen.getByText("van 5 aan")).toBeInTheDocument();
    expect(chip("Papapadel")).toBeChecked();
    // Geen afwezigen → geen voet.
    expect(screen.queryByText(/^Afwezig:/)).not.toBeInTheDocument();
  });

  it("laat een tik op een chip door teller, tabtellingen en voet werken", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(chip("Ciska Slowack"));

    expect(chip("Ciska Slowack")).not.toBeChecked();
    expect(screen.getByText("van 5 aan")).toBeInTheDocument();
    expect(
      screen.getByText("4", { selector: ".kiezer__teller-getal" }),
    ).toBeInTheDocument();
    expect(tab(/Aanwezig, 4/)).toBeInTheDocument();
    expect(tab(/Afwezig, 1/)).toBeInTheDocument();
    expect(screen.getByText("Ciska Slowack", { selector: "b" })).toBeInTheDocument();
  });

  it("somt maximaal drie afwezigen op en telt de rest", async () => {
    const user = userEvent.setup();
    render(<Harness start={["p1"]} />);
    expect(
      screen.getByText("Ciska Slowack, Gilles Smet, Brecht +1", {
        selector: "b",
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Herstel" }));
    expect(screen.queryByText(/^Afwezig:/)).not.toBeInTheDocument();
  });

  it("schakelt met één knop tussen alles aan en alles uit", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Alles uit" }));
    expect(chip("Papapadel")).not.toBeChecked();

    await user.click(screen.getByRole("button", { name: "Alles aan" }));
    expect(chip("Papapadel")).toBeChecked();
  });

  it("filtert live op een deel van de naam", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByPlaceholderText("Zoek een naam"), "sme");

    expect(chip("Gilles Smet")).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Brecht" })).not.toBeInTheDocument();
  });

  it("meldt het als zoeken niets oplevert", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByPlaceholderText("Zoek een naam"), "zzz");

    expect(screen.getByText("Geen spelers gevonden.")).toBeInTheDocument();
  });

  it("laat de tab Aanwezig een werklijst zijn: wie je uitzet verdwijnt", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(tab(/Aanwezig, 5/));
    expect(chip("Obe")).toBeInTheDocument();

    await user.click(chip("Obe"));
    expect(screen.queryByRole("switch", { name: "Obe" })).not.toBeInTheDocument();

    await user.click(tab(/Afwezig, 1/));
    expect(chip("Obe")).toBeInTheDocument();
  });

  it("laat de filtertabs met de pijltjestoetsen bedienen", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    tab(/Iedereen, 5/).focus();
    await user.keyboard("{ArrowRight}");

    expect(tab(/Aanwezig, 5/)).toHaveAttribute("aria-selected", "true");
  });
});
