import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LiquidGlass } from "./LiquidGlass";

/** Doet alsof er een echte muis is (of juist niet), want daar hangt het hele
 *  aanwijzer-hooglicht van af. */
function stelAanwijzerIn(fijn: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: fijn })),
  );
}

/** Een pointermove die React herkent. jsdom kent geen PointerEvent, dus een
 *  MouseEvent met dat type — React kijkt naar de naam, niet naar de klasse. */
function beweegAanwijzer(el: Element, clientX: number, clientY: number) {
  el.dispatchEvent(
    new MouseEvent("pointermove", { bubbles: true, clientX, clientY }),
  );
}

beforeEach(() => {
  stelAanwijzerIn(true);
  // Het hooglicht wordt in een frame geschreven; hier meteen uitvoeren.
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("<LiquidGlass /> (#1062)", () => {
  it("rendert de inhoud met de variant- en vormclasses", () => {
    const { container } = render(
      <LiquidGlass variant="sterk" vorm="pil">
        Volgende match
      </LiquidGlass>,
    );

    const vlak = container.firstElementChild!;
    expect(vlak.className).toBe("glas glas--sterk glas--pil");
    expect(vlak).toHaveTextContent("Volgende match");
    // De inhoud staat in een eigen laag, anders verdwijnt ze onder het
    // randlicht en het hooglicht.
    expect(vlak.querySelector(".glas__inhoud")).toHaveTextContent(
      "Volgende match",
    );
  });

  it("zet er de eigen class achteraan in plaats van de onze te vervangen", () => {
    const { container } = render(
      <LiquidGlass className="dash-paneel">x</LiquidGlass>,
    );

    expect(container.firstElementChild!.className).toBe(
      "glas glas--standaard glas--paneel dash-paneel",
    );
  });

  it("laat de afronding aan het element bij vorm=eigen", () => {
    const { container } = render(<LiquidGlass vorm="eigen">x</LiquidGlass>);

    expect(container.firstElementChild!.className).toBe(
      "glas glas--standaard",
    );
  });

  it("rendert het element uit de as-prop en houdt de attributen vast", () => {
    render(
      <LiquidGlass as="button" type="button" aria-label="Jouw positie">
        12e
      </LiquidGlass>,
    );

    const knop = screen.getByRole("button", { name: "Jouw positie" });
    expect(knop.tagName).toBe("BUTTON");
    expect(knop).toHaveAttribute("type", "button");
  });

  it("markeert een interactief vlak en volgt de aanwijzer", () => {
    const { container } = render(
      <LiquidGlass variant="interactief">Tik</LiquidGlass>,
    );

    const vlak = container.firstElementChild as HTMLElement;
    expect(vlak).toHaveAttribute("data-interactief", "true");
    // Geen dubbele class: variant en gedrag vallen hier samen.
    expect(vlak.className).toBe("glas glas--interactief glas--paneel");

    beweegAanwijzer(vlak, 40, 12);
    expect(vlak.style.getPropertyValue("--glas-aanwijzer-x")).toBe("40px");
    expect(vlak.style.getPropertyValue("--glas-aanwijzer-y")).toBe("12px");
  });

  it("geeft een andere variant het interactieve gedrag erbij", () => {
    const { container } = render(
      <LiquidGlass variant="standaard" interactief>
        Tik
      </LiquidGlass>,
    );

    expect(container.firstElementChild!.className).toBe(
      "glas glas--standaard glas--interactief glas--paneel",
    );
  });

  it("volgt de aanwijzer niet op een aanraakscherm", () => {
    stelAanwijzerIn(false);
    const { container } = render(
      <LiquidGlass variant="interactief">Tik</LiquidGlass>,
    );

    const vlak = container.firstElementChild as HTMLElement;
    beweegAanwijzer(vlak, 40, 12);
    expect(vlak.style.getPropertyValue("--glas-aanwijzer-x")).toBe("");
  });

  it("schakelt bij uitgeschakeld ook het aanwijzergedrag uit", () => {
    const { container } = render(
      <LiquidGlass as="button" variant="interactief" uitgeschakeld>
        Tik
      </LiquidGlass>,
    );

    const vlak = container.firstElementChild as HTMLElement;
    expect(vlak).toHaveAttribute("aria-disabled", "true");
    expect(vlak).not.toHaveAttribute("data-interactief");

    beweegAanwijzer(vlak, 40, 12);
    expect(vlak.style.getPropertyValue("--glas-aanwijzer-x")).toBe("");
  });
});
