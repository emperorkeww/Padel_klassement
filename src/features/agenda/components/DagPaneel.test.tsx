import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DagPaneel } from "./DagPaneel";
import type { AgendaMarker, DagItem } from "../agendaLogic";

// Het paneel is de leeslaag onder het raster (#1112). Sinds #1270 hangt het aan
// vandaag in plaats van aan de dag die je aantikte — die opent nu meteen een
// sheet — en beantwoordt het de vraag die je zónder tikken hebt: wat staat er
// vandaag, en wat komt daarna. Het handelt zelf niets af.

function marker(overrides: Partial<AgendaMarker> = {}): AgendaMarker {
  return {
    pollId: "poll-1",
    optionId: "opt-1",
    groupId: "g1",
    groupName: "Vrijdagavond Padel",
    clubName: "Padel De Panne",
    clubId: "club-1",
    clubCity: "Beveren",
    clubTimezone: "Europe/Brussels",
    date: "2026-08-07",
    startTime: "20:00",
    duration: 90,
    status: "booked",
    past: false,
    iVoted: false,
    myVote: null,
    voterCount: 4,
    yesVoterIds: ["a", "b"],
    maybeVoterIds: [],
    nietGestemdIds: [],
    courts: null,
    accessCode: null,
    courtsFree: null,
    changedAt: "2026-08-01T18:00:00.000Z",
    ...overrides,
  };
}

/** Eén speeldag met één moment. */
const item = (m: AgendaMarker): DagItem => ({ eerste: m, momenten: [m] });

/** Eén speeldag met meerdere momenten op dezelfde dag. */
const bundel = (...momenten: AgendaMarker[]): DagItem => ({
  eerste: momenten[0],
  momenten,
});

function toon(props: Partial<Parameters<typeof DagPaneel>[0]> = {}) {
  const onOpenDag = vi.fn();
  render(
    <MemoryRouter>
      <DagPaneel
        vandaag="2026-08-07"
        vandaagItems={[item(marker())]}
        volgende={[]}
        ledenPerGroep={{ g1: 4 }}
        profielen={{}}
        onOpenDag={onOpenDag}
        {...props}
      />
    </MemoryRouter>,
  );
  return { onOpenDag };
}

