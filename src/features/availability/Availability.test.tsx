import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

// Snapshot-leespad (#405) gemockt: standaard geen snapshot (het leespad valt
// dan terug op de fetch-mock); per test overschrijfbaar.
vi.mock("./snapshotApi", () => ({
  getSnapshot: vi.fn(),
  getSnapshots: vi.fn(),
}));

import { beforeEach } from "vitest";
import { getSnapshot, getSnapshots } from "./snapshotApi";

import { ToastProvider } from "@/ui/ToastProvider";
import { Availability } from "./Availability";
import { DEFAULT_CLUB, getClub, setClub } from "./club";

// De ?club=-parameter uit een gedeelde link: clubgegevens ophalen, overnemen
// en de parameter uit de URL halen (zie het effect in Availability.tsx).

function LocationProbe() {
  return <span data-testid="search">{useLocation().search}</span>;
}

beforeEach(() => {
  vi.mocked(getSnapshot).mockReset().mockResolvedValue(null);
  vi.mocked(getSnapshots).mockReset().mockResolvedValue(new Map());
});

function renderBanen(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/banen${search}`]}>
      <ToastProvider>
        <Availability />
        <LocationProbe />
      </ToastProvider>
    </MemoryRouter>,
  );
}

// Slug per tenant-id (voor fetchClub bij een gedeelde ?club=-link). Er is geen
// clubdetail-endpoint meer (#385); de naam volgt uit de slug.
const SLUGS: Record<string, string> = {
  "t-gent": "padel-gent",
};

function mockFetch() {
  const mockRes = (body: unknown, ok = true, status = 200) =>
    ({ ok, status, json: async () => body }) as Response;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/club-slug/")) {
        const id = url.split("/club-slug/")[1];
        const slug = SLUGS[id];
        return slug ? mockRes({ slug }) : mockRes({}, false, 404);
      }
      return mockRes([]); // beschikbaarheid: leeg raster volstaat hier
    }),
  );
}

describe("Availability met ?club=", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setClub(DEFAULT_CLUB);
  });

  it("neemt de gedeelde club over en haalt de parameter uit de URL", async () => {
    mockFetch();
    renderBanen("?club=t-gent");

    await waitFor(() => expect(getClub().id).toBe("t-gent"));
    // De ClubPicker toont de overgenomen club.
    expect(await screen.findByText(/Padel Gent/)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("search")).not.toHaveTextContent("club="),
    );
  });

  it("ongeldig club-id: huidige club blijft staan, parameter verdwijnt", async () => {
    mockFetch();
    renderBanen("?club=t-bestaat-niet");

    await waitFor(() =>
      expect(screen.getByTestId("search")).not.toHaveTextContent("club="),
    );
    expect(getClub().id).toBe(DEFAULT_CLUB.id);
  });

  it("club-id gelijk aan de huidige club: alleen de parameter verdwijnt", async () => {
    mockFetch();
    renderBanen(`?club=${DEFAULT_CLUB.id}&datum=2099-01-01`);

    await waitFor(() =>
      expect(screen.getByTestId("search")).not.toHaveTextContent("club="),
    );
    // Andere parameters (zoals de gedeelde datum) blijven bewaard.
    expect(screen.getByTestId("search")).toHaveTextContent("datum=2099-01-01");
    expect(getClub().id).toBe(DEFAULT_CLUB.id);
  });
});

// Degradatie en versheid (#405): bij een blokkade een eerlijke lege staat
// met de werkende reserveerlink; bij snapshot-data een "laatst bijgewerkt".
describe("Availability — degradatie en versheid (#405)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setClub(DEFAULT_CLUB);
  });

  const RAW = [
    {
      resource_id: "81ba479c-66f6-4568-a450-db6df2f5c589",
      start_date: "2099-01-01",
      slots: [{ start_time: "14:00:00", duration: 60, price: "20 EUR" }],
    },
  ];

  const mockBlockedFetch = () =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) }) as Response),
    );

  it("blokkade zonder snapshot: degradatiekaart met Playtomic-link", async () => {
    mockBlockedFetch();
    renderBanen("?datum=2099-01-01");

    expect(
      await screen.findByText("Beschikbaarheid nu niet op te halen"),
    ).toBeInTheDocument();
    expect(screen.getByText(/blokkeert/i)).toBeInTheDocument();
    const link = screen.getByRole("link", {
      name: /bekijk beschikbaarheid op playtomic/i,
    });
    // De slug is niet te resolven (403), dus de synchrone terugval-URL.
    expect(link).toHaveAttribute(
      "href",
      `https://playtomic.io/clubs/${DEFAULT_CLUB.id}`,
    );
  });

  it("verse snapshot: raster + stil 'laatst bijgewerkt'-regeltje", async () => {
    mockBlockedFetch(); // live hoeft niet eens bereikbaar te zijn
    vi.mocked(getSnapshot).mockResolvedValue({
      payload: RAW,
      fetchedAt: new Date().toISOString(),
    });
    renderBanen("?datum=2099-01-01");

    expect(await screen.findByText(/laatst bijgewerkt/i)).toBeInTheDocument();
    expect(
      screen.queryByText("Beschikbaarheid nu niet op te halen"),
    ).not.toBeInTheDocument();
  });

  it("blokkade mét verouderde snapshot: raster + 'stand van'-waarschuwing", async () => {
    mockBlockedFetch();
    vi.mocked(getSnapshot).mockResolvedValue({
      payload: RAW,
      fetchedAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
    });
    renderBanen("?datum=2099-01-01");

    expect(
      await screen.findByText(/live gegevens tijdelijk niet bereikbaar/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Beschikbaarheid nu niet op te halen"),
    ).not.toBeInTheDocument();
  });
});

