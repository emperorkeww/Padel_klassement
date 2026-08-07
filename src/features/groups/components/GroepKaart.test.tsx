import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { GroepKaart } from "./GroepKaart";
import type { Journey } from "../journey";
import type { GroupSummary } from "../api";

const groep = {
  id: "g1",
  name: "Balleke slaan",
  created_by: "p1",
  member_ids: ["p1", "p2", "p3", "p4", "p5", "p6"],
} as unknown as GroupSummary;

const profielen = {
  p1: { full_name: "Alice Anders", avatar_url: null },
  p2: { full_name: "Bob Boers", avatar_url: null },
};

const journey = (over: Partial<Journey> = {}): Journey => ({
  icon: null,
  label: "Poll loopt — stem mee",
  tone: "act",
  status: "open",
  tab: "agenda",
  ...over,
});

function toon(props: Partial<Parameters<typeof GroepKaart>[0]> = {}) {
  return render(
    <MemoryRouter>
      <GroepKaart
        groep={groep}
        eigenaar={false}
        profiles={profielen}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe("<GroepKaart /> (#1134)", () => {
  // De kern van het issue: een groep is een plek, geen filter. De hele kaart is
  // dus één link, niet een titel met een klikbaar stukje eromheen.
  it("is als geheel één link naar de groepspagina", () => {
    toon();
    const link = screen.getByRole("link", { name: /balleke slaan/i });
    expect(link).toHaveAttribute("href", "/groepen/g1");
    // Geen tweede bestemming op de kaart die met de eerste concurreert.
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  // Anders dan de kaart van vóór #1123, die naar /agenda sprong zodra de
  // reisstatus daarover ging — en je dus soms níet naar de groep bracht.
  it("gaat naar de groep, ook als de status over de agenda gaat", () => {
    toon({ journey: journey({ tab: "agenda" }) });
    expect(screen.getByRole("link", { name: /balleke slaan/i })).toHaveAttribute(
      "href",
      "/groepen/g1",
    );
  });

  it("noemt naam, rol, ledental en status in de naam van de link", () => {
    toon({ eigenaar: true, journey: journey() });
    expect(
      screen.getByRole("link", {
        name: /balleke slaan.*eigenaar.*6 leden.*poll loopt — stem mee/i,
      }),
    ).toBeInTheDocument();
  });

  // "lid" is de standaardtoestand; een badge op elke kaart zegt niets. En
  // "beheerder" bestaat niet: GroupMember.role kent alleen owner en member.
  it("badget alleen de eigenaar", () => {
    const { rerender } = toon({ eigenaar: true });
    expect(screen.getByText(/eigenaar/i)).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <GroepKaart groep={groep} eigenaar={false} profiles={profielen} />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/eigenaar/i)).toBeNull();
    expect(screen.queryByText(/^lid$/i)).toBeNull();
    expect(screen.queryByText(/beheerder/i)).toBeNull();
  });

  // De ledenrij is decoratie naast het ledental in tekst; wie hem niet ziet
  // hoort geen rij lege plaatjes (MemberStack, #975).
  it("toont de ledenrij met een restaantal en het ledental in tekst", () => {
    const { container } = toon();
    expect(container.querySelector(".member-stack")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(screen.getByText("6 leden")).toBeInTheDocument();
  });

  // Vorm draagt de status (WCAG 1.4.1), kleur nooit alleen; de tekst ernaast
  // zegt hem voluit.
  it("zet de status als glyph én als tekst neer", () => {
    const { container } = toon({ journey: journey({ status: "booked" }) });
    expect(container.querySelector(".agenda-glyph--booked")).not.toBeNull();
    expect(screen.getByText(/poll loopt — stem mee/i)).toBeInTheDocument();
  });

  // Elders is het label een aansporing met pijl; op de kaart zou die pijl een
  // tweede bestemming suggereren naast de kaart zelf.
  it("laat de pijl uit het reis-label weg", () => {
    toon({ journey: journey({ label: "Plan een speeldag →", status: null }) });
    expect(screen.getByText("Plan een speeldag")).toBeInTheDocument();
    expect(screen.queryByText(/→/)).toBeNull();
  });

  // De status komt uit een tweede query; zonder gereserveerde regel groeit elke
  // kaart een halve regel zodra die binnenvalt (#916).
  it("houdt de statusregel staan zolang de status nog laadt", () => {
    const { container } = toon({ journey: undefined });
    expect(container.querySelector(".groep-kaart__status")).not.toBeNull();
    expect(container.querySelector(".agenda-glyph")).toBeNull();
  });
});
