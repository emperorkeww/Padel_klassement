import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { Melding } from "../api";

const navigeer = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => navigeer,
}));

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  markeerGelezen: vi.fn().mockResolvedValue(undefined),
  markeerAllesGelezen: vi.fn().mockResolvedValue(undefined),
}));

import { MeldingenPaneel } from "./MeldingenPaneel";
import { markeerAllesGelezen, markeerGelezen } from "../api";

const melding = (over: Partial<Melding> = {}): Melding => ({
  id: "n1",
  soort: "poll",
  title: "Nieuwe speeldag-poll",
  body: "Bart stelt momenten voor.",
  url: "/groepen/g1?tab=plannen&poll=p1",
  tag: "poll-p1",
  created_at: new Date().toISOString(),
  read_at: null,
  ...over,
});

function toon(meldingen: Melding[], props: Partial<{ laadt: boolean; limiet: number }> = {}) {
  const onClose = vi.fn();
  const onVeranderd = vi.fn();
  render(
    <MemoryRouter>
      <MeldingenPaneel
        open
        onClose={onClose}
        meldingen={meldingen}
        laadt={props.laadt ?? false}
        limiet={props.limiet ?? 20}
        onVeranderd={onVeranderd}
      />
    </MemoryRouter>,
  );
  return { onClose, onVeranderd };
}

beforeEach(() => {
  navigeer.mockClear();
  vi.mocked(markeerGelezen).mockClear();
  vi.mocked(markeerAllesGelezen).mockClear();
});

describe("<MeldingenPaneel /> (#1090)", () => {
  it("toont titel, body en relatieve tijd per melding", () => {
    toon([melding({ created_at: new Date(Date.now() - 7_200_000).toISOString() })]);
    expect(screen.getByText("Nieuwe speeldag-poll")).toBeInTheDocument();
    expect(screen.getByText("Bart stelt momenten voor.")).toBeInTheDocument();
    expect(screen.getByText("2 u geleden")).toBeInTheDocument();
  });

  // De kern van #1090: het paneel openen mag niet betekenen dat je alles kwijt
  // bent. Alleen het item dat je aantikt gaat op gelezen.
  it("markeert bij het openen van één item alléén dát item gelezen", async () => {
    toon([
      melding({ id: "n1" }),
      melding({ id: "n2", title: "Uitslag ingevoerd", url: "/matches/m1" }),
    ]);
    await userEvent.click(screen.getByText("Uitslag ingevoerd"));
    expect(markeerGelezen).toHaveBeenCalledTimes(1);
    expect(markeerGelezen).toHaveBeenCalledWith("n2");
    expect(markeerAllesGelezen).not.toHaveBeenCalled();
  });

  it("navigeert naar dezelfde url als de push en sluit het paneel", async () => {
    const { onClose } = toon([melding()]);
    await userEvent.click(screen.getByText("Nieuwe speeldag-poll"));
    expect(navigeer).toHaveBeenCalledWith("/groepen/g1?tab=plannen&poll=p1");
    expect(onClose).toHaveBeenCalled();
  });

  it("markeert een al gelezen melding niet opnieuw, maar navigeert wel", async () => {
    toon([melding({ read_at: "2026-08-01T10:00:00.000Z" })]);
    await userEvent.click(screen.getByText("Nieuwe speeldag-poll"));
    expect(navigeer).toHaveBeenCalled();
    expect(markeerGelezen).not.toHaveBeenCalled();
  });

  it("navigeert ook als het markeren faalt", async () => {
    vi.mocked(markeerGelezen).mockRejectedValueOnce(new Error("offline"));
    toon([melding()]);
    await userEvent.click(screen.getByText("Nieuwe speeldag-poll"));
    expect(navigeer).toHaveBeenCalledWith("/groepen/g1?tab=plannen&poll=p1");
  });

  it("biedt 'alles gelezen' alleen zolang er iets ongelezen is", async () => {
    const { onVeranderd } = toon([melding()]);
    await userEvent.click(screen.getByRole("button", { name: /alles gelezen/i }));
    expect(markeerAllesGelezen).toHaveBeenCalled();
    await vi.waitFor(() => expect(onVeranderd).toHaveBeenCalled());
  });

  it("verbergt 'alles gelezen' als alles al gelezen is", () => {
    toon([melding({ read_at: "2026-08-01T10:00:00.000Z" })]);
    expect(
      screen.queryByRole("button", { name: /alles gelezen/i }),
    ).not.toBeInTheDocument();
  });

  it("zegt in de lege staat wat er straks komt te staan", () => {
    toon([]);
    expect(screen.getByText(/nog niets te melden/i)).toBeInTheDocument();
    expect(screen.getByText(/zodra er een ronde klaarstaat/i)).toBeInTheDocument();
  });

  it("wijst naar de volledige lijst zodra het paneel vol zit", () => {
    toon(
      Array.from({ length: 3 }, (_, i) => melding({ id: `n${i}`, tag: `t${i}` })),
      { limiet: 3 },
    );
    expect(
      screen.getByRole("link", { name: /alles bekijken/i }),
    ).toHaveAttribute("href", "/meldingen");
  });

  it("belooft geen langere lijst als alles al in het paneel staat", () => {
    toon([melding()], { limiet: 20 });
    expect(
      screen.queryByRole("link", { name: /alles bekijken/i }),
    ).not.toBeInTheDocument();
  });

  // #1217: het moment waarop je denkt "hier wil ik minder van" is precies het
  // moment waarop je naar je meldingen kijkt.
  it("wijst naar de meldingsvoorkeuren en sluit daarbij het paneel", async () => {
    const { onClose } = toon([melding()]);
    const link = screen.getByRole("link", { name: /meldingsvoorkeuren/i });
    expect(link).toHaveAttribute("href", "/profiel?tab=privacy");
    await userEvent.click(link);
    expect(onClose).toHaveBeenCalled();
  });

  it("houdt die ingang ook op een leeg paneel", () => {
    // Juist dan wil je misschien iets áánzetten in plaats van uit.
    toon([]);
    expect(
      screen.getByRole("link", { name: /meldingsvoorkeuren/i }),
    ).toBeInTheDocument();
  });

  it("markeert ongelezen items ook voor wie geen kleur ziet", () => {
    const { container } = render(
      <MemoryRouter>
        <MeldingenPaneel
          open
          onClose={() => {}}
          meldingen={[melding()]}
          laadt={false}
          limiet={20}
          onVeranderd={() => {}}
        />
      </MemoryRouter>,
    );
    // De stip is aria-hidden; "ongelezen" staat als tekst in de regel.
    expect(container.querySelector(".melding--ongelezen")).not.toBeNull();
    expect(screen.getAllByText(/ongelezen/i).length).toBeGreaterThan(0);
  });
});
