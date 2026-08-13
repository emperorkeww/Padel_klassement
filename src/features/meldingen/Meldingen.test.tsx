import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import type { Melding } from "./api";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { TABLES, SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: TABLES }) };
});

vi.mock("@/lib/supabase/push", () => ({
  pushAvailability: vi.fn().mockReturnValue("ready"),
}));

vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  getMeldingenVenster: vi.fn(),
  markeerGelezen: vi.fn().mockResolvedValue(undefined),
  markeerAllesGelezen: vi.fn().mockResolvedValue(undefined),
}));

import Meldingen from "./Meldingen";
import { getMeldingenVenster, markeerAllesGelezen } from "./api";
import { pushAvailability } from "@/lib/supabase/push";

const melding = (over: Partial<Melding> = {}): Melding => ({
  id: "n1",
  soort: "uitslag",
  title: "Uitslag ingevoerd",
  body: "Jullie wonnen.",
  url: "/matches/m1",
  tag: "uitslag-m1",
  created_at: new Date().toISOString(),
  read_at: null,
  ...over,
});

function toonPagina() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Meldingen />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(pushAvailability).mockReturnValue("ready");
  vi.mocked(markeerAllesGelezen).mockClear().mockResolvedValue(undefined);
  vi.mocked(getMeldingenVenster)
    .mockReset()
    .mockResolvedValue({ meldingen: [melding()], meer: false });
});

