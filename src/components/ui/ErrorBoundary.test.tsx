import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ErrorBoundary } from "@/ui/ErrorBoundary";
import { CRASH, VERSIE } from "@/features/coach/coachMoments";
import { applyUpdate, getSwUpdateSnapshot } from "@/lib/utils/swUpdate";

vi.mock("@/lib/utils/swUpdate", () => ({
  applyUpdate: vi.fn(),
  getSwUpdateSnapshot: vi.fn(() => false),
}));

// React logt een opgevangen fout zelf ook naar console.error; dat is hier
// verwacht gedrag en zou de testuitvoer alleen maar vervuilen.
let stil: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  stil = vi.spyOn(console, "error").mockImplementation(() => {});
  sessionStorage.clear();
  vi.mocked(getSwUpdateSnapshot).mockReturnValue(false);
  vi.mocked(applyUpdate).mockClear();
});
afterEach(() => {
  stil.mockRestore();
  sessionStorage.clear();
});

function Boem({ gooi = true }: { gooi?: boolean }) {
  if (gooi) throw new Error("kapotte render");
  return <p>alles in orde</p>;
}

/** Een crash die door een verdwenen route-chunk komt. */
function ChunkWeg(): never {
  throw new Error(
    "Failed to fetch dynamically imported module: https://vamos.be/assets/Feed-abc123.js",
  );
}

