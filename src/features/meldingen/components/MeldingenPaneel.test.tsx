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

function toon(
  meldingen: Melding[],
  props: Partial<{ laadt: boolean; fout: string; verzoeken: number }> = {},
) {
  const onClose = vi.fn();
  const onVeranderd = vi.fn();
  render(
    <MemoryRouter>
      <MeldingenPaneel
        open
        onClose={onClose}
        meldingen={meldingen}
        laadt={props.laadt ?? false}
        fout={props.fout ?? null}
        verzoeken={props.verzoeken ?? 0}
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

  // #1273: hing tot dan aan een vol paneel (twintig meldingen). Daaronder was
  // er op het hele dashboard geen enkele link naar /meldingen.
  it("wijst naar de volledige lijst zodra er íets staat", () => {
    toon([melding()]);
    expect(
      screen.getByRole("link", { name: /alles bekijken/i }),
    ).toHaveAttribute("href", "/meldingen");
  });

  it("belooft geen lijst als er niets is om te bekijken", () => {
    toon([]);
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

  // #1232: het overzicht droeg de "N vriendschapsverzoeken"-pil, en de melding
  // die send-push erbij schrijft verdwijnt zodra je hem gelezen hebt. Deze
  // regel leest de toestand, dus hij blijft staan tot je antwoordt.
  describe("openstaande vriendschapsverzoeken (#1232)", () => {
    it("zet een verzoek bovenaan, met de weg naar de vriendenpagina", async () => {
      const { onClose } = toon([melding()], { verzoeken: 1 });
      const link = screen.getByRole("link", {
        name: /1 vriendschapsverzoek wacht op jou/i,
      });
      expect(link).toHaveAttribute("href", "/vrienden");
      // Vóór de meldingenlijst: dit wacht op een antwoord, die is geschiedenis.
      expect(
        link.compareDocumentPosition(screen.getByText("Nieuwe speeldag-poll")) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      await userEvent.click(link);
      expect(onClose).toHaveBeenCalled();
    });

    it("telt en vervoegt meervoud", () => {
      toon([], { verzoeken: 3 });
      expect(
        screen.getByRole("link", {
          name: /3 vriendschapsverzoeken wachten op jou/i,
        }),
      ).toBeInTheDocument();
    });

    it("zegt niets over verzoeken als er geen zijn", () => {
      toon([melding()]);
      expect(screen.queryByText(/wacht op jou/i)).toBeNull();
    });

    it("spreekt de lege staat niet tegen", () => {
      // "Nog niets te melden" terwijl er juist iets op je wacht: dan is de
      // regel hierboven de inhoud van het paneel.
      toon([], { verzoeken: 1 });
      expect(screen.queryByText(/nog niets te melden/i)).toBeNull();
      expect(
        screen.getByRole("link", { name: /vriendschapsverzoek wacht op jou/i }),
      ).toBeInTheDocument();
    });
  });

  it("markeert ongelezen items ook voor wie geen kleur ziet", () => {
    const { container } = render(
      <MemoryRouter>
        <MeldingenPaneel
          open
          onClose={() => {}}
          meldingen={[melding()]}
          laadt={false}
          onVeranderd={() => {}}
        />
      </MemoryRouter>,
    );
    // Het icoon is aria-hidden; "ongelezen" staat als tekst in de regel.
    expect(container.querySelector(".melding--ongelezen")).not.toBeNull();
    expect(screen.getAllByText(/ongelezen/i).length).toBeGreaterThan(0);
  });

  // #1273: negen soorten die op één regel leken.
  describe("de rij draagt haar soort (#1273)", () => {
    it("geeft elke soort een eigen icoonvlak in zijn accentfamilie", () => {
      const { container } = render(
        <MemoryRouter>
          <MeldingenPaneel
            open
            onClose={() => {}}
            meldingen={[
              melding({ id: "n1", soort: "poll", tag: "t1" }),
              melding({ id: "n2", soort: "var", tag: "t2", title: "VAR" }),
              melding({ id: "n3", soort: "uitslag", tag: "t3", title: "Gewonnen" }),
            ]}
            laadt={false}
              onVeranderd={() => {}}
          />
        </MemoryRouter>,
      );
      expect(container.querySelector(".melding__icoon--poll")).not.toBeNull();
      expect(container.querySelector(".melding__icoon--warn")).not.toBeNull();
      expect(container.querySelector(".melding__icoon--success")).not.toBeNull();
      // Elke rij heeft er precies één, ook als de servertitel al een emoji had.
      expect(container.querySelectorAll(".melding__icoon")).toHaveLength(3);
    });

    it("valt terug op een neutraal icoon voor een soort die deze bundel nog niet kent", () => {
      const { container } = render(
        <MemoryRouter>
          <MeldingenPaneel
            open
            onClose={() => {}}
            meldingen={[melding({ soort: "teleportatie" })]}
            laadt={false}
              onVeranderd={() => {}}
          />
        </MemoryRouter>,
      );
      expect(container.querySelector(".melding__icoon--neutraal")).not.toBeNull();
    });

    it("laat de emoji uit de servertitel weg, want het icoon draagt dat al", () => {
      toon([melding({ title: "🎾 Nieuwe ronde staat klaar" })]);
      expect(screen.getByText("Nieuwe ronde staat klaar")).toBeInTheDocument();
      expect(screen.queryByText(/🎾/)).toBeNull();
    });

    it("noemt de soort voor wie luistert", () => {
      toon([melding({ soort: "var", title: "Er wordt een punt betwist" })]);
      expect(screen.getByText("VAR:")).toBeInTheDocument();
    });
  });

  // #1273: useMeldingen leverde een fout op, maar die kwam nooit hier aan —
  // het paneel viel dan terug op de lege staat.
  describe("een mislukte query (#1273)", () => {
    it("meldt de fout met een weg vooruit in plaats van 'nog niets te melden'", async () => {
      const { onVeranderd } = toon([], { fout: "Kon meldingen niet laden" });
      expect(screen.getByRole("alert")).toHaveTextContent(
        /kon meldingen niet laden/i,
      );
      expect(screen.queryByText(/nog niets te melden/i)).toBeNull();
      await userEvent.click(
        screen.getByRole("button", { name: /opnieuw proberen/i }),
      );
      expect(onVeranderd).toHaveBeenCalled();
    });

    it("laat de wegwijzers staan, ook als het laden faalde", () => {
      toon([], { fout: "offline" });
      expect(
        screen.getByRole("link", { name: /meldingsvoorkeuren/i }),
      ).toBeInTheDocument();
    });
  });
});
