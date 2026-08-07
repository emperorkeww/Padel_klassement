import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@/ui/ToastProvider";
import type { WeekDay } from "@/features/availability/api";

const NOW = "2026-08-07T10:00:00.000Z";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: {} }) };
});
// Het weer is een zijpad in de wizard; hier gaat het om de dagkeuze.
vi.mock("@/features/availability/weatherApi", () => ({
  getWeekWeather: () => Promise.resolve(null),
}));

import { PollWizard } from "./PollWizard";

const CLUB = {
  id: "91d8d419-3736-498e-90be-362de786d588",
  name: "LAGO CLUB Padel Beveren",
  city: "Beveren",
  timezone: "Europe/Brussels",
};

const TODAY = "2026-08-07";

/** Zeven dagen met één vrij avondslot elk — genoeg om de navigator te vullen. */
function week(): WeekDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${TODAY}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);
    return {
      date,
      error: null,
      data: {
        open: "08:00",
        close: "23:00",
        timeZone: CLUB.timezone,
        source: "live",
        fetchedAt: null,
        courts: [
          {
            court: { id: `c${i}`, name: "Baan 1", type: "indoor" },
            free: new Map([["20:00", [{ duration: 90, price: "20" }]]]),
          },
        ],
      },
    } as unknown as WeekDay;
  });
}

function toon(initialDay?: string, club = CLUB) {
  render(
    <MemoryRouter>
      <ToastProvider>
        <PollWizard
          today={TODAY}
          week={week()}
          weekLoading={false}
          club={club}
          initialDay={initialDay}
          submitLabel={(n) => `Start poll (${n})`}
          onSubmit={() => Promise.resolve()}
          onClose={() => {}}
          onDone={() => {}}
        />
      </ToastProvider>
    </MemoryRouter>,
  );
}

const manueleDatum = () =>
  screen.getByLabelText("Datum") as HTMLInputElement;

describe("<PollWizard initialDay />", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(NOW));
  });
  afterEach(() => vi.useRealTimers());

  it("opent zonder initialDay gewoon op vandaag", () => {
    toon();
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("7");
    expect(manueleDatum().value).toBe("");
  });

  it("selecteert een dag binnen het beschikbaarheidsvenster", () => {
    toon("2026-08-11");
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("11");
    // Binnen het venster hoort de handmatige weg dicht te blijven.
    expect(manueleDatum().value).toBe("");
    expect(screen.getByText("Ander moment (verder vooruit)").closest("details"))
      .not.toHaveAttribute("open");
  });

  it("houdt een dag daarbuiten vast in de navigator", () => {
    // 26 augustus valt ver buiten de zeven dagen waarvoor we banen kennen. De
    // navigator viel daarvoor terug op vandaag (#1091), en dan stonden de vrije
    // uren van vandáág groot in beeld onder een dag die je nooit koos — één tik
    // en de poll stond op de verkeerde dag.
    toon("2026-08-26");
    expect(screen.getByRole("tab", { selected: true })).toHaveAccessibleName(
      "woensdag 26 augustus",
    );
    // Zonder banengegevens valt er niets aan te tikken; het uur zet je hieronder.
    expect(
      screen.getByText(/Zo ver vooruit zijn de vrije banen nog niet bekend/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^20:00/ })).toBeNull();
    expect(manueleDatum().value).toBe("2026-08-26");
    expect(screen.getByText("Ander moment (verder vooruit)").closest("details"))
      .toHaveAttribute("open");
  });

  it("maakt een dag daarbuiten wél kiesbaar bij een handmatige locatie", () => {
    // Zonder Playtomic-tenant komen de uren uit het synthetische halfuur-raster
    // (#322), en dat kent elke datum — de dag voorbij het venster is dus meteen
    // aan te tikken in plaats van alleen via het handmatige paneel.
    toon("2026-08-26", { ...CLUB, id: "" });
    expect(screen.getByRole("tab", { selected: true })).toHaveAccessibleName(
      "woensdag 26 augustus",
    );
    expect(screen.getByRole("button", { name: /^20:00/ })).toBeInTheDocument();
  });

  it("negeert een dag in het verleden", () => {
    toon("2026-07-30");
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("7");
    expect(manueleDatum().value).toBe("");
  });
});
