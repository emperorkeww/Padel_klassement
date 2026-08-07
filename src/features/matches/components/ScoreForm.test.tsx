import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ScoreForm importeert `toSetScores` uit features/matches/api, dat de
// Supabase-client laadt; die crasht bij het laden zonder env. Zelfde stub als
// in SetScoresInput.test.tsx — deze test raakt Supabase verder nergens aan.
vi.mock("@/lib/supabase/client", () => ({ supabase: {} }));

import { ScoreForm } from "./ScoreForm";
import type { SetPair } from "@/features/matches/api";

const A = "Alice & Bob";
const B = "Carol & Dave";

/** Controlled wrapper: het formulier is met opzet niet zelfsturend (#1144). */
function Harness({
  beginA = "",
  beginB = "",
  beginSets = [{ a: "", b: "" }] as SetPair[],
  setsOpen: beginSetsOpen = false,
}: {
  beginA?: string;
  beginB?: string;
  beginSets?: SetPair[];
  setsOpen?: boolean;
}) {
  const [scoreA, setScoreA] = useState(beginA);
  const [scoreB, setScoreB] = useState(beginB);
  const [sets, setSets] = useState<SetPair[]>(beginSets);
  const [setsOpen, setSetsOpen] = useState(beginSetsOpen);
  return (
    <ScoreForm
      labelA={A}
      labelB={B}
      scoreA={scoreA}
      scoreB={scoreB}
      onScoreA={setScoreA}
      onScoreB={setScoreB}
      sets={sets}
      onSets={setSets}
      setsOpen={setsOpen}
      onSetsOpen={setSetsOpen}
    />
  );
}

describe("<ScoreForm />", () => {
  it("wijst de winnaar aan zodra beide cijfers er staan", async () => {
    render(<Harness />);
    // Zolang er niets staat: alleen de spelregel, geen uitkomst.
    expect(screen.getByText(/de hoogste score wint/i)).toBeInTheDocument();

    await userEvent.type(
      screen.getByRole("spinbutton", { name: `Score ${A}` }),
      "6",
    );
    await userEvent.type(
      screen.getByRole("spinbutton", { name: `Score ${B}` }),
      "4",
    );
    expect(screen.getByText(/alice & bob winnen — 3 punten/i)).toBeInTheDocument();
  });

  it("leest een gelijke stand als gelijkspel", async () => {
    render(<Harness beginA="6" beginB="6" />);
    expect(screen.getByText(/gelijkspel/i)).toBeInTheDocument();
  });

  it("houdt de sets dicht tot je erom vraagt", async () => {
    render(<Harness />);
    const toggle = screen.getByRole("button", {
      name: /sets per set invoeren/i,
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Set 1")).toBeNull();

    await userEvent.click(toggle);
    expect(screen.getByText("Set 1")).toBeInTheDocument();
  });

  it("waarschuwt als de sets een andere winnaar aanwijzen dan de eindstand", () => {
    // Sets 2–1 voor A, eindstand 4–6 voor B: dat is een invoerfout, geen
    // conventieverschil.
    render(
      <Harness
        beginA="4"
        beginB="6"
        setsOpen
        beginSets={[
          { a: "6", b: "4" },
          { a: "3", b: "6" },
          { a: "6", b: "2" },
        ]}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/klopt dat/i);
  });

  it("zwijgt als de sets en de eindstand dezelfde kant op wijzen", () => {
    // 15–12 in games óf 2–1 in sets: beide conventies bestaan, geen van beide
    // is fout, dus er mag hier niets afgaan.
    render(
      <Harness
        beginA="15"
        beginB="12"
        setsOpen
        beginSets={[
          { a: "6", b: "4" },
          { a: "3", b: "6" },
          { a: "6", b: "2" },
        ]}
      />,
    );
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("blokkeert niets: de waarschuwing is een vraag, geen fout", () => {
    render(
      <Harness beginA="4" beginB="6" setsOpen beginSets={[{ a: "6", b: "4" }]} />,
    );
    // Geen aria-invalid, geen uitgeschakelde velden — opslaan mag.
    expect(
      screen.getByRole("spinbutton", { name: `Score ${A}` }),
    ).toBeEnabled();
  });
});