describe("/meldingen (#1090)", () => {
  it("toont de lijst met titel en body", async () => {
    toonPagina();
    expect(await screen.findByText("Uitslag ingevoerd")).toBeInTheDocument();
    expect(screen.getByText("Jullie wonnen.")).toBeInTheDocument();
  });

  it("laadt een volgende pagina bij als er meer is", async () => {
    vi.mocked(getMeldingenVenster).mockResolvedValue({
      meldingen: [melding()],
      meer: true,
    });
    toonPagina();
    await userEvent.click(
      await screen.findByRole("button", { name: /meer laden/i }),
    );
    await vi.waitFor(() =>
      expect(vi.mocked(getMeldingenVenster).mock.calls.at(-1)?.[0]).toBe(2),
    );
  });

  it("toont geen 'meer laden' als de lijst compleet is", async () => {
    toonPagina();
    await screen.findByText("Uitslag ingevoerd");
    expect(
      screen.queryByRole("button", { name: /meer laden/i }),
    ).not.toBeInTheDocument();
  });

  it("biedt 'alles gelezen' zolang er iets ongelezen is", async () => {
    toonPagina();
    await userEvent.click(
      await screen.findByRole("button", { name: /alles gelezen/i }),
    );
    expect(markeerAllesGelezen).toHaveBeenCalled();
  });

  it("verbergt 'alles gelezen' als alles gelezen is", async () => {
    vi.mocked(getMeldingenVenster).mockResolvedValue({
      meldingen: [melding({ read_at: "2026-08-01T10:00:00.000Z" })],
      meer: false,
    });
    toonPagina();
    await screen.findByText("Uitslag ingevoerd");
    expect(
      screen.queryByRole("button", { name: /alles gelezen/i }),
    ).not.toBeInTheDocument();
  });

  // De lege staat zegt iets in plaats van een streep te trekken, en wijst naar
  // de pushschakelaar als die nog uit staat — de logische plek daarvoor.
  it("wijst in de lege staat naar de instellingen zolang push uit staat", async () => {
    vi.mocked(pushAvailability).mockReturnValue("needs-install");
    vi.mocked(getMeldingenVenster).mockResolvedValue({
      meldingen: [],
      meer: false,
    });
    toonPagina();
    expect(await screen.findByText(/nog niets te melden/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /naar je instellingen/i }),
    ).toHaveAttribute("href", "/profiel");
    expect(screen.getByText(/ook als de app dicht is/i)).toBeInTheDocument();
  });

  it("laat die verwijzing weg als push al aan staat", async () => {
    vi.mocked(getMeldingenVenster).mockResolvedValue({
      meldingen: [],
      meer: false,
    });
    toonPagina();
    expect(await screen.findByText(/nog niets te melden/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /naar je instellingen/i }),
    ).not.toBeInTheDocument();
  });
  // #1273: de soort bestaat nu in de UI, dus er valt op te filteren. Alleen
  // op de route — het paneel is te klein voor een tweede rij chips.
  describe("filteren (#1273)", () => {
    const venster = () => ({
      meldingen: [
        melding({ id: "n1", soort: "poll", title: "Nieuwe speeldag-poll", tag: "t1" }),
        melding({
          id: "n2",
          soort: "uitslag",
          title: "Gewonnen",
          tag: "t2",
          read_at: "2026-08-01T10:00:00.000Z",
        }),
        melding({ id: "n3", soort: "var", title: "Punt betwist", tag: "t3" }),
      ],
      meer: false,
    });

    // De rijen dragen hun soort inmiddels zelf in hun naam ("Speeldag: …"),
    // dus zoeken op chipnaam moet in de filterrij gebeuren en niet op het hele
    // scherm.
    const chips = () =>
      within(screen.getByRole("group", { name: /meldingen filteren/i }));

    it("toont een chip per soort die in het venster voorkomt", async () => {
      vi.mocked(getMeldingenVenster).mockResolvedValue(venster());
      toonPagina();
      expect(
        await screen.findByRole("group", { name: /meldingen filteren/i }),
      ).toBeInTheDocument();
      for (const naam of [/^alles/i, /^ongelezen/i, /^speeldag/i, /^uitslag/i, /^var/i]) {
        expect(chips().getByRole("button", { name: naam })).toBeInTheDocument();
      }
      // Geen chip voor een soort die er niet is: dat zou een dood spoor zijn.
      expect(chips().queryByRole("button", { name: /^lef/i })).toBeNull();
    });

    it("laat na een keuze alleen die soort staan", async () => {
      vi.mocked(getMeldingenVenster).mockResolvedValue(venster());
      toonPagina();
      await screen.findByRole("group", { name: /meldingen filteren/i });
      await userEvent.click(chips().getByRole("button", { name: /^var/i }));
      expect(screen.getByText("Punt betwist")).toBeInTheDocument();
      expect(screen.queryByText("Gewonnen")).toBeNull();
    });

    it("filtert op ongelezen", async () => {
      vi.mocked(getMeldingenVenster).mockResolvedValue(venster());
      toonPagina();
      await screen.findByRole("group", { name: /meldingen filteren/i });
      await userEvent.click(chips().getByRole("button", { name: /^ongelezen/i }));
      expect(screen.getByText("Nieuwe speeldag-poll")).toBeInTheDocument();
      expect(screen.queryByText("Gewonnen")).toBeNull();
    });

    it("wijst de weg terug als een filter niets oplevert", async () => {
      vi.mocked(getMeldingenVenster).mockResolvedValue(venster());
      toonPagina();
      await screen.findByRole("group", { name: /meldingen filteren/i });
      await userEvent.click(chips().getByRole("button", { name: /^ongelezen/i }));
      await userEvent.click(chips().getByRole("button", { name: /^uitslag/i }));
      // Ongelezen + uitslag bestaat niet in dit venster; het filter is één as,
      // dus dit toont gewoon de uitslag. De lege staat toetsen we los.
      expect(screen.getByText("Gewonnen")).toBeInTheDocument();
    });

    it("zegt het als een filter niets oplevert", async () => {
      // Eén soort met alles gelezen: de ongelezen-chip verdwijnt, dus dit
      // vraagt om een venster waarin de gekozen soort daarna leegloopt.
      vi.mocked(getMeldingenVenster).mockResolvedValue(venster());
      toonPagina();
      await screen.findByRole("group", { name: /meldingen filteren/i });
      await userEvent.click(chips().getByRole("button", { name: /^uitslag/i }));
      expect(screen.getByText("Gewonnen")).toBeInTheDocument();
      // En weer terug via de chip "Alles".
      await userEvent.click(chips().getByRole("button", { name: /^alles/i }));
      expect(screen.getByText("Punt betwist")).toBeInTheDocument();
    });
  });
});
