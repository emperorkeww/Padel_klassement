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
    courts: null,
    accessCode: null,
    changedAt: "2026-08-01T18:00:00.000Z",
    ...overrides,
  };
}

/** Dwingt de gemeten containerbreedte af: zonder layout meet de hook in jsdom
 *  niets en valt het raster terug op de smalle cel, zónder markertekst. Geeft
 *  een herstelfunctie terug (patroon uit Leaderboard.test). */
function metContainerBreedte(px: number) {
  const origRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function () {
    return { ...origRect.call(this), width: px } as DOMRect;
  };
  return () => {
    Element.prototype.getBoundingClientRect = origRect;
  };
}

function toon(props: Partial<Parameters<typeof MaandRaster>[0]> = {}) {
  const onFocusDag = vi.fn();
  const onPick = vi.fn();
  render(
    <MaandRaster
      weeks={monthGrid({ jaar: 2026, maand: 8 })}
      perDag={{ "2026-08-13": [marker()] }}
      vandaag="2026-08-07"
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

  it("laat de stem-hint over dít moment gaan, niet over de poll (#1104)", () => {
    const herstel = metContainerBreedte(900);
    try {
      toon({
        perDag: {
          // Twee momenten van dezelfde poll: het ene beantwoord, het andere
          // niet. Vroeger las de hint `iVoted` en zei hij overal "jij ✓".
          "2026-08-13": [
            marker({ optionId: "a", status: "open", startTime: "18:00", iVoted: true, myVote: "yes" }),
            marker({ optionId: "b", status: "open", startTime: "20:00", iVoted: true, myVote: null }),
          ],
        },
      });
      const dag = screen.getByRole("button", { name: /donderdag 13 augustus/ });
      expect(dag.textContent).toContain("jij ✓");
      expect(dag.textContent).toContain("stem");
      expect(dag).toHaveAccessibleName(/jij stemde al/);
      expect(dag).toHaveAccessibleName(/jij stemde nog niet/);
    } finally {
      herstel();
    }
  });

  it("kondigt aan wat er niet in een cel past", () => {
    toon({
      perDag: {
        "2026-08-13": [
          marker({ optionId: "a", startTime: "18:00" }),
          marker({ optionId: "b", startTime: "19:00" }),
          marker({ optionId: "c", startTime: "20:00" }),
        ],
      },
    });
    const dag = screen.getByRole("button", { name: /donderdag 13 augustus/ });
    // Twee zichtbare markers plus "+1"; de naam noemt alle drie de speeldagen.
    expect(dag.textContent).toContain("+1");
    expect(dag).toHaveAccessibleName(/3 speeldagen/);
  });
});
