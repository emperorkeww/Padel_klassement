import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MeldingenFilter } from "./MeldingenFilter";
import { filterMeldingen } from "../filteren";
import type { Melding } from "../api";

const melding = (over: Partial<Melding> = {}): Melding => ({
  id: "n1",
  soort: "poll",
  title: "Titel",
  body: "Body",
  url: "/",
  tag: "t1",
  created_at: "2026-08-13T12:00:00.000Z",
  read_at: null,
  ...over,
});

describe("filterMeldingen", () => {
  const lijst = [
    melding({ id: "a", soort: "poll", tag: "a" }),
    melding({ id: "b", soort: "var", tag: "b", read_at: "2026-08-13T12:30:00.000Z" }),
    melding({ id: "c", soort: "var", tag: "c" }),
  ];

  it("laat alles staan zonder filter", () => {
    expect(filterMeldingen(lijst, "alles")).toHaveLength(3);
  });

  it("houdt bij 'ongelezen' alleen wat je nog niet las", () => {
    expect(filterMeldingen(lijst, "ongelezen").map((m) => m.id)).toEqual(["a", "c"]);
  });

  it("filtert op soort", () => {
    expect(filterMeldingen(lijst, "var").map((m) => m.id)).toEqual(["b", "c"]);
  });

  it("levert een lege lijst voor een soort die er niet is", () => {
    // De chips tonen zo'n soort niet, maar realtime kan de lijst onder een
    // gekozen filter vandaan schuiven — en dan moet de pagina iets kunnen zeggen.
    expect(filterMeldingen(lijst, "lef")).toEqual([]);
  });
});

describe("<MeldingenFilter />", () => {
  it("zwijgt als er niets te kiezen valt", () => {
    // Eén soort, alles gelezen: dan zijn "Alles" en die ene soort hetzelfde.
    const { container } = render(
      <MeldingenFilter
        meldingen={[melding({ read_at: "2026-08-13T12:30:00.000Z" })]}
        actief="alles"
        onKies={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("telt per chip hoeveel er achter zitten", async () => {
    const onKies = vi.fn();
    render(
      <MeldingenFilter
        meldingen={[
          melding({ id: "a", soort: "poll", tag: "a" }),
          melding({ id: "b", soort: "var", tag: "b" }),
        ]}
        actief="alles"
        onKies={onKies}
      />,
    );
    expect(screen.getByRole("button", { name: /^speeldag/i })).toHaveTextContent("1");
    await userEvent.click(screen.getByRole("button", { name: /^var/i }));
    expect(onKies).toHaveBeenCalledWith("var");
  });
});
