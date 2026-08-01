import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorRetry } from "./ErrorRetry";

describe("<ErrorRetry /> (#910)", () => {
  it("meldt de fout als alert en biedt opnieuw proberen", async () => {
    const onRetry = vi.fn();
    render(<ErrorRetry melding="Het klassement laden mislukte." onRetry={onRetry} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Het klassement laden mislukte.",
    );
    await userEvent.click(screen.getByRole("button", { name: /opnieuw proberen/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("toont bij een doodlopend pad de meegegeven weg terug i.p.v. een retry", () => {
    render(
      <ErrorRetry
        melding="Deze match bestaat niet meer."
        actie={<a href="/matches">Naar matches</a>}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /opnieuw proberen/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Naar matches" })).toBeInTheDocument();
  });
});
