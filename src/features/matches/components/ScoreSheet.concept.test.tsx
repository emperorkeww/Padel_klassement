import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/ui/ToastProvider";
import type { Match } from "@/types";

// #1271 — een half ingetikte score overleefde het sluiten niet.
//
// Elk sheet sluit sinds #1180 met een veeg omlaag, en dat gebeurt op de baan
// sneller dan je denkt. ScoreSheet had geen concept (matchDraft.ts dekte alleen
// de wizard), dus een kleine veeg gooide je invoer weg.

import { ScoreSheet } from "./ScoreSheet";

const MATCH = {
  id: "m-1",
  group_id: "g1",
  team_a_id: "t-a",
  team_b_id: "t-b",
  winner_team_id: null,
  score_a: null,
  score_b: null,
  set_scores: null,
  status: "scheduled",
  round_number: 1,
  played_at: "2026-09-04T18:00:00.000Z",
  created_at: "2026-09-04T12:00:00.000Z",
  created_by: "p1",
  court_type: null,
} as unknown as Match;

function toon(onSave = async () => {}) {
  render(
    <ToastProvider>
      <ScoreSheet
        open
        match={MATCH}
        labelA="Alice & Bob"
        labelB="Carol & Dave"
        onClose={() => {}}
        onSave={onSave}
      />
    </ToastProvider>,
  );
}

describe("<ScoreSheet /> concept (#1271)", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it("houdt de invoer vast als de sheet tussendoor sluit", async () => {
    toon();
    const velden = screen.getAllByRole("spinbutton");
    await userEvent.type(velden[0]!, "6");

    // Weggeveegd — of weggenavigeerd; het sheet unmount hoe dan ook.
    cleanup();
    toon();

    expect(screen.getAllByRole("spinbutton")[0]).toHaveValue(6);
  });

  it("laat het concept los zodra de uitslag opgeslagen is", async () => {
    const onSave = vi.fn(async () => {});
    toon(onSave);
    const velden = screen.getAllByRole("spinbutton");
    await userEvent.type(velden[0]!, "6");
    await userEvent.type(velden[1]!, "3");
    await userEvent.click(
      screen.getByRole("button", { name: /uitslag opslaan/i }),
    );
    expect(onSave).toHaveBeenCalled();

    cleanup();
    toon();
    expect(screen.getAllByRole("spinbutton")[0]).toHaveValue(null);
  });

  it("laat het concept los bij Annuleren — dat is een besluit", async () => {
    toon();
    await userEvent.type(screen.getAllByRole("spinbutton")[0]!, "6");
    await userEvent.click(screen.getByRole("button", { name: /annuleren/i }));

    cleanup();
    toon();
    expect(screen.getAllByRole("spinbutton")[0]).toHaveValue(null);
  });

  it("legt de focus op het eerste scoreveld", () => {
    // Zonder dit kwam het toetsenbord niet op en kostte elke uitslag een
    // extra tik: Sheet pakte de focus terug naar de dialoog.
    toon();
    expect(screen.getAllByRole("spinbutton")[0]).toHaveFocus();
  });
});
