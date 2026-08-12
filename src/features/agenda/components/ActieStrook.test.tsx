import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActieStrook } from "./ActieStrook";

// De strook is de enige plek waar de agenda zelf iets van je vraagt (#1182).
// Twee regels waar het op aankomt: hij verdwijnt als er niets openstaat, en de
// knop brengt je naar de eerstvolgende vraag.

describe("<ActieStrook />", () => {
  it("staat er niet als er niets op jou wacht", () => {
    const { container } = render(<ActieStrook vragen={[]} onGa={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("noemt de dag en de groep bij één openstaande vraag", () => {
    render(
      <ActieStrook
        vragen={[{ pollId: "p1", date: "2026-08-13", groupName: "Vamos!" }]}
        onGa={vi.fn()}
      />,
    );
    expect(
      screen.getByText("Jij moet nog stemmen op de speeldag van do 13 aug (Vamos!)."),
    ).toBeInTheDocument();
  });

  it("telt ze bij meerdere en stuurt naar de eerste", async () => {
    const onGa = vi.fn();
    render(
      <ActieStrook
        vragen={[
          { pollId: "p1", date: "2026-08-13", groupName: "Vamos!" },
          { pollId: "p2", date: "2026-08-20", groupName: "Zaterdagclub" },
        ]}
        onGa={onGa}
      />,
    );
    expect(
      screen.getByText("Jij moet nog stemmen op 2 speeldagen."),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Naar de eerste" }));
    expect(onGa).toHaveBeenCalledWith("2026-08-13");
  });
});
