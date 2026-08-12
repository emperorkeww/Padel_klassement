import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MaandRaster } from "./MaandRaster";
import { monthGrid, type AgendaMarker } from "../agendaLogic";

// Het raster is de enige plek in de app met een echte 2D-navigatie. Deze tests
// bewaken de twee dingen die daar makkelijk stukgaan: één tab-stop in plaats
// van 35, en een dagknop die zelf vertelt wat erop staat (#1091).

function marker(overrides: Partial<AgendaMarker> = {}): AgendaMarker {
  return {
    pollId: "poll-1",
    optionId: "opt-1",
    groupId: "g1",
    groupName: "Vamos!",
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
    voterCount: 6,
    yesVoterIds: [],
    maybeVoterIds: [],
    nietGestemdIds: [],
    courts: null,
    accessCode: null,
    courtsFree: null,
    changedAt: "2026-08-01T18:00:00.000Z",
    ...overrides,
  };
}

/** De stippen van één dagknop, op volgorde. Sinds #1112 is dat alles wat een
 *  cel visueel draagt; de woorden zitten in de toegankelijke naam. */
function stippenVan(dag: HTMLElement): string[] {
  return [...dag.querySelectorAll(".agenda-glyph")].map(
    (g) => g.className.replace("agenda-glyph agenda-glyph--", ""),
  );
}

/** Het tijdstip doet er in het raster niet toe: de verdeling over speeldagen is
 *  al gemaakt voordat dit component iets ziet (#1221). */
const wed = (...ids: string[]) => ids.map((id) => ({ id, atMs: 0 }));

function toon(props: Partial<Parameters<typeof MaandRaster>[0]> = {}) {
  const onFocusDag = vi.fn();
  const onPick = vi.fn();
  render(
    <MaandRaster
      weeks={monthGrid({ jaar: 2026, maand: 8 })}
      perDag={{ "2026-08-13": [marker()] }}
      vandaag="2026-08-07"
      gekozenDag="2026-08-07"
      focusDag="2026-08-07"
      onFocusDag={onFocusDag}
      onPick={onPick}
      {...props}
    />,
  );
  return { onFocusDag, onPick };
}

