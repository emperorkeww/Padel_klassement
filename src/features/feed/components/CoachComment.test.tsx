import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CoachComment } from "./CoachComment";

// De identiteitskop van Coach Rudy stond 34 keer op één pagina en was daarmee
// 29% van de itemhoogte (#1272). De quip blijft; de signatuur eronder niet.

const toon = (props: Partial<Parameters<typeof CoachComment>[0]> = {}) =>
  render(
    <CoachComment
      tekst="Ik heb tennisballen tégen een muur beter zien terugkomen."
      mood="mild"
      onInfo={vi.fn()}
      {...props}
    />,
  );

describe("<CoachComment />", () => {
  it("zwijgt volledig als er geen tekst is", () => {
    const { container } = toon({ tekst: null });
    expect(container).toBeEmptyDOMElement();
  });

  it("stelt Rudy voor met avatar, naam en de ⓘ", () => {
    const { container } = toon();
    expect(screen.getByText("Coach Rudy")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /over coach rudy/i })).toBeInTheDocument();
    expect(container.querySelector(".coach-comment__face")).not.toBeNull();
  });

  it("laat compact alleen de quip staan", () => {
    const { container } = toon({ compact: true });
    expect(screen.getByText(/tennisballen/)).toBeInTheDocument();
    expect(container.querySelector(".coach-comment__head")).toBeNull();
    expect(container.querySelector(".coach-comment__face")).toBeNull();
    expect(screen.queryByRole("button", { name: /over coach rudy/i })).toBeNull();
  });

  it("houdt de toeschrijving compact wél overeind voor wie de pagina niet ziet", () => {
    // Zonder zichtbare naam moet nog steeds duidelijk zijn wie er spreekt: de
    // quip is een citaat, geen zin van de app zelf.
    const { container } = toon({ compact: true });
    const verborgen = container.querySelector(".sr-only");
    expect(verborgen).not.toBeNull();
    expect(verborgen).toHaveTextContent("Coach Rudy");
  });
});
