import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { tierChange, tierFor } from "@/features/rating/tiers";
import type { FutPlaystyle } from "@/features/rating/components/FutKaart";
import { PackOpening, type PackData } from "./PackOpening";

// Confetti en haptiek zijn browser-spul (canvas/vibrate); hier volstaat dat ze
// aangeroepen worden op het openscheur-moment. Het paarse palet blijft echt,
// zodat de badge-suite kan asserten waarmee celebrate wordt aangeroepen.
vi.mock("@/lib/utils/confetti", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/utils/confetti")>()),
  celebrate: vi.fn(),
}));
vi.mock("@/lib/utils/haptics", () => ({ winPulse: vi.fn() }));
vi.mock("@/lib/utils/motion", () => ({
  prefersReducedMotion: vi.fn(() => false),
}));

import { celebrate, BADGE_CONFETTI } from "@/lib/utils/confetti";
import { winPulse } from "@/lib/utils/haptics";
import { prefersReducedMotion } from "@/lib/utils/motion";

// Echte wissel uit tiers.ts: 998 → 1013 is Blaaskaak I → Wannabe III, een
// hoofdtier-promotie (zilver → goud).
function promotie(): PackData {
  const wissel = tierChange(998, 1013);
  if (!wissel) throw new Error("verwachtte een tier-wissel");
  return {
    soort: "promotie",
    wissel,
    rating: 1013,
    quip: "Eindelijk. Wannabe, net als de rest.",
  };
}

// Zeldzame badge (#615): de kaart toont de bestaande divisie bij die rating.
function badgePack(): PackData {
  return {
    soort: "badge",
    badge: { id: "perfectionist", naam: "Perfectionist", emoji: "💎" },
    rating: 1013,
    tier: tierFor(1013),
    quip: "Zeldzaam spul: 💎 Perfectionist.",
  };
}

function renderPack(
  over: {
    onClose?: () => void;
    pack?: PackData;
    playstyles?: FutPlaystyle[];
  } = {},
) {
  return render(
    <PackOpening
      pack={over.pack ?? promotie()}
      naam="Alice"
      avatar={<span>AV</span>}
      playstyles={over.playstyles}
      onClose={over.onClose ?? vi.fn()}
    />,
  );
}

describe("PackOpening (#500)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(prefersReducedMotion).mockReturnValue(false);
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

describe("PackOpening — zeldzame badge (#615)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(prefersReducedMotion).mockReturnValue(false);
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("draagt de paarse modifier en noemt de badge in het aria-label", () => {
    renderPack({ pack: badgePack() });
    const dialog = screen.getByRole("dialog", {
      name: "Zeldzame badge: Perfectionist",
    });
    expect(dialog).toHaveClass("pack-opening--badge");
    expect(screen.getByText("Zeldzame badge")).toBeInTheDocument();
  });

  it("viert het openscheuren met het paarse confetti-palet", () => {
    renderPack({ pack: badgePack() });
    fireEvent.click(screen.getByRole("button", { name: "Open het pack" }));
    expect(celebrate).toHaveBeenCalledOnce();
    expect(celebrate).toHaveBeenCalledWith(BADGE_CONFETTI);
    expect(winPulse).toHaveBeenCalledOnce();
  });

  it("toont banner, huidige divisie en de nieuwe badge als pulserende chip", () => {
    renderPack({ pack: badgePack() });
    fireEvent.click(screen.getByRole("button", { name: "Open het pack" }));
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(
      screen.getByText(/Zeldzame badge · 💎 Perfectionist/),
    ).toBeInTheDocument();
    // Geen wissel: de kaart draagt de bestaande divisie bij rating 1013.
    expect(screen.getByText("Wannabe III")).toBeInTheDocument();
    expect(screen.getByText("1013")).toBeInTheDocument();
    const chip = screen.getByRole("listitem", { name: "Perfectionist" });
    expect(chip).toHaveClass("fut-kaart__playstyle--nieuw");
    expect(screen.getByText("Zeldzaam spul: 💎 Perfectionist.")).toBeInTheDocument();
  });

  it("zet de nieuwe badge vooraan tussen de uitgelichte chips, gededupliceerd", () => {
    renderPack({
      pack: badgePack(),
      playstyles: [
        { id: "perfectionist", naam: "Perfectionist", emoji: "💎" },
        { id: "comebackkoning", naam: "Comebackkoning", emoji: "👑" },
        { id: "ironman", naam: "Ironman", emoji: "🏋️" },
        { id: "feniks", naam: "Feniks", emoji: "🐦‍🔥" },
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: "Open het pack" }));
    act(() => {
      vi.advanceTimersByTime(600);
    });
    // Dedup + cap op 3: perfectionist maar één keer, feniks valt af.
    const chips = screen.getAllByRole("listitem");
    expect(chips.map((c) => c.getAttribute("aria-label"))).toEqual([
      "Perfectionist",
      "Comebackkoning",
      "Ironman",
    ]);
    expect(chips[0]).toHaveClass("fut-kaart__playstyle--nieuw");
    expect(chips[1]).not.toHaveClass("fut-kaart__playstyle--nieuw");
  });

  it("slaat het pack over bij verminderde beweging: kaart direct", () => {
    vi.mocked(prefersReducedMotion).mockReturnValue(true);
    renderPack({ pack: badgePack() });
    expect(
      screen.queryByRole("button", { name: "Open het pack" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Zeldzame badge · 💎 Perfectionist/),
    ).toBeInTheDocument();
    expect(celebrate).not.toHaveBeenCalled();
  });
});