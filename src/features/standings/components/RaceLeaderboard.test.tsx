import { readFileSync } from "node:fs";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/ui/ToastProvider";
import type { Row } from "../leaderboardHelpers";
import { RaceLeaderboard } from "./RaceLeaderboard";

const row = (key: string, rating: number, options: Partial<Row> = {}): Row => ({
  key,
  rating,
  rank: Number(key.replace(/\D/g, "")) || 1,
  isMe: false,
  name: `Speler ${key}`,
  profile: { username: key, full_name: `Speler ${key}` },
  link: `/spelers/${key}`,
  played: 12,
  won: 7,
  drawn: 1,
  lost: 4,
  points: 22,
  goalDiff: 8,
  games: 12,
  history: [],
  form: ["W", "W", "L"],
  ...options,
});

function renderRace(rows: Row[], allowReplay = true, axisRows: Row[] = rows) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <RaceLeaderboard rows={rows} axisRows={axisRows} allowReplay={allowReplay} />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("<RaceLeaderboard />", () => {
  it("toont leider, echte ratingposities, huidige gebruiker en divisiecheckpoint", () => {
    const rows = [
      row("p1", 1120, { name: "Leider" }),
      row("p2", 1045),
      row("p3", 1020),
      row("p4", 1017, { isMe: true }),
    ];
    const { container } = renderRace(rows, false);

    expect(screen.getByTitle("Leider")).toBeInTheDocument();
    expect(screen.getByLabelText("Leider: 1120 rating")).toBeInTheDocument();
    expect(screen.getByLabelText("Jouw racepositie")).toHaveTextContent("#4");
    expect(screen.getByLabelText("Jouw racepositie")).toHaveTextContent("3 rating achter Speler p3");
    expect(screen.getByLabelText("Divisiecheckpoints")).toHaveTextContent("Glazenwasser");
    expect(container.querySelector(".race-lane.is-me")).toHaveTextContent("jij");
  });

  it("toont stijgen en dalen ook als tekst en maakt details klikbaar", () => {
    renderRace([
      row("p1", 1050, { shift: 2 }),
      row("p2", 1030, { shift: -1 }),
      row("p3", 1010),
    ]);

    expect(screen.getByText("▲2")).toHaveClass("is-up");
    expect(screen.getByText("▼1")).toHaveClass("is-down");
    const details = screen.getByRole("button", { name: "Details van Speler p1" });
    fireEvent.click(details);
    expect(details).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById(details.getAttribute("aria-describedby")!)).toHaveTextContent("1050 rating");
  });

  it("groepeert alleen een echt pack en benadrukt het pack van de gebruiker", () => {
    const { container } = renderRace([
      row("p1", 1120),
      row("p2", 1045),
      row("p3", 1020, { isMe: true }),
      row("p4", 1017),
    ]);
    const pack = screen.getByRole("group", { name: /jouw gevecht om plaats 2 tot 4/i });
    expect(pack).toHaveClass("is-mine");
    expect(pack).toHaveTextContent("3 spelers binnen 28 rating");
    expect(container.querySelectorAll(".race-pack")).toHaveLength(1);
  });

  it("toont geen pack wanneer spelers niet dicht genoeg bij elkaar staan", () => {
    const { container } = renderRace([
      row("p1", 1200),
      row("p2", 1100),
      row("p3", 1000),
    ]);
    expect(container.querySelector(".race-pack")).toBeNull();
  });

  it("start replay alleen op verzoek vanuit de echte vorige rating", () => {
    renderRace([
      row("p1", 1020, {
        rank: 1,
        shift: 1,
        name: "Stijger",
        history: [{ match_id: "m1", rating_before: 990, rating_after: 1020, delta: 30, played_at: "2026-08-01T20:00:00Z" }],
      }),
      row("p2", 1000, { rank: 2, shift: -1 }),
    ]);

    expect(screen.getByLabelText("Stijger: 1020 rating")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /bekijk verschuivingen/i }));
    expect(screen.getByText(/stand vóór 1 augustus/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Stijger: 990 rating")).toBeInTheDocument();
  });

  it("slaat de beweging over bij prefers-reduced-motion", () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as typeof window.matchMedia;
    try {
      renderRace([
        row("p1", 1020, {
          rank: 1,
          shift: 1,
          history: [{ match_id: "m1", rating_before: 990, rating_after: 1020, delta: 30, played_at: "2026-08-01T20:00:00Z" }],
        }),
        row("p2", 1000, { rank: 2, shift: -1 }),
      ]);
      fireEvent.click(screen.getByRole("button", { name: /bekijk verschuivingen/i }));
      expect(screen.getByRole("button", { name: /opnieuw bekijken/i })).toBeInTheDocument();
      expect(screen.getByLabelText("Speler p1: 1020 rating")).toBeInTheDocument();
    } finally {
      window.matchMedia = original;
    }
  });

  it("heeft een aparte mobiele lane-layout zonder horizontale paginascroll", () => {
    const css = readFileSync("src/features/standings/components/RaceLeaderboard.css", "utf8");
    const mobile = css.slice(css.indexOf("@media (max-width: 720px)"));
    expect(mobile).toMatch(/\.race-lane\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
    expect(css).toMatch(/\.race-board\s*\{[^}]*min-width:\s*0/);
    expect(css).toMatch(/\.race-board__course\s*\{[^}]*overflow:\s*clip/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: no-preference\)/);
  });
});
