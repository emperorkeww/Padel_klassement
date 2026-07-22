import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

// SetScoresInput importeert `emptySet` uit features/matches/api, dat op zijn
// beurt de Supabase-client laadt. Die client crasht bij het laden zonder env.
// We stubben hem daarom leeg — deze test raakt Supabase verder nergens aan.
vi.mock("@/lib/supabase/client", () => ({ supabase: {} }));

import { SetScoresInput } from "./SetScoresInput";
import type { SetPair } from "@/features/matches/api";

// Lokale kopie van api.emptySet: puur data, zodat deze test de Supabase-client
// (die api.ts importeert) niet hoeft te laden. Zelfde vorm als de bron.
const emptySet = (): SetPair => ({ a: "", b: "" });

const LABEL_A = "Alice & Bob";
const LABEL_B = "Carol & Dave";

/** Controlled test-wrapper: houdt de sets-state zelf bij, zodat interacties
 *  over meerdere stappen kloppen. Een optionele spy ziet elke onChange. */
function Harness({
  initial = [emptySet()],
  max,
  onChangeSpy,
}: {
  initial?: SetPair[];
  max?: number;
  onChangeSpy?: (sets: SetPair[]) => void;
}) {
  const [sets, setSets] = useState<SetPair[]>(initial);
  return (
    <SetScoresInput
      sets={sets}
      onChange={(next) => {
        onChangeSpy?.(next);
        setSets(next);
      }}
      labelA={LABEL_A}
      labelB={LABEL_B}
      max={max}
    />
  );
}

describe("<SetScoresInput />", () => {
  it("rendert één set-rij per set", () => {
    render(
      <SetScoresInput
        sets={[emptySet(), { a: "6", b: "4" }]}
        onChange={() => {}}
        labelA={LABEL_A}
        labelB={LABEL_B}
      />,
    );
    expect(screen.getByText("Set 1")).toBeInTheDocument();
    expect(screen.getByText("Set 2")).toBeInTheDocument();
    expect(screen.queryByText("Set 3")).not.toBeInTheDocument();
    // Twee rijen → twee (number-)velden per zijde. spinbutton = het <input>,
    // zodat de ±-knoppen (zelfde label-tekst) niet meetellen.
    expect(
      screen.getAllByRole("spinbutton", { name: /games Alice & Bob/i }),
    ).toHaveLength(2);
  });

  it("toont de bestaande waarden in de velden", () => {
    render(
      <SetScoresInput
        sets={[{ a: "6", b: "4" }]}
        onChange={() => {}}
        labelA={LABEL_A}
        labelB={LABEL_B}
      />,
    );
    expect(
      screen.getByRole("spinbutton", { name: /Set 1 — games Alice & Bob/i }),
    ).toHaveValue(6);
    expect(
      screen.getByRole("spinbutton", { name: /Set 1 — games Carol & Dave/i }),
    ).toHaveValue(4);
  });

  it("roept onChange met de bijgewerkte sets-array bij het wijzigen van één zijde", async () => {
    const onChange = vi.fn();
    render(
      <SetScoresInput
        sets={[{ a: "5", b: "3" }]}
        onChange={onChange}
        labelA={LABEL_A}
        labelB={LABEL_B}
      />,
    );
    // De + van de ScoreStepper voor zijde A van set 1.
    await userEvent.click(
      screen.getByRole("button", { name: /Set 1 — games Alice & Bob: één meer/i }),
    );
    // Alleen zijde a van rij 0 wijzigt (5 → 6); zijde b blijft ongemoeid.
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([{ a: "6", b: "3" }]);
  });

  it("wijzigt alleen de aangeraakte rij bij meerdere sets", async () => {
    const onChange = vi.fn();
    render(
      <SetScoresInput
        sets={[{ a: "6", b: "4" }, { a: "2", b: "6" }]}
        onChange={onChange}
        labelA={LABEL_A}
        labelB={LABEL_B}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Set 2 — games Carol & Dave: één meer/i }),
    );
    expect(onChange).toHaveBeenCalledWith([
      { a: "6", b: "4" },
      { a: "2", b: "7" },
    ]);
  });

  it("voegt met '+ Set toevoegen' een lege set-rij toe", async () => {
    const onChangeSpy = vi.fn();
    render(<Harness initial={[{ a: "6", b: "4" }]} onChangeSpy={onChangeSpy} />);

    await userEvent.click(
      screen.getByRole("button", { name: /set toevoegen/i }),
    );
    // Eén rij extra, de nieuwe is leeg.
    expect(onChangeSpy).toHaveBeenCalledWith([
      { a: "6", b: "4" },
      emptySet(),
    ]);
    // En de UI toont nu twee rijen.
    expect(screen.getByText("Set 2")).toBeInTheDocument();
  });

  it("reset bij precies één rij naar één lege set i.p.v. te verwijderen", async () => {
    const onChange = vi.fn();
    render(
      <SetScoresInput
        sets={[{ a: "6", b: "4" }]}
        onChange={onChange}
        labelA={LABEL_A}
        labelB={LABEL_B}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Set 1 verwijderen/i }),
    );
    // Niet leeg: er blijft één lege set staan.
    expect(onChange).toHaveBeenCalledWith([emptySet()]);
  });

  it("verwijdert bij meerdere rijen wél de gekozen rij", async () => {
    const onChange = vi.fn();
    render(
      <SetScoresInput
        sets={[{ a: "6", b: "4" }, { a: "2", b: "6" }]}
        onChange={onChange}
        labelA={LABEL_A}
        labelB={LABEL_B}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Set 1 verwijderen/i }),
    );
    expect(onChange).toHaveBeenCalledWith([{ a: "2", b: "6" }]);
  });

  it("verbergt '+ Set toevoegen' zodra sets.length >= max", () => {
    render(
      <SetScoresInput
        sets={[emptySet(), emptySet(), emptySet()]}
        onChange={() => {}}
        labelA={LABEL_A}
        labelB={LABEL_B}
        max={3}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /set toevoegen/i }),
    ).not.toBeInTheDocument();
  });

  it("toont '+ Set toevoegen' zolang er ruimte is (< max)", () => {
    render(
      <SetScoresInput
        sets={[emptySet()]}
        onChange={() => {}}
        labelA={LABEL_A}
        labelB={LABEL_B}
        max={3}
      />,
    );
    expect(
      screen.getByRole("button", { name: /set toevoegen/i }),
    ).toBeInTheDocument();
  });

  it("laat via de controlled wrapper set toevoegen tot de max en verbergt de knop dan", async () => {
    render(<Harness initial={[emptySet()]} max={2} />);

    // Eerst is er ruimte, na de tweede rij verdwijnt de knop.
    await userEvent.click(screen.getByRole("button", { name: /set toevoegen/i }));
    expect(screen.getByText("Set 2")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /set toevoegen/i }),
    ).not.toBeInTheDocument();
  });
});
