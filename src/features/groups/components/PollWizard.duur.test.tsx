import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@/ui/ToastProvider";
import type { WeekDay } from "@/features/availability/api";
import type { NewPollOption } from "@/features/groups/pollsApi";

/* #1308 — de duur was een val.
 *
 * `toggle()` schrijft de duur van dát moment mee in de selectie, maar de
 * select erboven veranderde daarna alleen het slotraster. De chip in de voet
 * noemde de duur nergens, dus er was geen enkele plek waar de twee waarheden
 * elkaar tegenkwamen: gemeten in de echte app kies je 21:30 bij 90 minuten,
 * zet je de duur op 120, en publiceer je 90 terwijl het scherm 120 zegt.
 *
 * De keuze hier is: elk moment houdt zijn eigen duur (dat kan het datamodel
 * al — `play_poll_options.duration` staat per rij) en de wizard toont hem.
 */

const NOW = "2026-08-07T10:00:00.000Z";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: {} }) };
});
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

/** Eén dag met twee vrije avondslots: 20:00 kan 60, 90 én 120 minuten,
 *  21:00 alleen 60. Zo verdwijnt er een slot zodra de duur omhooggaat —
 *  precies het scenario uit de melding. */
function week(): WeekDay[] {
  return [
    {
      date: TODAY,
      error: null,
      data: {
        open: "08:00",
        close: "23:59",
        timeZone: CLUB.timezone,
        source: "live",
        fetchedAt: null,
        courts: [
          {
            court: { id: "c1", name: "Baan 1", type: "indoor" },
            free: new Map([
              ["20:00", [{ duration: 60 }, { duration: 90 }, { duration: 120 }]],
              ["21:00", [{ duration: 60 }]],
            ]),
          },
        ],
      },
    } as unknown as WeekDay,
  ];
}

function toon(onSubmit: (opts: NewPollOption[]) => Promise<void>) {
  render(
    <MemoryRouter>
      <ToastProvider>
        <PollWizard
          today={TODAY}
          week={week()}
          weekLoading={false}
          club={CLUB}
          submitLabel={(n) => `Start speeldag (${n})`}
          onSubmit={(opts) => onSubmit(opts)}
          onClose={() => {}}
          onDone={() => {}}
        />
      </ToastProvider>
    </MemoryRouter>,
  );
}

const duurKiezer = () => screen.getByLabelText(/duur/i);

describe("<PollWizard /> — de duur hoort bij het moment (#1308)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(NOW));
  });
  afterEach(() => vi.useRealTimers());

  it("publiceert de duur die op de chip staat, ook na een wissel", async () => {
    const onSubmit = vi.fn<(opts: NewPollOption[]) => Promise<void>>(
      () => Promise.resolve(),
    );
    toon(onSubmit);

    // 21:00 kan alleen 60 minuten; kies hem bij de standaardduur van 90 → hij
    // staat er niet. Neem dus 20:00 op 90.
    await userEvent.click(screen.getByRole("button", { name: /^20:00/ }));
    expect(screen.getByText(/vr 7 aug\.? 20:00 · 90 min/)).toBeInTheDocument();

    // Nu de duur omzetten: het raster herberekent, de keuze niet.
    await userEvent.selectOptions(duurKiezer(), "120");
    expect(screen.getByText(/vr 7 aug\.? 20:00 · 90 min/)).toBeInTheDocument();
    expect(
      screen.getByText(/gekozen momenten houden de hunne/i),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /Start speeldag \(1\)/ }),
    );
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit.mock.calls[0][0]).toEqual([
      expect.objectContaining({ startTime: "20:00", duration: 90 }),
    ]);
  });

  it("geeft een moment dat je ná de wissel kiest de nieuwe duur", async () => {
    const onSubmit = vi.fn(() => Promise.resolve());
    toon(onSubmit);

    await userEvent.selectOptions(duurKiezer(), "60");
    await userEvent.click(screen.getByRole("button", { name: /^20:00/ }));
    await userEvent.click(screen.getByRole("button", { name: /^21:00/ }));

    expect(screen.getByText(/vr 7 aug\.? 20:00 · 1 uur/)).toBeInTheDocument();
    expect(screen.getByText(/vr 7 aug\.? 21:00 · 1 uur/)).toBeInTheDocument();
    // Eén duur voor allebei: dan is er niets uit te leggen.
    expect(
      screen.queryByText(/gekozen momenten houden de hunne/i),
    ).not.toBeInTheDocument();
  });

  it("houdt de plek van dagen en uren vrij terwijl ze laden", () => {
    // Zonder deze vorm stond er één dagchip en de regel "Vrije banen laden…",
    // en sprongen er zodra het antwoord kwam zeven dagen plus een raster vol
    // uren bij. Een bottom sheet groeit naar bóven, dus dat voel je als een
    // stuiter onder je duim.
    render(
      <MemoryRouter>
        <ToastProvider>
          <PollWizard
            today={TODAY}
            week={[]}
            weekLoading
            club={CLUB}
            submitLabel={(n) => `Start speeldag (${n})`}
            onSubmit={() => Promise.resolve()}
            onClose={() => {}}
            onDone={() => {}}
          />
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(document.querySelectorAll(".day-chip--skelet")).toHaveLength(7);
    expect(document.querySelectorAll(".slot-chip--skelet")).toHaveLength(10);
    // Voor wie niet kijkt maar luistert blijft het gewoon een melding.
    expect(screen.getByText("Vrije banen laden…")).toBeInTheDocument();
  });

  it("zegt bij de baanteller waar het getal over gaat", () => {
    // "20:00 ①" liet in het midden wát er één is.
    toon(vi.fn(() => Promise.resolve()));
    expect(
      screen.getByText(/het cijfer is het aantal vrije banen/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "20:00 — 1 baan vrij" }),
    ).toBeInTheDocument();
  });
});
