import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Schandpaal } from "./Schandpaal";
import type { RoastCtx } from "@/features/coach/roastTone";

const ctx: RoastCtx = { intensiteit: "gemeen", schild: false };

function renderSchandpaal(
  props?: Partial<Parameters<typeof Schandpaal>[0]>,
) {
  return render(
    <MemoryRouter>
      <Schandpaal
        name="Bart V."
        profile={null}
        detail="werd met 8 games verschil vakkundig afgedroogd"
        weekStart="2026-07-20"
        ctx={ctx}
        seed={7}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe("<Schandpaal /> (#682)", () => {
  it("toont het 🤡-insigne met de club-scope in de titel", () => {
    renderSchandpaal();
    expect(screen.getByText(/Pias van de club/)).toBeInTheDocument();
  });

  it("draagt de reden als enige inhoudelijke regel", () => {
    renderSchandpaal();
    expect(
      screen.getByText("werd met 8 games verschil vakkundig afgedroogd"),
    ).toBeInTheDocument();
  });

  it("toont bewust géén hoofdgetal — geen rating-tegenhanger van de troon", () => {
    const { container } = renderSchandpaal();
    expect(container.querySelector(".dictator-throne__rating")).toBeNull();
    expect(container.querySelector(".schandpaal__rating")).toBeNull();
    // Alleen de weekdatum mag cijfers dragen; de reden-regel zelf staat los.
    expect(container.querySelector(".schandpaal__week")?.textContent).toBe(
      "week van 20 jul",
    );
  });

  it("linkt naar het profiel wanneer een link is meegegeven", () => {
    renderSchandpaal({ link: "/spelers/p1" });
    expect(screen.getByRole("link")).toHaveAttribute("href", "/spelers/p1");
  });

  it("markeert de kijker met een 'jij'-badge", () => {
    renderSchandpaal({ isMe: true });
    expect(screen.getByText("jij")).toBeInTheDocument();
  });

  it("toont de gewone avatar zolang er geen AI-portret is (#555: geen flits)", () => {
    const { container } = renderSchandpaal();
    expect(container.querySelector(".schandpaal__portrait .avatar")).not.toBeNull();
    expect(container.querySelector(".schandpaal__img")).toBeNull();
  });

  it("vervangt de avatar door het hofnar-portret zodra dat er is", () => {
    const { container } = renderSchandpaal({ image: "https://x/pias.png" });
    expect(container.querySelector(".schandpaal__img")).toHaveAttribute(
      "src",
      "https://x/pias.png",
    );
    expect(container.querySelector(".schandpaal__portrait .avatar")).toBeNull();
  });

  it("zet Coach Rudy's sneer onder de kaart, zoals de propaganda onder de troon", () => {
    const { container } = renderSchandpaal();
    expect(container.querySelector(".schandpaal .coach-sneer")).not.toBeNull();
  });

  it("laat Coach Rudy zwijgen bij een roast-schild, mocht de kaart tóch renderen", () => {
    const { container } = renderSchandpaal({ ctx: { ...ctx, schild: true } });
    expect(container.querySelector(".coach-sneer")).toBeNull();
  });
});
