import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
  it("toont de titelbadge met de club-scope in de titel", () => {
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

describe("<Schandpaal /> — het beeldvak van de gegenereerde pias (#770)", () => {
  const portret = (container: HTMLElement) =>
    container.querySelector(".schandpaal__portrait");

  it("staat op 'geen' zolang er geen bron is — dat is de fallbackstatus", () => {
    const { container } = renderSchandpaal();
    expect(portret(container)).toHaveAttribute("data-portret", "geen");
  });

  it("begint bij een bron op 'laadt' en gaat naar 'klaar' zodra hij binnen is", () => {
    const { container } = renderSchandpaal({ image: "https://x/pias.png" });
    expect(portret(container)).toHaveAttribute("data-portret", "laadt");
    fireEvent.load(container.querySelector(".schandpaal__img")!);
    expect(portret(container)).toHaveAttribute("data-portret", "klaar");
  });

  it("valt bij een mislukte generatie terug op de gewone avatar", () => {
    const { container } = renderSchandpaal({ image: "https://x/stuk.png" });
    fireEvent.error(container.querySelector(".schandpaal__img")!);
    expect(portret(container)).toHaveAttribute("data-portret", "fout");
    expect(container.querySelector(".schandpaal__img")).toBeNull();
    expect(container.querySelector(".schandpaal__portrait .avatar")).not.toBeNull();
  });

  it("begint bij een nieuwe bron opnieuw, ook na een fout", () => {
    const { container, rerender } = renderSchandpaal({
      image: "https://x/stuk.png",
    });
    fireEvent.error(container.querySelector(".schandpaal__img")!);
    rerender(
      <MemoryRouter>
        <Schandpaal
          name="Bart V."
          profile={null}
          detail="werd met 8 games verschil vakkundig afgedroogd"
          weekStart="2026-07-20"
          ctx={ctx}
          seed={7}
          image="https://x/nieuw.png"
        />
      </MemoryRouter>,
    );
    expect(portret(container)).toHaveAttribute("data-portret", "laadt");
    expect(container.querySelector(".schandpaal__img")).toHaveAttribute(
      "src",
      "https://x/nieuw.png",
    );
  });

  it("benoemt in de alt-tekst wie er staat — de afbeelding draagt zelf geen tekst", () => {
    renderSchandpaal({ image: "https://x/pias.png" });
    expect(
      screen.getByAltText("Bart V., uitgebeeld als de pias van de club"),
    ).toBeInTheDocument();
  });
});

describe("<Schandpaal /> — verhaalpaneel en ornamenten (#770)", () => {
  it("draagt de status als tekst, niet alleen in kleur en ornament", () => {
    const { container } = renderSchandpaal();
    const badge = container.querySelector(".schandpaal__insig");
    expect(badge?.textContent).toContain("Pias van de club");
    // Het icoontje in de badge is een eigen SVG (geen platform-emoji) en
    // spreekt geen screenreader aan.
    expect(
      badge?.querySelector(".schandpaal__insig-icoon"),
    ).toHaveAttribute("aria-hidden", "true");
  });

  it("kapt een lang incident niet af", () => {
    const lang =
      "verloor drie keer op rij na een 5-1-voorsprong en gaf daarna ook nog " +
      "de beslissende tiebreak weg op eigen opslag";
    renderSchandpaal({ detail: lang });
    expect(screen.getByText(lang)).toBeInTheDocument();
  });

  it("toont een meerregelige coachquote volledig", () => {
    const { container } = renderSchandpaal();
    const tekst = container.querySelector(".coach-sneer__text");
    expect(tekst?.textContent?.length).toBeGreaterThan(0);
    // Geen line-clamp/ellipsis-markup: de bubbel groeit mee met de quote.
    expect(tekst?.className).not.toContain("clamp");
  });

  it("toont een lange naam volledig, met de 'jij'-badge ernaast", () => {
    const naam = "Jean-Baptiste van der Sluijs-Vandenbroucke";
    const { container } = renderSchandpaal({ name: naam, isMe: true });
    expect(container.querySelector(".schandpaal__name")?.textContent).toBe(naam);
    expect(screen.getByText("jij")).toBeInTheDocument();
  });

  it("verbergt élke decoratieve laag voor screenreaders", () => {
    const { container } = renderSchandpaal();
    // De vijf ornamentlagen uit #770; hun geneste <svg>'s erven de
    // aria-hidden van hun root en hoeven hem dus niet zelf te dragen.
    for (const klasse of [
      "schandpaal__decor",
      "schandpaal__kap",
      "schandpaal__medaillon",
      "schandpaal__watermerk",
      "schandpaal__chevrons",
    ]) {
      const laag = container.querySelector(`.${klasse}`);
      expect(laag, klasse).not.toBeNull();
      expect(laag, klasse).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("noemt de pias-status in het label van de sectie", () => {
    renderSchandpaal();
    expect(
      screen.getByLabelText("De schandpaal — Bart V., pias van de club"),
    ).toBeInTheDocument();
  });
});
