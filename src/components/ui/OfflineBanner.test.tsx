import { describe, it, expect, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { OfflineBanner } from "./OfflineBanner";

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", { value, configurable: true });
}

afterEach(() => setOnline(true));

describe("<OfflineBanner />", () => {
  it("toont niets zolang er verbinding is", () => {
    setOnline(true);
    render(<OfflineBanner />);
    expect(screen.queryByText(/geen verbinding/i)).not.toBeInTheDocument();
  });

  it("toont een strook wanneer offline en verdwijnt weer bij herverbinding", () => {
    setOnline(false);
    render(<OfflineBanner />);
    expect(screen.getByText(/geen verbinding/i)).toBeInTheDocument();

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByText(/geen verbinding/i)).not.toBeInTheDocument();
  });
});
