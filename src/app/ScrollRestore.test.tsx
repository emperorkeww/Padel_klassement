import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  MemoryRouter,
  Route,
  Routes,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { ScrollRestore } from "./ScrollRestore";

// jsdom scrollt niet echt: we volgen de aanroepen en voeren de resulterende
// scrollY zelf op, zodat het component denkt dat de sprong is gelukt.
const scrollTo = vi.fn((_x: number, y: number) => {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
});

// De restauratie wacht tot de (lazy geladen) pagina hoog genoeg is; in jsdom is
// scrollHeight altijd 0, dus geven we een pagina van 2000px op.
beforeEach(() => {
  scrollTo.mockClear();
  Object.defineProperty(window, "scrollTo", {
    value: scrollTo,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, "scrollHeight", {
    value: 2000,
    configurable: true,
  });
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
});

afterEach(() => {
  try {
    sessionStorage.clear();
  } catch {
    /* geen storage — negeer */
  }
});

/** Doet alsof de gebruiker naar `y` scrollt op de huidige pagina. */
function scrollNaar(y: number) {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
  window.dispatchEvent(new Event("scroll"));
}

function Pagina({ naam, naar }: { naam: string; naar?: string }) {
  const navigate = useNavigate();
  return (
    <div>
      <p>{naam}</p>
      {naar && <button onClick={() => navigate(naar)}>vooruit</button>}
      <button onClick={() => navigate(-1)}>terug</button>
    </div>
  );
}

function renderApp() {
  return render(
    <MemoryRouter initialEntries={["/lijst"]}>
      <ScrollRestore />
      <Routes>
        <Route path="/lijst" element={<Pagina naam="lijst" naar="/detail" />} />
        <Route path="/detail" element={<Pagina naam="detail" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("<ScrollRestore /> (#910)", () => {
  it("zet een nieuwe pagina bovenaan", async () => {
    renderApp();
    await screen.findByText("lijst");
    scrollNaar(420);

    scrollTo.mockClear();
    await userEvent.click(screen.getByRole("button", { name: "vooruit" }));
    await screen.findByText("detail");

    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith(0, 0));
  });

  it("herstelt bij terugnavigatie de positie van de lijstpagina", async () => {
    renderApp();
    await screen.findByText("lijst");
    scrollNaar(420);

    await userEvent.click(screen.getByRole("button", { name: "vooruit" }));
    await screen.findByText("detail");

    scrollTo.mockClear();
    await userEvent.click(screen.getByRole("button", { name: "terug" }));
    await screen.findByText("lijst");

    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith(0, 420));
  });

  // jsdom kent `history.scrollRestoration` niet; het component slaat die stap
  // dan over. Hier voeren we hem op om te toetsen dat de eigen restauratie niet
  // met de browser vecht — en dat de oude stand bij unmount terugkomt.
  it("laat de browser niet zelf herstellen zolang hij gemount is", async () => {
    Object.defineProperty(window.history, "scrollRestoration", {
      value: "auto",
      writable: true,
      configurable: true,
    });

    const { unmount } = renderApp();
    await screen.findByText("lijst");
    expect(window.history.scrollRestoration).toBe("manual");
    unmount();
    expect(window.history.scrollRestoration).toBe("auto");
  });
});

/* ------------------------------------------------------------------ */
/* Standwijzigingen op dezelfde pagina (#1195).                        */
/*                                                                     */
/* Dit was het gat: beide tests hierboven navigeren tússen twee routes. */
/* Een filter of tab die alleen de querystring verzet doet een          */
/* `replace` — en die mint óók een nieuwe location.key, met             */
/* navigatietype REPLACE. Daardoor sprong elke filterklik naar boven.   */
/* ------------------------------------------------------------------ */

/** Een pagina met een filter (replace) en een detail-opener (push), allebei op
 *  hetzelfde pad — de vorm van de agenda, de Spelen-hub en het klassement. */
function Filterpagina() {
  const [params, setParams] = useSearchParams();
  return (
    <div>
      <p>lijst</p>
      <p>filter: {params.get("filter") ?? "geen"}</p>
      <button onClick={() => setParams({ filter: "week" }, { replace: true })}>
        filteren
      </button>
      <button onClick={() => setParams({ open: "1" })}>openen</button>
    </div>
  );
}

function renderFilterApp() {
  return render(
    <MemoryRouter initialEntries={["/lijst"]}>
      <ScrollRestore />
      <Routes>
        <Route path="/lijst" element={<Filterpagina />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("<ScrollRestore /> — dezelfde pagina, andere stand (#1195)", () => {
  it("laat de scrollpositie staan bij een querywijziging (replace)", async () => {
    renderFilterApp();
    await screen.findByText("lijst");
    scrollNaar(450);

    scrollTo.mockClear();
    await userEvent.click(screen.getByRole("button", { name: "filteren" }));
    await screen.findByText("filter: week");

    expect(scrollTo).not.toHaveBeenCalled();
    expect(window.scrollY).toBe(450);
  });

  it("laat de scrollpositie ook staan bij een push op hetzelfde pad", async () => {
    // Het dag-sheet van de agenda duwt een history-entry zodat de terugknop
    // hem sluit. Dat is geen nieuwe pagina.
    renderFilterApp();
    await screen.findByText("lijst");
    scrollNaar(450);

    scrollTo.mockClear();
    await userEvent.click(screen.getByRole("button", { name: "openen" }));

    await waitFor(() => expect(window.scrollY).toBe(450));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("zet een echte paginawissel nog steeds bovenaan", async () => {
    // De regel hierboven mag de belofte van #910 niet ondermijnen.
    renderApp();
    await screen.findByText("lijst");
    scrollNaar(420);

    scrollTo.mockClear();
    await userEvent.click(screen.getByRole("button", { name: "vooruit" }));
    await screen.findByText("detail");

    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith(0, 0));
  });
});
