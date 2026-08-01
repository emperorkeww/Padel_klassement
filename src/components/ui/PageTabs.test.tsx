import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PageTabs, TabPanel } from "./PageTabs";

const TABS = [
  { id: "een", label: "Een" },
  { id: "twee", label: "Twee", count: 6 },
  { id: "drie", label: "Drie" },
];

describe("<PageTabs />", () => {
  it("geeft de rij tablist-semantiek en de teller in de naam", () => {
    render(
      <PageTabs
        tabs={TABS}
        value="een"
        onChange={vi.fn()}
        ariaLabel="Onderdelen"
        idPrefix="p"
      />,
    );

    expect(screen.getByRole("tablist", { name: "Onderdelen" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Een" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // De teller hoort bij de naam, niet bij de decoratie.
    expect(screen.getByRole("tab", { name: "Twee, 6" })).toBeInTheDocument();
  });

  it("navigeert met de pijltjestoetsen", async () => {
    const onChange = vi.fn();
    render(
      <PageTabs
        tabs={TABS}
        value="een"
        onChange={onChange}
        ariaLabel="Onderdelen"
        idPrefix="p"
      />,
    );

    screen.getByRole("tab", { name: "Een" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith("twee");

    onChange.mockClear();
    await userEvent.keyboard("{ArrowLeft}");
    expect(onChange).toHaveBeenCalledWith("drie");
  });

  it("wijst met aria-controls naar het paneel bij een idPrefix", () => {
    render(
      <>
        <PageTabs
          tabs={TABS}
          value="twee"
          onChange={vi.fn()}
          ariaLabel="Onderdelen"
          idPrefix="p"
        />
        <TabPanel id="twee" idPrefix="p">
          inhoud
        </TabPanel>
      </>,
    );

    const tab = screen.getByRole("tab", { name: "Twee, 6" });
    expect(tab).toHaveAttribute("aria-controls", "p-panel-twee");
    expect(screen.getByRole("tabpanel", { name: "Twee, 6" })).toHaveTextContent(
      "inhoud",
    );
  });

  // #910: pagina's waar de tabkeuze door de hele pagina heen doorwerkt (het
  // klassement) hebben geen enkel paneel; een aria-controls zou daar naar een
  // niet-bestaand element wijzen.
  it("laat aria-controls weg zonder idPrefix", () => {
    render(
      <PageTabs tabs={TABS} value="een" onChange={vi.fn()} ariaLabel="Weergave" />,
    );

    const tab = screen.getByRole("tab", { name: "Een" });
    expect(tab).not.toHaveAttribute("aria-controls");
    expect(tab).not.toHaveAttribute("id");
  });
});
