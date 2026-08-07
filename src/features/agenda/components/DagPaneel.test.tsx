import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DagPaneel } from "./DagPaneel";
import type { AgendaMarker } from "../agendaLogic";

// Het paneel is de leeslaag onder het raster (#1112). Wat het moet doen: de dag
// benoemen, per speeldag de samenvatting tonen, en het aantikken doorgeven aan
// het dag-sheet — het paneel handelt zelf niets af.

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
    date: "2026-08-08",
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
    changedAt: "2026-08-01T18:00:00.000Z",
    ...overrides,
  };
}

function toon(props: Partial<Parameters<typeof DagPaneel>[0]> = {}) {
  const onOpen = vi.fn();
  const onPlan = vi.fn();
  const onKiesDag = vi.fn();
  render(
    <DagPaneel
      datum="2026-08-08"
      vandaag="2026-08-07"
      markers={[marker()]}
      volgende={[]}
      ledenPerGroep={{ g1: 4 }}
      profielen={{}}
      onOpen={onOpen}
      onPlan={onPlan}
      onKiesDag={onKiesDag}
      {...props}
    />,
  );
  return { onOpen, onPlan, onKiesDag };
}

describe("<DagPaneel />", () => {
  it("benoemt de dag en telt wat erop staat", () => {
    toon({
      markers: [marker(), marker({ optionId: "opt-2", startTime: "11:00" })],
    });
    expect(
      screen.getByRole("heading", { name: /zaterdag 8 augustus/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 activiteiten")).toBeInTheDocument();
  });

  it("zet vandaag ervoor als de gekozen dag vandaag is", () => {
    toon({ datum: "2026-08-07", markers: [] });
    expect(
      screen.getByRole("heading", { name: /vandaag · vrijdag 7 augustus/i }),
    ).toBeInTheDocument();
  });

  it("vat een geboekte speeldag samen", () => {
    toon({ markers: [marker({ courts: "3", duration: 120 })] });
    expect(screen.getByText("20:00")).toBeInTheDocument();
    expect(screen.getByText("2 uur")).toBeInTheDocument();
    expect(screen.getByText("Geboekt")).toBeInTheDocument();
    expect(screen.getByText("Vrijdagavond Padel")).toBeInTheDocument();
    expect(screen.getByText("Padel De Panne · Baan 3")).toBeInTheDocument();
    expect(screen.getByText("2 spelers")).toBeInTheDocument();
  });

  it("toont bij een open poll de tussenstand, niet een spelersaantal", () => {
    toon({ markers: [marker({ status: "open" })] });
    expect(screen.getByText("Open poll")).toBeInTheDocument();
    // "2 spelers" zou suggereren dat het rond is; dat is het niet.
    expect(screen.getByText("2 van 4 kunnen")).toBeInTheDocument();
    expect(screen.getByText(/baan nog te kiezen/)).toBeInTheDocument();
  });

  it("geeft een aangetikte kaart door aan het dag-sheet", () => {
    const { onOpen } = toon();
    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalled();
  });

  it("nodigt op een lege dag uit om te plannen", () => {
    const { onPlan } = toon({ markers: [] });
    expect(screen.getByText("Nog niets gepland")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Speeldag plannen" }));
    expect(onPlan).toHaveBeenCalled();
  });

  it("wijst op een lege dag naar wat er hierna komt (#1112)", () => {
    const { onKiesDag } = toon({
      markers: [],
      volgende: [
        marker({ optionId: "v1", date: "2026-08-15", startTime: "11:00" }),
        marker({ optionId: "v2", date: "2026-08-22", status: "open" }),
      ],
    });
    const rij = screen.getByRole("button", { name: /za 15 aug, 11:00/ });
    // De rij zegt zelf waar hij heen gaat: los van elkaar zeggen "za 15 aug" en
    // "11:00 · Vrijdagavond Padel" te weinig.
    expect(rij).toHaveAccessibleName(
      "za 15 aug, 11:00, Vrijdagavond Padel, geboekt",
    );
    fireEvent.click(rij);
    expect(onKiesDag).toHaveBeenCalledWith("2026-08-15");
  });

  it("houdt hierna weg zodra de dag zelf iets draagt", () => {
    // Anders staat er van alles onder elkaar dat over verschillende dagen gaat.
    toon({ volgende: [marker({ optionId: "v1", date: "2026-08-15" })] });
    expect(screen.queryByText("Hierna")).not.toBeInTheDocument();
  });

  it("biedt op een lege dag die geweest is niets aan", () => {
    // `onPlan` ontbreekt: Agenda geeft hem niet door voor een dag in het
    // verleden. Daar valt niets meer te plannen, dus ook geen knop.
    toon({ markers: [], datum: "2026-08-01", onPlan: undefined });
    expect(
      screen.queryByRole("button", { name: "Speeldag plannen" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/deze dag is geweest/i)).toBeInTheDocument();
  });
});
