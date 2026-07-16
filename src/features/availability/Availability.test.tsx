import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { ToastProvider } from "@/ui/ToastProvider";
import { Availability } from "./Availability";
import { DEFAULT_CLUB, getClub, setClub } from "./club";

// De ?club=-parameter uit een gedeelde link: clubgegevens ophalen, overnemen
// en de parameter uit de URL halen (zie het effect in Availability.tsx).

function LocationProbe() {
  return <span data-testid="search">{useLocation().search}</span>;
}

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
