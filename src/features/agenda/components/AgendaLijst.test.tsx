import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgendaLijst } from "./AgendaLijst";
import { dagItems, type AgendaMarker } from "../agendaLogic";

// De lijst beantwoordt "wat komt eraan" (#1182): één kaart per speeldag, met de
// dag erbij en een maandkop ertussen. Handelen doet hij niet zelf — aantikken
// geeft de dag door aan het dag-sheet.

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
    date: "2026-08-13",
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

function toon(markers: AgendaMarker[], laadt = false, meer = 0) {
  const onOpenDag = vi.fn();
  render(
    <AgendaLijst
      items={dagItems(markers)}
      meer={meer}
      laadt={laadt}
      ledenPerGroep={{ g1: 4 }}
      profielen={{}}
      onOpenDag={onOpenDag}
    />,
  );
  return { onOpenDag };
}

describe("<AgendaLijst />", () => {
  it("zet een kop boven elke maand en de dag bij de tijd", () => {
    toon([
      marker(),
      marker({ pollId: "poll-2", optionId: "opt-2", date: "2026-09-05" }),
    ]);
    expect(
      screen.getByRole("heading", { name: "Augustus 2026" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "September 2026" }),
    ).toBeInTheDocument();
    // De dag hoort erbij: in een lijst over meerdere weken zegt "20:00" niets.
    expect(screen.getByText("do 13 aug · 20:00")).toBeInTheDocument();
  });

  it("geeft de dag door bij het aantikken", async () => {
    const { onOpenDag } = toon([marker()]);
    await userEvent.click(screen.getByRole("button", { name: /Vrijdagavond/ }));
    expect(onOpenDag).toHaveBeenCalledWith("2026-08-13");
  });

  it("zegt het als er niets aankomt", () => {
    toon([]);
    expect(screen.getByText("Nog niets gepland")).toBeInTheDocument();
  });

  it("zwijgt niet terwijl hij laadt", () => {
    toon([], true);
    expect(screen.getByText("Speeldagen ophalen…")).toBeInTheDocument();
    // En meldt vooral niet dat er niets is terwijl dat nog niet vaststaat.
    expect(screen.queryByText("Nog niets gepland")).not.toBeInTheDocument();
  });

  it("zegt waar de lijst ophoudt (#1270)", () => {
    // Hij kapte stil af op 40 speeldagen en op een kwartaal vooruit. Beide
    // grenzen zijn redelijk, maar een lijst die ophoudt ziet er precies zo uit
    // als een agenda die leeg raakt — en "Wat komt eraan" belooft alles.
    toon([marker()]);
    expect(
      screen.getByText(/alles wat er de komende drie maanden gepland staat/i),
    ).toBeInTheDocument();
  });

  it("noemt wat er buiten de lijst viel", () => {
    toon([marker()], false, 3);
    expect(
      screen.getByText(/nog 3 speeldagen verderop/i),
    ).toBeInTheDocument();
  });
});