describe("<DagPaneel />", () => {
  it("benoemt vandaag, ook als je door een andere maand bladert", () => {
    // Het blok is sinds #1270 een anker op nu: het praat niet mee met de maand
    // die je toevallig bekijkt.
    toon();
    expect(
      screen.getByRole("heading", { name: /vandaag · vrijdag 7 augustus/i }),
    ).toBeInTheDocument();
  });

  it("maakt van twee voorstellen van dezelfde poll één kaart", () => {
    // Een open poll die twee tijden op dezelfde dag voorstelt is één speeldag
    // om over te beslissen, geen twee afspraken (#1182).
    toon({
      vandaagItems: [
        bundel(
          marker({ status: "open", yesVoterIds: ["a", "b"] }),
          marker({
            optionId: "opt-2",
            startTime: "21:30",
            status: "open",
            yesVoterIds: ["b", "c"],
          }),
        ),
      ],
    });
    expect(screen.getByText("20:00 of 21:30")).toBeInTheDocument();
    // En wie op één van beide kan, telt mee: a, b en c — b niet dubbel.
    expect(screen.getByText("3 van 4 kunnen")).toBeInTheDocument();
  });

  it("vat een geboekte speeldag samen", () => {
    toon({ vandaagItems: [item(marker({ courts: "3", duration: 120 }))] });
    expect(screen.getByText("20:00")).toBeInTheDocument();
    expect(screen.getByText("2 uur")).toBeInTheDocument();
    expect(screen.getByText("Geboekt")).toBeInTheDocument();
    expect(screen.getByText("Vrijdagavond Padel")).toBeInTheDocument();
    expect(screen.getByText("Padel De Panne · Baan 3")).toBeInTheDocument();
    expect(screen.getByText("2 spelers")).toBeInTheDocument();
  });

  it("toont bij een open poll de tussenstand, niet een spelersaantal", () => {
    toon({ vandaagItems: [item(marker({ status: "open" }))] });
    expect(screen.getByText("Open poll")).toBeInTheDocument();
    // "2 spelers" zou suggereren dat het rond is; dat is het niet.
    expect(screen.getByText("2 van 4 kunnen")).toBeInTheDocument();
    expect(screen.getByText(/baan nog te kiezen/)).toBeInTheDocument();
  });

  it("opent een aangetikte kaart op zijn eigen dag", () => {
    const { onOpenDag } = toon();
    fireEvent.click(screen.getByRole("button"));
    expect(onOpenDag).toHaveBeenCalledWith("2026-08-07");
  });

  it("zet de wedstrijden van een speeldag op die kaart (#1221)", () => {
    toon({
      vandaagItems: [item(marker({ past: true }))],
      wedstrijdenPerPoll: { "poll-1": 6 },
    });
    expect(screen.getByText("6 wedstrijden")).toBeInTheDocument();
    // Het statuswoord blijft in de naam van de kaart staan, ook al staat er nu
    // een telling in de chip (WCAG 1.4.1).
    expect(
      screen.getByRole("button", { name: /Gespeeld,\s*6 wedstrijden/ }),
    ).toBeInTheDocument();
  });

  it("meldt een lege dag zonder de tik uit te leggen", () => {
    // De plan-actie staat sinds #1270 boven het raster, in beide weergaven; een
    // tweede knop hier zou de vierde ingang zijn die niemand vond.
    toon({ vandaagItems: [] });
    expect(screen.getByText("Vandaag staat er niets")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Speeldag plannen" }),
    ).not.toBeInTheDocument();
  });

  it("wijst naar wat er hierna komt (#1112)", () => {
    const { onOpenDag } = toon({
      volgende: [
        item(marker({ optionId: "v1", date: "2026-08-15", startTime: "11:00" })),
        item(marker({ optionId: "v2", date: "2026-08-22", status: "open" })),
      ],
    });
    const rij = screen.getByRole("button", { name: /za 15 aug, 11:00/ });
    // De rij zegt zelf waar hij heen gaat: los van elkaar zeggen "za 15 aug" en
    // "11:00 · Vrijdagavond Padel" te weinig.
    expect(rij).toHaveAccessibleName(
      "za 15 aug, 11:00, Vrijdagavond Padel, geboekt",
    );
    // Eén tik, één betekenis: de rij opent die speeldag (#1270). Hij koos hem
    // vroeger alleen, en wat dat opleverde stond buiten beeld.
    fireEvent.click(rij);
    expect(onOpenDag).toHaveBeenCalledWith("2026-08-15");
  });

  it("blijft vooruitwijzen terwijl er vandaag ook iets staat (#1270)", () => {
    // "Hierna" verscheen alleen onder een lege dag; wie vanavond speelde zag
    // daarmee nooit wat er dáárna kwam.
    toon({
      volgende: [item(marker({ optionId: "v1", date: "2026-08-15" }))],
    });
    expect(screen.getByText("Hierna")).toBeInTheDocument();
  });

  it("geeft twee voorstellen van dezelfde poll één rij (#1270)", () => {
    // Twee kandidaat-tijden op dezelfde zaterdag vulden twee van de drie rijen:
    // twee wegwijzers naar dezelfde speeldag.
    toon({
      volgende: [
        bundel(
          marker({ optionId: "v1", date: "2026-08-15", startTime: "20:00" }),
          marker({ optionId: "v2", date: "2026-08-15", startTime: "21:30" }),
        ),
      ],
    });
    const rijen = screen.getAllByRole("button", { name: /za 15 aug/ });
    expect(rijen).toHaveLength(1);
    expect(rijen[0]).toHaveAccessibleName(
      "za 15 aug, 20:00 of 21:30, Vrijdagavond Padel, geboekt",
    );
  });

  // #1213: Banen leest ?datum= al uit de URL, maar niets in de plan-flow wees
  // erheen — "is er die dag een baan vrij" moest je elders opnieuw intikken.
  it("wijst naar de vrije banen van vandaag", () => {
    toon();
    expect(
      screen.getByRole("link", { name: /vrije banen vandaag/i }),
    ).toHaveAttribute("href", "/banen?datum=2026-08-07");
  });
});