describe("<MaandRaster />", () => {
  it("heeft precies één tab-stop", () => {
    toon();
    const bereikbaar = screen
      .getAllByRole("button")
      .filter((b) => b.tabIndex === 0);
    expect(bereikbaar).toHaveLength(1);
    expect(bereikbaar[0]).toHaveAccessibleName(/vrijdag 7 augustus/);
  });

  it("vertelt per dag wat erop staat, in woorden", () => {
    toon();
    expect(
      screen.getByRole("button", {
        name: "donderdag 13 augustus, speeldag geboekt om 20:00, Vamos!, Padel De Panne",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "woensdag 26 augustus, niets gepland, plan een speeldag",
      }),
    ).toBeInTheDocument();
  });

  it("merkt vandaag aan voor hulptechnologie", () => {
    toon();
    expect(
      screen.getByRole("button", { name: /vrijdag 7 augustus/ }),
    ).toHaveAttribute("aria-current", "date");
  });

  it("verplaatst de tab-stop met de pijltjes", () => {
    const { onFocusDag } = toon();
    fireEvent.keyDown(screen.getByRole("grid"), { key: "ArrowDown" });
    expect(onFocusDag).toHaveBeenCalledWith("2026-08-14", true);
    fireEvent.keyDown(screen.getByRole("grid"), { key: "Home" });
    expect(onFocusDag).toHaveBeenLastCalledWith("2026-08-03", true);
  });

  it("laat toetsen die het raster niet kent gewoon door", () => {
    const { onFocusDag } = toon();
    fireEvent.keyDown(screen.getByRole("grid"), { key: "Tab" });
    expect(onFocusDag).not.toHaveBeenCalled();
  });

  it("meldt de aangetikte dag terug", () => {
    const { onPick } = toon();
    fireEvent.click(screen.getByRole("button", { name: /donderdag 13 augustus/ }));
    expect(onPick).toHaveBeenCalledWith("2026-08-13");
  });

  it("laat de stemstand over dít moment gaan, niet over de poll (#1104)", () => {
    toon({
      perDag: {
        // Twee momenten van dezelfde poll: het ene beantwoord, het andere niet.
        // De cel toont sinds #1112 geen tekst meer, dus dit onderscheid leeft
        // volledig in de toegankelijke naam — daar moet het dus staan.
        "2026-08-13": [
          marker({ optionId: "a", status: "open", startTime: "18:00", iVoted: true, myVote: "yes" }),
          marker({ optionId: "b", status: "open", startTime: "20:00", iVoted: true, myVote: null }),
        ],
      },
    });
    const dag = screen.getByRole("button", { name: /donderdag 13 augustus/ });
    expect(dag).toHaveAccessibleName(/jij stemde al/);
    expect(dag).toHaveAccessibleName(/jij stemde nog niet/);
  });

  it("draagt de status in de vorm van de stip, niet alleen in kleur (#1112)", () => {
    toon({
      perDag: {
        "2026-08-13": [
          marker({ optionId: "a", status: "booked", startTime: "18:00" }),
          marker({ optionId: "b", status: "locked", startTime: "19:00" }),
          marker({ optionId: "c", status: "open", startTime: "20:00" }),
        ],
      },
    });
    const dag = screen.getByRole("button", { name: /donderdag 13 augustus/ });
    expect(stippenVan(dag)).toEqual(["booked", "locked", "open"]);
  });

  it("kapt de stippen af maar niet de naam", () => {
    toon({
      perDag: {
        "2026-08-13": [
          marker({ optionId: "a", startTime: "17:00" }),
          marker({ optionId: "b", startTime: "18:00" }),
          marker({ optionId: "c", startTime: "19:00" }),
          marker({ optionId: "d", startTime: "20:00" }),
        ],
      },
    });
    const dag = screen.getByRole("button", { name: /donderdag 13 augustus/ });
    // Drie stippen passen er in een cel van deze maat; het echte aantal staat
    // voluit in de naam, dus er gaat niets verloren.
    expect(stippenVan(dag)).toHaveLength(3);
    expect(dag).toHaveAccessibleName(/4 speeldagen/);
  });

  it("markeert een dag waarop gespeeld is, ook zonder speeldag (#1182)", () => {
    toon({
      perDag: {},
      wedstrijdenPerDag: {
        "2026-08-05": [{ date: "2026-08-05", groupId: "g1", matches: wed("m1", "m2") }],
      },
      losPerDag: {
        "2026-08-05": [{ date: "2026-08-05", groupId: "g1", matches: wed("m1", "m2") }],
      },
    });
    const dag = screen.getByRole("button", { name: /woensdag 5 augustus/ });
    expect(stippenVan(dag)).toEqual(["played"]);
    // De ruit is decoratief; de naam draagt de betekenis.
    expect(dag).toHaveAccessibleName(/2 wedstrijden gespeeld/);
  });

  it("laat de speeldagen een plek inleveren voor de ruit", () => {
    toon({
      perDag: {
        "2026-08-13": [
          marker({ optionId: "a", startTime: "17:00" }),
          marker({ optionId: "b", startTime: "18:00" }),
          marker({ optionId: "c", startTime: "19:00" }),
        ],
      },
      wedstrijdenPerDag: {
        "2026-08-13": [{ date: "2026-08-13", groupId: "g1", matches: wed("m1") }],
      },
      losPerDag: {
        "2026-08-13": [{ date: "2026-08-13", groupId: "g1", matches: wed("m1") }],
      },
    });
    const dag = screen.getByRole("button", { name: /donderdag 13 augustus/ });
    expect(stippenVan(dag)).toEqual(["booked", "booked", "played"]);
  });

  it("geeft een speeldag met wedstrijden maar één glyph (#1221)", () => {
    // Dezelfde avond droeg de stip van de speeldag én de ruit van "gespeeld".
    // De wedstrijden horen bij die speeldag, dus `losPerDag` blijft leeg en de
    // ruit hoort weg te blijven.
    toon({
      perDag: { "2026-08-13": [marker({ past: true })] },
      wedstrijdenPerDag: {
        "2026-08-13": [{ date: "2026-08-13", groupId: "g1", matches: wed("m1", "m2") }],
      },
      losPerDag: {},
    });
    const dag = screen.getByRole("button", { name: /donderdag 13 augustus/ });
    expect(stippenVan(dag)).toEqual(["past"]);
    // De naam vertelt nog steeds wat er die dag gebeurd is.
    expect(dag).toHaveAccessibleName(/2 wedstrijden gespeeld/);
  });

  it("houdt de stippenrij ook leeg op zijn plek", () => {
    toon();
    const leeg = screen.getByRole("button", { name: /woensdag 26 augustus/ });
    // De rij staat er altijd: zonder die vaste hoogte zijn de cellen van een
    // week met en zonder speeldag verschillend hoog en golft het raster.
    expect(leeg.querySelector(".agenda-dag__stippen")).toBeInTheDocument();
    expect(stippenVan(leeg)).toHaveLength(0);
  });
});
