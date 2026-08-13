import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@/ui/ToastProvider";
import type { WeekDay } from "@/features/availability/api";

// #1271 — de knop "Verken alle vrije banen →" staat pal naast de slots die je
// net aantikte, en navigeert de app uit de agenda weg. Het sheet unmount, en je
// hele selectie was daarmee weg: `storageKey` bestond wel, maar geen enkele
// caller zette hem.
//
// Deze suite legt vast wat er precies bewaard wordt. Niet alleen de aangetikte
// momenten: kwam je terug op de verkeerde dag, met een andere duur en het
// handmatige paneel dicht, dan stond je selectie er wel maar zag je hem nergens.

const NOW = "2026-08-07T10:00:00.000Z";
const TODAY = "2026-08-07";
const SLEUTEL = "vamos:poll-concept:g1:2026-08-11";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: {} }) };
});
vi.mock("@/features/availability/weatherApi", () => ({
  getWeekWeather: () => Promise.resolve(null),
}));

import { PollWizard } from "./PollWizard";
import { leesConcept, openstaandConcept } from "@/features/groups/pollConcept";

const CLUB = {
  id: "91d8d419-3736-498e-90be-362de786d588",
  name: "LAGO CLUB Padel Beveren",
  city: "Beveren",
  timezone: "Europe/Brussels",
};

/** Zeven dagen met één vrij avondslot elk. */
function week(): WeekDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${TODAY}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return {
      date: d.toISOString().slice(0, 10),
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
            free: new Map([
              [
                "20:00",
                [
                  { duration: 60, price: "16" },
                  { duration: 90, price: "20" },
                ],
              ],
            ]),
          },
        ],
      },
    } as unknown as WeekDay;
  });
}

function toon(onDone = () => {}, onClose = () => {}) {
  render(
    <MemoryRouter>
      <ToastProvider>
        <PollWizard
          today={TODAY}
          week={week()}
          weekLoading={false}
          club={CLUB}
          initialDay="2026-08-11"
          storageKey={SLEUTEL}
          submitLabel={(n) => `Start poll (${n})`}
          onSubmit={() => Promise.resolve()}
          onClose={onClose}
          onDone={onDone}
        />
      </ToastProvider>
    </MemoryRouter>,
  );
}

async function kiesSlot() {
  await userEvent.click(screen.getByRole("button", { name: /^20:00/ }));
}

describe("<PollWizard /> concept (#1271)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(NOW));
    sessionStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it("bewaart de hele stand zodra je een moment aantikt", async () => {
    toon();
    await userEvent.selectOptions(screen.getByLabelText(/Duur/i), "60");
    await kiesSlot();

    const concept = leesConcept(SLEUTEL);
    expect(concept).not.toBeNull();
    expect(Object.keys(concept!.picked)).toHaveLength(1);
    expect(concept!.selectedDay).toBe("2026-08-11");
    expect(concept!.duration).toBe(60);
  });

  it("herstelt de selectie én de dag bij terugkomst", async () => {
    toon();
    await userEvent.selectOptions(screen.getByLabelText(/Duur/i), "60");
    await kiesSlot();
    screen.getByRole("button", { name: /^Start poll \(1\)$/ });

    // Terug van /banen: hetzelfde sheet, verse mount.
    cleanup();
    toon();

    expect(
      screen.getByRole("button", { name: /^Start poll \(1\)$/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("11");
    expect(screen.getByLabelText(/Duur/i)).toHaveValue("60");
  });

  it("wist het concept bij Annuleren — dat is een besluit, geen omweg", async () => {
    toon();
    await kiesSlot();
    expect(openstaandConcept()).not.toBeNull();

    await userEvent.click(screen.getByRole("button", { name: /annuleren/i }));
    expect(openstaandConcept()).toBeNull();
  });

  it("wist het concept zodra de poll er staat", async () => {
    toon();
    await kiesSlot();
    await userEvent.click(
      screen.getByRole("button", { name: /^Start poll \(1\)$/ }),
    );
    expect(openstaandConcept()).toBeNull();
  });

  it("laat de agenda weten welke wizard er openstond", async () => {
    toon();
    await kiesSlot();
    expect(openstaandConcept()).toEqual({
      groupId: "g1",
      initialDay: "2026-08-11",
    });
  });
});
