import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { ToastProvider } from "../../components/ToastProvider";
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

// Tenant-details per id; DEFAULT_CLUB hoort erbij omdat het raster de
// gegevens van de huidige club ook altijd ophaalt.
const TENANTS: Record<string, unknown> = {
  [DEFAULT_CLUB.id]: {
    tenant_name: DEFAULT_CLUB.name,
    address: { city: DEFAULT_CLUB.city, timezone: DEFAULT_CLUB.timezone },
  },
  "t-gent": {
    tenant_name: "Padel Gent",
    address: { city: "Gent", timezone: "Europe/Brussels" },
  },
};

function mockFetch() {
  const mockRes = (body: unknown, ok = true, status = 200) =>
    ({ ok, status, json: async () => body }) as Response;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/v1/tenants/")) {
        const id = url.split("/v1/tenants/")[1];
        const tenant = TENANTS[id];
        return tenant ? mockRes(tenant) : mockRes({}, false, 404);
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
