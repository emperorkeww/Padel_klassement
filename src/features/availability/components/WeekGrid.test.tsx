import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

// api.ts importeert het snapshot-leespad (#405) en dus de supabase-client;
// in de testomgeving bestaat die env niet, dus mocken.
vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  return { supabase: makeSupabaseMock() };
});
import { WeekGrid } from "@/features/availability/components/WeekGrid";
import type { DayAvailability, WeekDay } from "@/features/availability/api";

function day(
  date: string,
  courts: { name: string; free: [string, number[]][] }[],
): WeekDay {
  const data: DayAvailability = {
    open: "16:00",
    close: "18:00",
    timeZone: "Europe/Brussels",
    source: "live",
    fetchedAt: null,
    courts: courts.map((c, i) => ({
      court: { id: `c${i}`, name: c.name, type: "roofed" },
      free: new Map(
        c.free.map(([t, durations]) => [
          t,
          durations.map((d) => ({ duration: d, price: "€ 20", perPerson: "€ 5" })),
        ]),
      ),
    })),
  };
  return { date, data, error: null };
}

// Toekomstige week (geen "voorbij"-cellen); as 16:00–18:00 = 4 halfuren.
const week: WeekDay[] = [
  day("2099-01-01", [
    { name: "Terrein 1", free: [["16:00", [60, 90]], ["16:30", [60]]] },
    { name: "Terrein 2", free: [["16:00", [90]]] },
    { name: "Terrein 3", free: [["16:00", [60]]] },
  ]),
  day("2099-01-02", [
    { name: "Terrein 1", free: [] },
    { name: "Terrein 2", free: [["17:30", [120]]] },
    { name: "Terrein 3", free: [] },
  ]),
  { date: "2099-01-03", data: null, error: "Kon de beschikbaarheid niet laden." },
];

describe("WeekGrid", () => {
  it("toont per baanstrip dezelfde toestanden als de dagweergave", () => {
    const { container } = render(
      <WeekGrid week={week} duration={null} onPickDay={() => {}} />,
    );

    // Dag 1: T1 vrij om 16:00+16:30, T2 en T3 om 16:00; dag 2: T2 om 17:30.
    expect(screen.getAllByRole("button")).toHaveLength(5);
    // Staarten van de slots (T1 17:00; T2 16:30+17:00; T3 16:30).
    expect(container.querySelectorAll(".avail-cell--nofit")).toHaveLength(4);
    // Rest is echt bezet: 4 (dag 1) + 11 (dag 2).
    expect(container.querySelectorAll(".avail-cell--busy")).toHaveLength(15);
    // Foutdag levert één melding over de hele rij, geen cellen.
    expect(screen.getByText("Kon de beschikbaarheid niet laden.")).toBeInTheDocument();
  });

  it("duurfilter: starts zonder die duur worden vrij-maar-niet-boekbaar", () => {
    const { container } = render(
      <WeekGrid week={week} duration={90} onPickDay={() => {}} />,
    );

    // Alleen T1 en T2 hebben om 16:00 een 90-minutenslot.
    expect(screen.getAllByRole("button")).toHaveLength(2);
    // T1 16:30 (60), T3 16:00 (60) en dag-2 T2 17:30 (120) schuiven naar nofit.
    expect(container.querySelectorAll(".avail-cell--nofit")).toHaveLength(7);
    expect(container.querySelectorAll(".avail-cell--busy")).toHaveLength(15);
  });

  it("klik op een vrije strip opent de dagweergave van die dag", () => {
    const onPickDay = vi.fn();
    render(<WeekGrid week={week} duration={null} onPickDay={onPickDay} />);

    fireEvent.click(
      screen.getByRole("button", { name: /2 jan.*Terrein 2.*17:30/i }),
    );
    expect(onPickDay).toHaveBeenCalledWith("2099-01-02");
  });

  it("baanstrips dragen een kort baanlabel (T1–T3)", () => {
    render(<WeekGrid week={week} duration={null} onPickDay={() => {}} />);
    // Twee geladen dagen × drie banen.
    expect(screen.getAllByText("T1")).toHaveLength(2);
    expect(screen.getAllByText("T3")).toHaveLength(2);
  });

  it("foutdag toont de Playtomic-terugval-link (#405)", () => {
    render(<WeekGrid week={week} duration={null} onPickDay={() => {}} />);

    const link = screen.getByRole("link", { name: /bekijk op playtomic/i });
    // De synchrone playtomic.io-URL gaat niet door de WAF en werkt dus ook
    // tijdens een blokkade; het club-id komt uit useClub (DEFAULT_CLUB).
    expect(link.getAttribute("href")).toMatch(
      /^https:\/\/playtomic\.io\/clubs\//,
    );
  });
});
