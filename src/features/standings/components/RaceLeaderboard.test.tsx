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

  // Twee speeldagen = drie frames, zodat het afspelen ook halverwege kan staan.
  const filmRows = (extraDag = false): Row[] => [
    row("p1", extraDag ? 1055 : 1040, {
      rank: 1,
      name: "Stijger",
      history: [
        { match_id: "m1", rating_before: 990, rating_after: 1010, delta: 20, played_at: "2026-08-01T20:00:00Z" },
        { match_id: "m2", rating_before: 1010, rating_after: 1040, delta: 30, played_at: "2026-08-05T20:00:00Z" },
        ...(extraDag
          ? [{ match_id: "m5", rating_before: 1040, rating_after: 1055, delta: 15, played_at: "2026-08-09T20:00:00Z" }]
          : []),
      ],
    }),
    row("p2", 1000, {
      rank: 2,
      history: [
        { match_id: "m3", rating_before: 1030, rating_after: 1015, delta: -15, played_at: "2026-08-01T20:00:00Z" },
        { match_id: "m4", rating_before: 1015, rating_after: 1000, delta: -15, played_at: "2026-08-05T20:00:00Z" },
      ],
    }),
  ];
  const film = (rows: Row[]) => (
    <MemoryRouter>
      <ToastProvider>
        <RaceLeaderboard rows={rows} axisRows={rows} allowTimeline />
      </ToastProvider>
    </MemoryRouter>
  );

  // #1254: scrollen zet state in het klassement erboven, dat rendert opnieuw en
  // geeft nieuwe — inhoudelijk gelijke — rij-arrays door. Toen stopte de film
  // en sprong de baan terug naar nu.
  it("speelt door als het klassement opnieuw rendert met dezelfde rijen", () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(film(filmRows()));
      fireEvent.click(screen.getByRole("button", { name: /speel af/i }));
      act(() => {
        vi.advanceTimersByTime(900);
      });
      expect(screen.getByLabelText("Stijger: 1010 rating")).toBeInTheDocument();

      rerender(film(filmRows()));

      expect(screen.getByLabelText("Stijger: 1010 rating")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /pauzeer/i })).toBeInTheDocument();
      // En hij loopt ook echt verder na de rerender.
      act(() => {
        vi.advanceTimersByTime(900);
      });
      expect(screen.getByLabelText("Stijger: 1040 rating")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("valt wél terug naar de live stand zodra er een nieuwe uitslag bij komt", () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(film(filmRows()));
      fireEvent.click(screen.getByRole("button", { name: /speel af/i }));
      act(() => {
        vi.advanceTimersByTime(900);
      });
      expect(screen.getByLabelText("Stijger: 1010 rating")).toBeInTheDocument();

      rerender(film(filmRows(true)));

      expect(screen.getByLabelText("Stijger: 1055 rating")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /speel af/i })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("pauzeert zodra het tabblad naar de achtergrond gaat", () => {
    vi.useFakeTimers();
    const origHidden = Object.getOwnPropertyDescriptor(Document.prototype, "hidden");
    try {
      render(film(filmRows()));
      fireEvent.click(screen.getByRole("button", { name: /speel af/i }));
      expect(screen.getByRole("button", { name: /pauzeer/i })).toBeInTheDocument();

      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });

      expect(screen.getByRole("button", { name: /speel af/i })).toBeInTheDocument();
      // En hij loopt ook niet stiekem door op de achtergrond.
      const stand = screen.getByRole("slider").getAttribute("value");
      act(() => {
        vi.advanceTimersByTime(1800);
      });
      expect(screen.getByRole("slider")).toHaveAttribute("value", stand!);
    } finally {
      delete (document as unknown as { hidden?: boolean }).hidden;
      if (origHidden) Object.defineProperty(Document.prototype, "hidden", origHidden);
      vi.useRealTimers();
    }
  });

  it("pauzeert zodra de baan helemaal uit beeld is gescrold", () => {
    const waarnemers: ((entries: { isIntersecting: boolean }[]) => void)[] = [];
    class FakeIO {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        waarnemers.push(cb);
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", FakeIO);
    try {
      render(film(filmRows()));
      fireEvent.click(screen.getByRole("button", { name: /speel af/i }));
      expect(waarnemers).toHaveLength(1);

      act(() => {
        waarnemers[0]([{ isIntersecting: false }]);
      });
      expect(screen.getByRole("button", { name: /speel af/i })).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("laat een schermlezer niet elke 900ms in de rede vallen", () => {
    const { container } = render(film(filmRows()));
    const status = () => container.querySelector(".race-tijdlijn__status")!;
    expect(status()).toHaveAttribute("aria-live", "polite");

    fireEvent.click(screen.getByRole("button", { name: /speel af/i }));
    expect(status()).toHaveAttribute("aria-live", "off");

    fireEvent.click(screen.getByRole("button", { name: /pauzeer/i }));
    expect(status()).toHaveAttribute("aria-live", "polite");
  });

  // Wie nu voorstaat, stond op de startdag laatst — daar hoort de baan naar te
  // luisteren, niet naar de stand van vandaag (#1254).
  const inhaalRows = (): Row[] => [
    row("p1", 1050, {
      rank: 1,
      shift: 4,
      name: "Inhaler",
      history: [{ match_id: "m1", rating_before: 990, rating_after: 1050, delta: 60, played_at: "2026-08-05T20:00:00Z" }],
    }),
    row("p2", 1000, {
      rank: 2,
      name: "Achterblijver",
      history: [{ match_id: "m2", rating_before: 1060, rating_after: 1000, delta: -60, played_at: "2026-08-05T20:00:00Z" }],
    }),
  ];
  const laneNamen = (container: HTMLElement) =>
    [...container.querySelectorAll(".race-lane__name")].map((el) => el.textContent);

  it("herschikt de banen naar de rangen van het getoonde frame", () => {
    const { container } = render(film(inhaalRows()));
    expect(laneNamen(container)).toEqual(["Inhaler", "Achterblijver"]);

    fireEvent.click(screen.getByRole("button", { name: "Vorige speeldag" }));

    // Op de startdag stond Achterblijver nog voor: de banen wisselen mee, niet
    // alleen het rangnummer.
    expect(laneNamen(container)).toEqual(["Achterblijver", "Inhaler"]);
    expect(container.querySelector(".race-lane")).toHaveAttribute("data-rank", "1");
  });

  it("toont op het slotframe de verschuiving van díe speeldag, niet de live pijl", () => {
    render(film(inhaalRows()));
    // Live hoort de pijl uit het klassement te komen.
    expect(screen.getByText("▲4")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Vorige speeldag" }));
    fireEvent.click(screen.getByRole("button", { name: "Volgende speeldag" }));

    // Terug op het laatste frame — maar nog steeds ín de film: Inhaler klom die
    // dag van #2 naar #1. Eerder klapte hier alles terug op de live waarden.
    expect(screen.queryByText("▲4")).toBeNull();
    expect(screen.getByText("▲1")).toBeInTheDocument();
  });

  it("bepaalt de gevechten op het getoonde frame en niet op de stand van nu", () => {
    // Nu klitten p2, p3 en p4 samen; op de startdag stonden ze ver uit elkaar.
    const rows = [
      row("p1", 1100, { rank: 1 }),
      row("p2", 1050, { rank: 2 }),
      row("p3", 1045, {
        rank: 3,
        history: [{ match_id: "m1", rating_before: 990, rating_after: 1045, delta: 55, played_at: "2026-08-05T20:00:00Z" }],
      }),
      row("p4", 1040, {
        rank: 4,
        history: [{ match_id: "m2", rating_before: 900, rating_after: 1040, delta: 140, played_at: "2026-08-05T20:00:00Z" }],
      }),
    ];
    const { container } = render(film(rows));
    expect(container.querySelector(".race-pack__label")).toHaveTextContent("#2–#4");

    fireEvent.click(screen.getByRole("button", { name: "Vorige speeldag" }));

    // Op de startdag was er geen gevecht: 1100 / 1050 / 990 / 900.
    expect(container.querySelector(".race-pack")).toBeNull();
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

  it("houdt de bediening in beeld, met de as en de poorten eronder", () => {
    const { container } = render(film(filmRows()));
    // Alleen als directe zoon van de baan blijft de balk over de volle hoogte
    // plakken; in de kop stopte hij bij de eerste veeg (#1254).
    expect(
      container.querySelector(".race-board > .race-tijdlijn"),
    ).not.toBeNull();

    const css = readFileSync("src/features/standings/components/RaceLeaderboard.css", "utf8");
    expect(css).toMatch(/\.race-tijdlijn\s*\{[^}]*position:\s*sticky/);
    const mobile = css.slice(css.indexOf("@media (max-width: 720px)"));
    // De as mag niet ónder de balk verdwijnen: zijn offset telt de gemeten
    // hoogte van de balk mee.
    expect(mobile).toMatch(/--race-tijdlijn-h/);
  });
});
