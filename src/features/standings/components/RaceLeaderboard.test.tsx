import { readFileSync } from "node:fs";
import { act, fireEvent, render, screen } from "@testing-library/react";
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

function renderRace(
  rows: Row[],
  allowTimeline = true,
  axisRows: Row[] = rows,
  onJumpToMe?: () => void,
) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <RaceLeaderboard
          rows={rows}
          axisRows={axisRows}
          allowTimeline={allowTimeline}
          onJumpToMe={onJumpToMe}
        />
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

  it("toont stijgen en dalen ook als tekst en opent details in een sheet", () => {
    renderRace([
      row("p1", 1050, { shift: 2 }),
      row("p2", 1030, { shift: -1 }),
      row("p3", 1010),
    ]);

    expect(screen.getByText("▲2")).toHaveClass("is-up");
    expect(screen.getByText("▼1")).toHaveClass("is-down");
    fireEvent.click(screen.getByRole("button", { name: "Details van Speler p1" }));
    const sheet = screen.getByRole("dialog", { name: "Speler p1" });
    expect(sheet).toHaveTextContent("1050 rating");
    expect(sheet).toHaveTextContent("Vorm: W · W · L");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("tekent het hele veld als punten op de overzichtsstrook", () => {
    const veld = [
      row("p1", 1120),
      row("p2", 1045),
      row("p3", 1020, { isMe: true }),
      row("p4", 1017),
    ];
    // De strook en de as volgen het volledige veld, ook als er gefilterd is.
    const { container } = renderRace(veld.slice(0, 2), false, veld);
    expect(container.querySelectorAll(".race-overview__punt")).toHaveLength(4);
    expect(container.querySelector(".race-overview__punt.is-me")).not.toBeNull();
    expect(container.querySelectorAll(".race-lane")).toHaveLength(2);
  });

  it("vertelt schermlezers volgorde, afstanden en poorten", () => {
    const { container } = renderRace([
      row("p1", 1120, { name: "Leider" }),
      row("p2", 1045),
    ]);
    const summary = container.querySelector(".race-board > .sr-only");
    expect(summary).toHaveTextContent("1. Leider (1120 rating)");
    expect(summary).toHaveTextContent("2. Speler p2 (1045 rating, 75 achter)");
    expect(summary).toHaveTextContent("Glazenwasser vanaf 1100 rating");
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

  const tijdlijnRows = () => [
    row("p1", 1020, {
      rank: 1,
      shift: 1,
      name: "Stijger",
      history: [{ match_id: "m1", rating_before: 990, rating_after: 1020, delta: 30, played_at: "2026-08-01T20:00:00Z" }],
    }),
    row("p2", 1000, { rank: 2, shift: -1 }),
  ];

  it("stapt door de speeldagen met echte vorige ratings en rangen", () => {
    renderRace(tijdlijnRows());

    expect(screen.getByLabelText("Stijger: 1020 rating")).toBeInTheDocument();
    expect(screen.getByText("Na de laatste speeldag")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Vorige speeldag" }));
    expect(screen.getByLabelText("Stijger: 990 rating")).toBeInTheDocument();
    expect(screen.getByText(/startstand · stand 1 van 2/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Volgende speeldag" }));
    expect(screen.getByLabelText("Stijger: 1020 rating")).toBeInTheDocument();
    expect(screen.getByText(/Stijger klimt van #2 naar #1/)).toBeInTheDocument();
  });

  it("speelt automatisch af en stopt op de live stand", () => {
    vi.useFakeTimers();
    try {
      renderRace(tijdlijnRows());
      fireEvent.click(screen.getByRole("button", { name: /speel af/i }));
      expect(screen.getByLabelText("Stijger: 990 rating")).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(900);
      });
      expect(screen.getByLabelText("Stijger: 1020 rating")).toBeInTheDocument();
      expect(screen.getByText("Na de laatste speeldag")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("biedt geen tijdlijn zonder aantoonbare wijziging", () => {
    renderRace([row("p1", 1000), row("p2", 990)]);
    expect(screen.queryByRole("button", { name: /speel af/i })).toBeNull();
  });

  it("ankert de eigen lane zodat de jouw-positie-chip ernaartoe kan scrollen", () => {
    const meRef = { current: null as HTMLDivElement | null };
    render(
      <MemoryRouter>
        <ToastProvider>
          <RaceLeaderboard
            rows={[row("p1", 1050), row("p2", 1030, { isMe: true })]}
            axisRows={[row("p1", 1050), row("p2", 1030, { isMe: true })]}
            allowTimeline={false}
            meRef={meRef}
          />
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(meRef.current).not.toBeNull();
    expect(meRef.current).toHaveClass("is-me");
  });

  it("maakt van de kijker-punt in de strook een spring-naar-mij-knop", () => {
    const onJumpToMe = vi.fn();
    renderRace(
      [row("p1", 1050), row("p2", 1030, { isMe: true })],
      false,
      undefined,
      onJumpToMe,
    );
    fireEvent.click(screen.getByRole("button", { name: "Spring naar jouw baan" }));
    expect(onJumpToMe).toHaveBeenCalled();
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
