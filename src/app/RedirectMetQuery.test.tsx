import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { RedirectMetQuery } from "./RedirectMetQuery";

function Bestemming() {
  const { pathname, search, hash } = useLocation();
  return <div data-testid="hier">{`${pathname}${search}${hash}`}</div>;
}

function renderPad(pad: string) {
  return render(
    <MemoryRouter initialEntries={[pad]}>
      <Routes>
        <Route path="/oud" element={<RedirectMetQuery to="/nieuw" />} />
        <Route path="/nieuw" element={<Bestemming />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("<RedirectMetQuery /> (#1123)", () => {
  it("neemt de querystring mee naar het nieuwe pad", () => {
    renderPad("/oud?groep=g1&periode=7d");
    expect(screen.getByTestId("hier")).toHaveTextContent(
      "/nieuw?groep=g1&periode=7d",
    );
  });

  it("neemt ook het anker mee", () => {
    renderPad("/oud?log=1#historie");
    expect(screen.getByTestId("hier").textContent).toBe("/nieuw?log=1#historie");
  });

  it("redirect zonder query gewoon naar het pad", () => {
    renderPad("/oud");
    expect(screen.getByTestId("hier").textContent).toBe("/nieuw");
  });
});
