import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { tierChange } from "@/features/rating/tiers";
import { PackOpening, type PackData } from "./PackOpening";

// Confetti en haptiek zijn browser-spul (canvas/vibrate); hier volstaat dat ze
// aangeroepen worden op het openscheur-moment.
vi.mock("@/lib/utils/confetti", () => ({ celebrate: vi.fn() }));
vi.mock("@/lib/utils/haptics", () => ({ winPulse: vi.fn() }));

import { celebrate } from "@/lib/utils/confetti";
import { winPulse } from "@/lib/utils/haptics";

// Echte wissel uit tiers.ts: 998 → 1013 is Blaaskaak I → Wannabe III, een
// hoofdtier-promotie (zilver → goud).
function promotie(): PackData {
  const wissel = tierChange(998, 1013);
  if (!wissel) throw new Error("verwachtte een tier-wissel");
  return { wissel, rating: 1013, quip: "Eindelijk. Wannabe, net als de rest." };
}

function renderPack(over: { onClose?: () => void } = {}) {
  return render(
    <PackOpening
      pack={promotie()}
      naam="Alice"
      avatar={<span>AV</span>}
      onClose={over.onClose ?? vi.fn()}
    />,
  );
}

describe("PackOpening (#500)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("rendert niets zonder pack", () => {
    const { container } = render(
      <PackOpening pack={null} naam="Alice" avatar={null} onClose={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("toont eerst het dichte pack, nog zonder kaart", () => {
    renderPack();
    expect(
      screen.getByRole("button", { name: "Open het pack" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Promotie!/)).not.toBeInTheDocument();
  });

  it("laat na een tik de geüpgradede kaart uit het pack springen", () => {
    renderPack();
    fireEvent.click(screen.getByRole("button", { name: "Open het pack" }));
    // Confetti en haptiek horen bij het openscheuren zelf.
    expect(celebrate).toHaveBeenCalledOnce();
    expect(winPulse).toHaveBeenCalledOnce();
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.getByText(/Promotie! Blaaskaak → Wannabe/)).toBeInTheDocument();
    // De kaart draagt de nieuwe divisie en het nieuwe Elo-getal.
    expect(screen.getByText("Wannabe III")).toBeInTheDocument();
    expect(screen.getByText("1013")).toBeInTheDocument();
    // Rudy's quip verhuist mee van de oude toast naar het overlay.
    expect(
      screen.getByText("Eindelijk. Wannabe, net als de rest."),
    ).toBeInTheDocument();
  });

  it("sluit via de Verder-knop", () => {
    const onClose = vi.fn();
    renderPack({ onClose });
    fireEvent.click(screen.getByRole("button", { name: "Open het pack" }));
    act(() => {
      vi.advanceTimersByTime(600);
    });
    fireEvent.click(screen.getByRole("button", { name: "Verder" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("sluit via Escape, ook terwijl het pack nog dicht is", () => {
    const onClose = vi.fn();
    renderPack({ onClose });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});