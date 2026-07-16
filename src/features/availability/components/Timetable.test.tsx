import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render as rtlRender, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";

// api.ts importeert het snapshot-leespad (#405) en dus de supabase-client;
// in de testomgeving bestaat die env niet, dus mocken.
vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  return { supabase: makeSupabaseMock() };
});
import { ToastProvider } from "@/ui/ToastProvider";
import { Timetable } from "@/features/availability/components/Timetable";
import type { DayAvailability } from "@/features/availability/api";
import { DEFAULT_CLUB } from "@/features/availability/club";

// Timetable gebruikt useToast (voor de Delen-knop) en moet dus binnen de
// provider gerenderd worden.
function render(ui: ReactElement) {
  return rtlRender(<ToastProvider>{ui}</ToastProvider>);
}

// As 16:00–19:00 (6 halfuren). Dekking: 16:00+90 en 16:30+120 → t/m 18:00
// vrij; alleen 18:30 is echt bezet.
function fixture(): DayAvailability {
  return {
    open: "16:00",
    close: "19:00",
    timeZone: "Europe/Brussels",
    source: "live",
    fetchedAt: null,
    courts: [
      {
        court: { id: "c1", name: "Terrein 1", type: "roofed" },
        free: new Map([
          [
            "16:00",
            [
              { duration: 60, price: "€ 20", perPerson: "€ 5" },
              { duration: 90, price: "€ 30", perPerson: "€ 7,50" },
            ],
          ],
          ["16:30", [{ duration: 120, price: "€ 40", perPerson: "€ 10" }]],
        ]),
      },
    ],
  };
}

// Toekomstige datum: geen "voorbij"-cellen.
const FUTURE = "2099-01-01";

// jsdom heeft geen Web Share/klembord; per test aanzetten, hierna opruimen.
function stubNavigator(props: Record<string, unknown>) {
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(navigator, key, { value, configurable: true });
  }
}

describe("Timetable", () => {
  afterEach(() => {
    vi.useRealTimers();
    delete (navigator as { share?: unknown }).share;
    delete (navigator as { clipboard?: unknown }).clipboard;
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
    expect(popover).toHaveTextContent("120 min · € 40 · € 10 p.p.");
    expect(popover).not.toHaveTextContent("60 min");
  });

  it("popover respecteert het duurfilter", () => {
    render(<Timetable data={fixture()} date={FUTURE} duration={90} />);

    fireEvent.click(screen.getByRole("button")); // 16:00 met 90-filter

    const popover = screen.getByRole("dialog");
    expect(popover).toHaveTextContent("Vrij van 16:00 tot 17:30");
    expect(popover).toHaveTextContent("90 min · € 30 · € 7,50 p.p.");
    expect(popover).not.toHaveTextContent("60 min");
  });

  // 2099-01-01 is een donderdag; getClub() valt in tests terug op de thuisclub.
  it("deelt het slot via het native deelvenster (titel, tekst en link)", async () => {
    const share = vi.fn(async () => {});
    stubNavigator({ share });
    render(<Timetable data={fixture()} date={FUTURE} />);

    fireEvent.click(screen.getAllByRole("button")[1]); // 16:30, 120 min
    fireEvent.click(screen.getByRole("button", { name: "↗ Delen" }));

    await waitFor(() => expect(share).toHaveBeenCalledOnce());
    expect(share).toHaveBeenCalledWith({
      title: `Vrij slot bij ${DEFAULT_CLUB.name}`,
      text: `Terrein 1 vrij van 16:30 tot 18:30 op do 1 januari bij ${DEFAULT_CLUB.name}`,
      url: `${window.location.origin}/banen?datum=${FUTURE}&club=${DEFAULT_CLUB.id}`,
    });
  });

  it("zonder Web Share: kopieert tekst + link en toont een toast", async () => {
    const writeText = vi.fn(async () => {});
    stubNavigator({ clipboard: { writeText } });
    render(<Timetable data={fixture()} date={FUTURE} />);

    fireEvent.click(screen.getAllByRole("button")[1]);
    fireEvent.click(screen.getByRole("button", { name: "↗ Delen" }));

    expect(await screen.findByText("Link gekopieerd.")).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(
      `Terrein 1 vrij van 16:30 tot 18:30 op do 1 januari bij ${DEFAULT_CLUB.name}\n` +
        `${window.location.origin}/banen?datum=${FUTURE}&club=${DEFAULT_CLUB.id}`,
    );
  });

  it("negeert een geannuleerd deelvenster (AbortError), andere fouten tonen een toast", async () => {
    const share = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new DOMException("afgebroken", "AbortError"))
      .mockRejectedValueOnce(new Error("Delen mislukt."));
    stubNavigator({ share });
    render(<Timetable data={fixture()} date={FUTURE} />);

    fireEvent.click(screen.getAllByRole("button")[1]);
    const delen = screen.getByRole("button", { name: "↗ Delen" });

    fireEvent.click(delen); // geannuleerd → stil
    await waitFor(() => expect(share).toHaveBeenCalledOnce());
    expect(screen.queryByText(/mislukt|afgebroken/)).not.toBeInTheDocument();

    fireEvent.click(delen); // echte fout → toast
    expect(await screen.findByText("Delen mislukt.")).toBeInTheDocument();
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
