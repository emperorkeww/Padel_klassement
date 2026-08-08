import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Mock } from "vitest";
import { FoutenTab } from "./FoutenTab";
import type { FoutGroep } from "../types";

vi.mock("../api", () => ({ foutenLogboek: vi.fn() }));

const { foutenLogboek } = await import("../api");

function groep(over: Partial<FoutGroep> = {}): FoutGroep {
  return {
    boodschap: "Cannot read properties of undefined (reading 'naam')",
    scope: "route",
    bron: "render",
    chunk: false,
    aantal: 143,
    sessies: 12,
    eerste: "2026-08-07T10:00:00Z",
    laatste: "2026-08-08T11:30:00Z",
    paden: ["/match/1", "/match/2"],
    releases: ["2026-08-07"],
    voorbeeld_stack: "TypeError: kapot\n  at MatchDetail",
    voorbeeld_component_stack: null,
    ...over,
  };
}

describe("<FoutenTab />", () => {
  beforeEach(() => {
    (foutenLogboek as Mock).mockReset();
  });

  it("groepeert op boodschap met aantal en laatste voorkomen", async () => {
    (foutenLogboek as Mock).mockResolvedValue([groep()]);
    render(<FoutenTab />);

    expect(
      await screen.findByText(/Cannot read properties of undefined/),
    ).toBeInTheDocument();
    // Het aantal is de reden dat er gegroepeerd wordt: 143 losse regels zou
    // de tweede, zeldzamere fout onzichtbaar maken.
    expect(screen.getByText("143×")).toBeInTheDocument();
    expect(screen.getByText(/12 sessies/)).toBeInTheDocument();
    expect(screen.getByText(/laatst/)).toBeInTheDocument();
  });

  it("telt de soorten en de meldingen apart", async () => {
    (foutenLogboek as Mock).mockResolvedValue([
      groep({ aantal: 100 }),
      groep({ boodschap: "Failed to fetch", scope: null, aantal: 43 }),
    ]);
    render(<FoutenTab />);

    expect(
      await screen.findByText(/2 soorten fout, 143 meldingen/),
    ).toBeInTheDocument();
  });

  it("verbergt de stack tot je erom vraagt", async () => {
    (foutenLogboek as Mock).mockResolvedValue([groep()]);
    render(<FoutenTab />);

    expect(await screen.findByRole("button", { name: "Toon stack" })).toBeInTheDocument();
    expect(screen.queryByText(/at MatchDetail/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Toon stack" }));
    expect(screen.getByText(/at MatchDetail/)).toBeInTheDocument();
  });

  it("laat een groep zonder stack de knop weg", async () => {
    (foutenLogboek as Mock).mockResolvedValue([
      groep({ voorbeeld_stack: null, voorbeeld_component_stack: null }),
    ]);
    render(<FoutenTab />);

    await screen.findByText(/Cannot read properties/);
    expect(screen.queryByRole("button", { name: "Toon stack" })).not.toBeInTheDocument();
  });

  // Een verdwenen chunk na een deploy is verwacht gedrag (#733) en mag de echte
  // crashes niet ondersneeuwen.
  it("markeert een chunkfout apart", async () => {
    (foutenLogboek as Mock).mockResolvedValue([
      groep({ boodschap: "Loading chunk 42 failed", chunk: true }),
    ]);
    render(<FoutenTab />);

    expect(await screen.findByText("chunk")).toBeInTheDocument();
  });

  it("haalt een ander venster op als je de periode wisselt", async () => {
    (foutenLogboek as Mock).mockResolvedValue([groep()]);
    render(<FoutenTab />);
    await screen.findByText(/Cannot read properties/);

    expect(foutenLogboek).toHaveBeenLastCalledWith(7);

    await userEvent.click(screen.getByRole("button", { name: "30 dagen" }));
    expect(foutenLogboek).toHaveBeenLastCalledWith(30);
  });

  it("meldt geen crashes als goed nieuws, niet als storing", async () => {
    (foutenLogboek as Mock).mockResolvedValue([]);
    render(<FoutenTab />);

    expect(await screen.findByText("Geen crashes")).toBeInTheDocument();
  });
});
