import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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

/** Losse partijen: het tijdstip doet er in dit paneel niet toe — die verdeling
 *  is al gemaakt voordat DagPaneel iets te zien krijgt (#1221). */
const wed = (...ids: string[]) => ids.map((id) => ({ id, atMs: 0 }));

function toon(props: Partial<Parameters<typeof DagPaneel>[0]> = {}) {
  const onOpen = vi.fn();
  const onPlan = vi.fn();
  const onKiesDag = vi.fn();
  render(
    <MemoryRouter>
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
    />
    </MemoryRouter>,
  );
  return { onOpen, onPlan, onKiesDag };
}

describe("<DagPaneel />", () => {
  it("benoemt de dag en telt wat erop staat", () => {
    toon({
      markers: [
        marker(),
        marker({ pollId: "poll-2", optionId: "opt-2", startTime: "11:00" }),
      ],
    });
    expect(
      screen.getByRole("heading", { name: /zaterdag 8 augustus/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 activiteiten")).toBeInTheDocument();
  });

  it("maakt van twee voorstellen van dezelfde poll één kaart", () => {
    // Een open poll die twee tijden op dezelfde dag voorstelt is één speeldag
    // om over te beslissen, geen twee afspraken (#1182).
    toon({
      markers: [
        marker({ status: "open", yesVoterIds: ["a", "b"] }),
        marker({
          optionId: "opt-2",
          startTime: "21:30",
          status: "open",
          yesVoterIds: ["b", "c"],
        }),
      ],
    });
    expect(screen.getByText("1 activiteit")).toBeInTheDocument();
    expect(screen.getByText("20:00 of 21:30")).toBeInTheDocument();
    // En wie op één van beide kan, telt mee: a, b en c — b niet dubbel.
    expect(screen.getByText("3 van 4 kunnen")).toBeInTheDocument();
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

  it("zegt niet dat er niets gespeeld is als er wél gespeeld is (#1182)", () => {
    toon({
      markers: [],
      datum: "2026-08-01",
      onPlan: undefined,
      wedstrijden: [
        { date: "2026-08-01", groupId: "g1", matches: wed("m1", "m2", "m3") },
      ],
      groepNamen: { g1: "Vrijdagavond Padel" },
    });
    expect(screen.queryByText(/deze dag is geweest/i)).not.toBeInTheDocument();
    expect(screen.getByText("3 wedstrijden")).toBeInTheDocument();
    // Meerdere wedstrijden: naar het matchoverzicht van de groep, want een
    // dagfilter bestaat daar niet.
    expect(screen.getByRole("link", { name: /3 wedstrijden/ })).toHaveAttribute(
      "href",
      "/spelen?groep=g1",
    );
  });

  it("linkt bij één wedstrijd naar die wedstrijd", () => {
    toon({
      markers: [],
      datum: "2026-08-01",
      onPlan: undefined,
      wedstrijden: [{ date: "2026-08-01", groupId: "g1", matches: wed("m1") }],
    });
    expect(screen.getByRole("link", { name: /1 wedstrijd/ })).toHaveAttribute(
      "href",
      "/matches/m1",
    );
  });

  it("geeft de gespeeld-rij dezelfde schil als een speeldagkaart (#1207)", () => {
    // De rij had een eigen, vlakkere variant. Naast de kaarten eronder las dat
    // als iets uit een andere app, en de Gespeeld-chip verdween erin: die staat
    // zelf op --surface-2, net als het vlak waar hij op lag.
    toon({
      markers: [],
      datum: "2026-08-01",
      onPlan: undefined,
      wedstrijden: [{ date: "2026-08-01", groupId: "g1", matches: wed("m1") }],
    });
    const rij = screen.getByRole("link", { name: /1 wedstrijd/ });
    expect(rij).toHaveClass("speeldag");
    expect(rij.className).not.toMatch(/speeldag--/);
    // Het staafje draagt het statusverschil, zoals bij elke andere status.
    expect(rij.querySelector(".speeldag__rail--past")).toBeInTheDocument();
  });

  it("zet de wedstrijden van een speeldag op die kaart (#1221)", () => {
    // Eén avond hoort één kaart te zijn. De rij ernaast ging over dezelfde
    // wedstrijden, en dan stond dezelfde avond er twee keer.
    toon({
      markers: [marker({ past: true })],
      wedstrijden: [],
      wedstrijdenPerPoll: { "poll-1": 6 },
    });
    expect(screen.getByText("6 wedstrijden")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /wedstrijden/ })).toBeNull();
    // Het statuswoord blijft in de naam van de kaart staan, ook al staat er nu
    // een telling in de chip (WCAG 1.4.1).
    expect(
      screen.getByRole("button", { name: /Gespeeld,\s*6 wedstrijden/ }),
    ).toBeInTheDocument();
  });

  it("telt losse partijen mee in de dagkop (#1221)", () => {
    // Stond op "1 activiteit" boven een speeldag én een losse rij.
    toon({
      markers: [marker({ past: true })],
      wedstrijden: [
        { date: "2026-08-08", groupId: "g2", matches: wed("m1") },
      ],
      groepNamen: { g2: "Kantoorpadel" },
    });
    expect(screen.getByText("2 activiteiten")).toBeInTheDocument();
  });

  it("houdt de statuschip zonder wedstrijden zoals hij was", () => {
    toon({ markers: [marker({ past: true })] });
    expect(screen.getByText("Gespeeld")).toBeInTheDocument();
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
  // #1213: Banen leest ?datum= al uit de URL, maar niets in de plan-flow wees
  // erheen — "is er die dag een baan vrij" moest je elders opnieuw intikken.
  it("wijst naar de vrije banen van deze dag", () => {
    toon();
    expect(
      screen.getByRole("link", { name: /vrije banen op deze dag/i }),
    ).toHaveAttribute("href", "/banen?datum=2026-08-08");
  });

  it("laat die wegwijzer weg op een dag die geweest is", () => {
    toon({ datum: "2026-08-01", markers: [], onPlan: undefined });
    expect(
      screen.queryByRole("link", { name: /vrije banen/i }),
    ).not.toBeInTheDocument();
  });
});
