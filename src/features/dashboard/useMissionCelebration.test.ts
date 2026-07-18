import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

// Gedeelde, muteerbare teststaat: welke missies deriveMissions teruggeeft, de
// weekindex, en de opgevangen realtime-callback zodat we een "uitslag opgeslagen"
// kunnen naspelen. vi.hoisted zodat de mockfabrieken erbij kunnen.
const mocks = vi.hoisted(() => ({
  rtcb: null as null | (() => void),
  missies: [] as { id: string; behaald: boolean }[],
  week: 100,
  celebrate: vi.fn(),
  winPulse: vi.fn(),
  deriveMissions: vi.fn(),
  getPlayerMatches: vi.fn(async () => [] as unknown[]),
  getTeamsMap: vi.fn(async () => ({}) as Record<string, unknown>),
}));

vi.mock("./missions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./missions")>();
  return { ...actual, deriveMissions: mocks.deriveMissions, weekIndex: () => mocks.week };
});
vi.mock("@/features/matches/api", () => ({
  getPlayerMatches: mocks.getPlayerMatches,
  getTeamsMap: mocks.getTeamsMap,
}));
vi.mock("@/lib/hooks/useRealtime", () => ({
  useRealtime: (_table: string, cb: () => void) => {
    mocks.rtcb = cb;
  },
}));
vi.mock("@/lib/utils/confetti", () => ({ celebrate: mocks.celebrate }));
vi.mock("@/lib/utils/haptics", () => ({ winPulse: mocks.winPulse }));

import { useMissionCelebration } from "./useMissionCelebration";

/** Speelt een opgeslagen uitslag na: realtime herlaadt matches + teams. */
async function realtimeRefresh() {
  await act(async () => {
    mocks.rtcb?.();
  });
}

describe("useMissionCelebration", () => {
  beforeEach(() => {
    mocks.rtcb = null;
    mocks.missies = [];
    mocks.week = 100;
    mocks.celebrate.mockClear();
    mocks.winPulse.mockClear();
    mocks.deriveMissions.mockReset();
    mocks.deriveMissions.mockImplementation(() => mocks.missies);
  });

  it("viert niet bij de eerste view, ook al is er al een missie behaald (seed)", async () => {
    // Kandidaat 3/#414: wie maandag speelde en dinsdag pas het dashboard opent,
    // krijgt geen terugwerkende confetti — de eerste snapshot wordt stil geseed.
    mocks.missies = [{ id: "twee-matches", behaald: true }];
    renderHook(() => useMissionCelebration("u1"));

    await waitFor(() => expect(mocks.deriveMissions).toHaveBeenCalled());
    await realtimeRefresh(); // en ook een re-render laat de seed staan
    expect(mocks.celebrate).not.toHaveBeenCalled();
    expect(mocks.winPulse).not.toHaveBeenCalled();
  });

  it("viert één keer zodra een missie live behaald raakt", async () => {
    mocks.missies = [{ id: "twee-matches", behaald: false }];
    renderHook(() => useMissionCelebration("u1"));
    await waitFor(() => expect(mocks.deriveMissions).toHaveBeenCalled());
    expect(mocks.celebrate).not.toHaveBeenCalled();

    // De uitslag komt binnen: de missie flipt naar behaald → confetti.
    mocks.missies = [{ id: "twee-matches", behaald: true }];
    await realtimeRefresh();

    await waitFor(() => expect(mocks.celebrate).toHaveBeenCalledTimes(1));
    expect(mocks.winPulse).toHaveBeenCalledTimes(1);
  });

  it("viert niet nog eens bij een refresh met dezelfde behaalde missies", async () => {
    mocks.missies = [{ id: "twee-matches", behaald: false }];
    renderHook(() => useMissionCelebration("u1"));
    await waitFor(() => expect(mocks.deriveMissions).toHaveBeenCalled());

    mocks.missies = [{ id: "twee-matches", behaald: true }];
    await realtimeRefresh();
    await waitFor(() => expect(mocks.celebrate).toHaveBeenCalledTimes(1));

    // Zelfde behaald-set nog eens binnen (bv. andere match-update): geen salvo.
    await realtimeRefresh();
    await realtimeRefresh();
    expect(mocks.celebrate).toHaveBeenCalledTimes(1);
  });

  it("viert alleen de nieuw behaalde missie, niet de al-behaalde erbij", async () => {
    mocks.missies = [
      { id: "twee-matches", behaald: true },
      { id: "ruime-winst", behaald: false },
    ];
    renderHook(() => useMissionCelebration("u1"));
    await waitFor(() => expect(mocks.deriveMissions).toHaveBeenCalled());
    expect(mocks.celebrate).not.toHaveBeenCalled(); // seed: eerste al behaald

    // Nu komt de tweede missie erbij → precies één salvo.
    mocks.missies = [
      { id: "twee-matches", behaald: true },
      { id: "ruime-winst", behaald: true },
    ];
    await realtimeRefresh();
    await waitFor(() => expect(mocks.celebrate).toHaveBeenCalledTimes(1));
  });
});
