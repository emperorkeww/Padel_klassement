import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

describe("<App />", () => {
  it("toont de titel", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /webproject/i })).toBeInTheDocument();
  });

  it("telt op bij klik", async () => {
    render(<App />);
    const button = screen.getByRole("button", { name: /geteld/i });
    expect(button).toHaveTextContent("Geteld: 0");
    await userEvent.click(button);
    expect(button).toHaveTextContent("Geteld: 1");
  });
});