describe("<ErrorBoundary />", () => {
  it("laat de kinderen met rust zolang er niks misgaat", () => {
    render(
      <ErrorBoundary scope="pagina">
        <p>alles in orde</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("alles in orde")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("toont de fallback met een Coach Rudy-regel i.p.v. een wit scherm", () => {
    render(
      <ErrorBoundary scope="pagina">
        <Boem />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Hier ging iets mis.")).toBeInTheDocument();
    expect(screen.getByText("Coach Rudy")).toBeInTheDocument();
    // Precies één van de crash-regels, en Rudy spreekt in één bubbel.
    const regels = CRASH.filter((r) => screen.queryByText(r) !== null);
    expect(regels).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Opnieuw proberen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Herlaad de app" })).toBeInTheDocument();
  });

  it("dezelfde fout geeft dezelfde regel (deterministisch geseed)", () => {
    const eerste = render(
      <ErrorBoundary scope="pagina">
        <Boem />
      </ErrorBoundary>,
    );
    const regel = CRASH.find((r) => eerste.queryByText(r) !== null);
    eerste.unmount();

    const tweede = render(
      <ErrorBoundary scope="pagina">
        <Boem />
      </ErrorBoundary>,
    );
    expect(regel).toBeDefined();
    expect(tweede.getByText(regel!)).toBeInTheDocument();
  });

  it("zet de technische melding erbij voor een bugmelding", async () => {
    render(
      <ErrorBoundary scope="pagina">
        <Boem />
      </ErrorBoundary>,
    );
    await userEvent.click(screen.getByText("Technische details"));
    expect(screen.getByText("kapotte render")).toBeInTheDocument();
  });

  it("'Opnieuw proberen' rendert de boom opnieuw", async () => {
    // Een vlag, geen teller: React probeert een mislukte concurrent render
    // eerst nog één keer synchroon, en een kind dat "alleen de eerste keer"
    // gooit is dan al hersteld vóórdat de boundary in beeld komt.
    let kapot = true;
    function Wisselvallig() {
      if (kapot) throw new Error("wisselvallig");
      return <p>hersteld</p>;
    }
    render(
      <ErrorBoundary scope="pagina">
        <Wisselvallig />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();

    kapot = false;
    await userEvent.click(screen.getByRole("button", { name: "Opnieuw proberen" }));
    expect(screen.getByText("hersteld")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("een nieuwe resetKey wist de fout — wegnavigeren herstelt de weergave", async () => {
    // Bootst navigatie na: de resetKey wisselt en het kind gooit niet meer.
    function Router() {
      const [pad, setPad] = useState("/kapot");
      return (
        <>
          <button onClick={() => setPad("/heel")}>navigeer</button>
          <ErrorBoundary scope="pagina" resetKey={pad}>
            <Boem gooi={pad === "/kapot"} />
          </ErrorBoundary>
        </>
      );
    }
    render(<Router />);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "navigeer" }));
    expect(screen.getByText("alles in orde")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("een gelijkblijvende resetKey laat de fout staan", async () => {
    function Router() {
      const [, hertekenen] = useState(0);
      return (
        <>
          <button onClick={() => hertekenen((n) => n + 1)}>herteken</button>
          <ErrorBoundary scope="pagina" resetKey="/kapot">
            <Boem />
          </ErrorBoundary>
        </>
      );
    }
    render(<Router />);
    await userEvent.click(screen.getByRole("button", { name: "herteken" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("meldt de crash met zijn scope, zodat de plek herkenbaar is", () => {
    render(
      <ErrorBoundary scope="root">
        <Boem />
      </ErrorBoundary>,
    );
    expect(stil).toHaveBeenCalledWith(
      "[crash:root]",
      expect.objectContaining({ message: "kapotte render" }),
      expect.anything(),
    );
  });

  it("noemt een verdwenen chunk een nieuwe versie, niet een crash", () => {
    render(
      <ErrorBoundary scope="route">
        <ChunkWeg />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Er is een nieuwe versie.")).toBeInTheDocument();
    expect(screen.queryByText("Hier ging iets mis.")).toBeNull();
    // Eén duidelijke uitweg, geen "opnieuw proberen" dat toch niet kan werken.
    expect(screen.getByRole("button", { name: "Herladen" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Opnieuw proberen" })).toBeNull();
    // En Rudy houdt het luchtig i.p.v. te doen alsof er iets stuk is.
    expect(VERSIE.filter((r) => screen.queryByText(r) !== null)).toHaveLength(1);
    expect(CRASH.filter((r) => screen.queryByText(r) !== null)).toHaveLength(0);
  });

  it("activeert de wachtende service worker bij 'Herladen'", async () => {
    vi.mocked(getSwUpdateSnapshot).mockReturnValue(true);
    render(
      <ErrorBoundary scope="route">
        <ChunkWeg />
      </ErrorBoundary>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Herladen" }));
    // De SW herlaadt zelf via controllerchange (#463) — geen tweede reload.
    expect(applyUpdate).toHaveBeenCalledOnce();
  });

  it("valt terug op de crash-weergave als herladen zojuist al niet hielp", async () => {
    vi.mocked(getSwUpdateSnapshot).mockReturnValue(true);
    const eerste = render(
      <ErrorBoundary scope="route">
        <ChunkWeg />
      </ErrorBoundary>,
    );
    await userEvent.click(eerste.getByRole("button", { name: "Herladen" }));
    eerste.unmount();

    // Dezelfde chunk-fout meteen na een herlaadpoging: dan is "er is een
    // nieuwe versie" niet meer geloofwaardig en moet de gebruiker een echte
    // uitweg krijgen in plaats van nóg een herlaadknop.
    render(
      <ErrorBoundary scope="route">
        <ChunkWeg />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Hier ging iets mis.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Opnieuw proberen" })).toBeInTheDocument();
  });

  it("vult het scherm bij root/route en blijft binnen de inhoud bij pagina", () => {
    const { container, unmount } = render(
      <ErrorBoundary scope="root">
        <Boem />
      </ErrorBoundary>,
    );
    expect(container.querySelector(".crash--vol")).not.toBeNull();
    unmount();

    const pagina = render(
      <ErrorBoundary scope="pagina">
        <Boem />
      </ErrorBoundary>,
    );
    expect(pagina.container.querySelector(".crash--vol")).toBeNull();
    expect(pagina.container.querySelector(".crash")).not.toBeNull();
  });
});
