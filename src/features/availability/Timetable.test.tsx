import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Timetable } from "./Timetable";
import type { DayAvailability } from "./api";

// As 16:00–19:00 (6 halfuren). Dekking: 16:00+90 en 16:30+120 → t/m 18:00
// vrij; alleen 18:30 is echt bezet.
function fixture(): DayAvailability {
  return {
    open: "16:00",
    close: "19:00",
    timeZone: "Europe/Brussels",
    courts: [
      {
        court: { id: "c1", name: "Terrein 1", type: "roofed" },
        free: new Map([
          [
            "16:00",
            [
              { duration: 60, price: "€ 20" },
              { duration: 90, price: "€ 30" },
            ],
          ],
          ["16:30", [{ duration: 120, price: "€ 40" }]],
        ]),
      },
    ],
  };
}

// Toekomstige datum: geen "voorbij"-cellen.
const FUTURE = "2099-01-01";

describe("Timetable", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("onderscheidt boekbare starts, vrij-maar-niet-boekbaar en geboekt", () => {
    const { container } = render(<Timetable data={fixture()} date={FUTURE} />);

    // Boekbare starts: 16:00 en 16:30.
    expect(screen.getAllByRole("button")).toHaveLength(2);
    // Staart van de slots (17:00, 17:30, 18:00): vrij maar geen starttijd.
    expect(container.querySelectorAll(".avail-cell--nofit")).toHaveLength(3);
    // 18:30: echt bezet.
    expect(container.querySelectorAll(".avail-cell--busy")).toHaveLength(1);
    expect(container.querySelectorAll(".avail-cell--past")).toHaveLength(0);
  });

  it("duurfilter: starts zonder die duur worden vrij-maar-niet-boekbaar", () => {
    const { container } = render(
      <Timetable data={fixture()} date={FUTURE} duration={90} />,
    );

    // Alleen 16:00 heeft een 90-minutenslot; 16:30 (alleen 120) valt af.
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(container.querySelectorAll(".avail-cell--nofit")).toHaveLength(4);
    expect(container.querySelectorAll(".avail-cell--busy")).toHaveLength(1);
  });

  it("popover toont vrij-tot (start + langste duur) en duren met prijs", () => {
    render(<Timetable data={fixture()} date={FUTURE} />);

    fireEvent.click(screen.getAllByRole("button")[1]); // 16:30, alleen 120 min

    const popover = screen.getByRole("dialog");
    expect(popover).toHaveTextContent("Vrij van 16:30 tot 18:30");
    expect(popover).toHaveTextContent("120 min · € 40");
    expect(popover).not.toHaveTextContent("60 min");
  });

  it("popover respecteert het duurfilter", () => {
    render(<Timetable data={fixture()} date={FUTURE} duration={90} />);

    fireEvent.click(screen.getByRole("button")); // 16:00 met 90-filter

    const popover = screen.getByRole("dialog");
    expect(popover).toHaveTextContent("Vrij van 16:00 tot 17:30");
    expect(popover).toHaveTextContent("90 min · € 30");
    expect(popover).not.toHaveTextContent("60 min");
  });

  it("verstreken sloten (in clubtijd) tonen als voorbij", () => {
    // 15:10 UTC = 17:10 clubtijd → 16:00, 16:30 en 17:00 zijn voorbij.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-02T15:10:00Z"));

    const { container } = render(
      <Timetable data={fixture()} date="2026-07-02" />,
    );

    expect(container.querySelectorAll(".avail-cell--past")).toHaveLength(3);
    expect(screen.queryAllByRole("button")).toHaveLength(0); // starts zijn voorbij
    expect(container.querySelectorAll(".avail-cell--nofit")).toHaveLength(2);
    expect(container.querySelectorAll(".avail-cell--busy")).toHaveLength(1);
  });
});