// #920: gedeelde legenda, raster-skeleton, dagnavigatie en de duur-uitleg bij
// het filter waar hij over gaat.
describe("Availability — overzicht en navigatie (#920)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setClub(DEFAULT_CLUB);
  });

  const mockLegeFetch = () =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => [] }) as Response),
    );

  it("toont een laadstaat die op het raster lijkt", () => {
    mockLegeFetch();
    const { container } = renderBanen("");
    // Meteen bij de eerste render, vóór de proxy antwoordt.
    expect(container.querySelector(".avail-sk")).not.toBeNull();
    expect(
      container.querySelectorAll(".avail-sk__cell").length,
    ).toBeGreaterThan(0);
    // De generieke drie-balken-skeleton is hier weg.
    expect(container.querySelector(".skeleton")).toBeNull();
  });

  it("heeft één ingeklapte legenda in plaats van een kopie per weergave", async () => {
    mockLegeFetch();
    renderBanen("");
    const kop = await screen.findByText(/wat betekenen de kleuren/i);
    // Eén bron: DaySection en WeekSection droegen elk hun eigen kopie.
    expect(screen.getAllByText(/wat betekenen de kleuren/i)).toHaveLength(1);

    const details = kop.closest("details")!;
    expect(details.open).toBe(false);
  });

  it("bladert per dag en blokkeert terug vóór vandaag", async () => {
    mockLegeFetch();
    renderBanen("");
    const vorige = await screen.findByRole("button", { name: /vorige dag/i });
    // Op vandaag valt er niets terug te bladeren.
    expect(vorige).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /volgende dag/i }));
    await waitFor(() =>
      expect(screen.getByTestId("search")).toHaveTextContent("datum="),
    );
    expect(
      screen.getByRole("button", { name: /vorige dag/i }),
    ).not.toBeDisabled();
  });

  it("verbergt de dagnavigatie in de weekweergave", async () => {
    mockLegeFetch();
    renderBanen("?weergave=week");
    await screen.findByRole("tab", { name: "Week" });
    expect(screen.queryByRole("button", { name: /vorige dag/i })).toBeNull();
    expect(
      screen.getByRole("button", { name: /vorige 7 dagen/i }),
    ).toBeInTheDocument();
  });

  it("zet de duur-uitleg bij het filter, niet in de voetnoot", async () => {
    mockLegeFetch();
    const { container } = renderBanen("");
    await screen.findByRole("group", { name: /duur/i });
    expect(container.querySelector(".avail-duur-uitleg")).toHaveTextContent(
      /vanaf 60 minuten/i,
    );
    // En dus niet verstopt in de ingeklapte legenda.
    const legenda = screen
      .getByText(/wat betekenen de kleuren/i)
      .closest("details")!;
    expect(legenda).not.toHaveTextContent(/vanaf 60 minuten/i);
  });
});
