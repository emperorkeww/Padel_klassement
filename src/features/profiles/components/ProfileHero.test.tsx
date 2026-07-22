import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Profile } from "@/types";
import type { ProfileData } from "@/features/profiles/components/types";
import { ProfileHero } from "@/features/profiles/components/ProfileHero";

const ALICE: Profile = {
  id: "p1",
  username: "alice",
  full_name: "Alice",
  avatar_url: null,
  created_at: "",
};

const ALICE_MET_FOTO: Profile = {
  ...ALICE,
  avatar_url: "https://example.com/alice.jpg",
};

// ProfileHero leest maar een handvol velden uit ProfileData; de rest laten we
// weg en casten het minimale object naar het volledige type.
function hero(over: Partial<ProfileData> = {}): ProfileData {
  return {
    p: ALICE,
    isMe: false,
    streak: 0,
    nick: "De Bagelbakker 🥯",
    roast: null,
    rank: null,
    ...over,
  } as ProfileData;
}

describe("ProfileHero — Coach Rudy deelt de bijnaam uit (#298)", () => {
  it("presenteert de bijnaam als door Rudy geattribueerd, niet als kale regel", () => {
    render(<ProfileHero d={hero({ nick: "De Sloopkogel 💥" })} />);
    // Rudy is de spreker...
    expect(screen.getByText("Coach Rudy")).toBeInTheDocument();
    // ...en hij deelt de bijnaam uit ("Ik doop <naam>: <bijnaam>").
    expect(screen.getByText(/Ik doop/)).toBeInTheDocument();
    expect(screen.getByText("De Sloopkogel 💥")).toBeInTheDocument();
  });

  it("spreekt je met 'je' aan op je eigen profiel", () => {
    render(<ProfileHero d={hero({ isMe: true })} />);
    expect(screen.getByText(/Ik doop je:/)).toBeInTheDocument();
  });

  it("noemt de naam op andermans profiel", () => {
    render(<ProfileHero d={hero({ isMe: false, p: ALICE })} />);
    expect(screen.getByText(/Ik doop Alice:/)).toBeInTheDocument();
  });

  it("toont de roast als tweede regel wanneer die er is", () => {
    render(<ProfileHero d={hero({ roast: "Jij en winnen: geen match." })} />);
    expect(screen.getByText("Jij en winnen: geen match.")).toBeInTheDocument();
  });

  it("respecteert het roast-schild: neutrale bijnaam, geen plaag-regel", () => {
    // Bij een schild levert de parent roast=null + een neutrale bijnaam; dan
    // blijft enkel de rustige doopregel over.
    render(<ProfileHero d={hero({ nick: "De Racketzwaaier 🏸", roast: null })} />);
    expect(screen.getByText("De Racketzwaaier 🏸")).toBeInTheDocument();
    expect(screen.getByText(/Ik doop/)).toBeInTheDocument();
    // Rudy is er (deelt de doopnaam uit) maar zonder tweede, plagende regel.
    expect(screen.getByText("Coach Rudy")).toBeInTheDocument();
  });
});

describe("ProfileHero — klikbare profielfoto (#572)", () => {
  it("toont geen vergroot-knop bij een initialen-avatar (geen foto)", () => {
    render(<ProfileHero d={hero({ p: ALICE })} />);
    expect(
      screen.queryByRole("button", { name: "Profielfoto vergroten" }),
    ).not.toBeInTheDocument();
  });

  it("maakt de foto klikbaar en vergroot naar een dialoog", async () => {
    const user = userEvent.setup();
    render(<ProfileHero d={hero({ p: ALICE_MET_FOTO })} />);

    const knop = screen.getByRole("button", { name: "Profielfoto vergroten" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(knop);
    expect(screen.getByRole("dialog", { name: "Vergrote profielfoto" })).toBeInTheDocument();
  });

  it("sluit met Escape en geeft focus terug aan de avatar-knop", async () => {
    const user = userEvent.setup();
    render(<ProfileHero d={hero({ p: ALICE_MET_FOTO })} />);

    const knop = screen.getByRole("button", { name: "Profielfoto vergroten" });
    await user.click(knop);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(knop).toHaveFocus();
  });

  it("sluit door op de achtergrond/foto te klikken", async () => {
    const user = userEvent.setup();
    render(<ProfileHero d={hero({ p: ALICE_MET_FOTO })} />);

    await user.click(screen.getByRole("button", { name: "Profielfoto vergroten" }));
    await user.click(screen.getByRole("dialog"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("ProfileHero — PlayStyles op de kaart (#500)", () => {
  const BADGES = [
    { id: "comeback", naam: "Comebackkoning", emoji: "👑", omschrijving: "", behaald: true },
    { id: "reus", naam: "Reuzendoder", emoji: "🗡️", omschrijving: "", behaald: true },
    { id: "uil", naam: "Nachtbraker", emoji: "🦉", omschrijving: "", behaald: true },
    { id: "ster", naam: "Perfecte dag", emoji: "🌟", omschrijving: "", behaald: true },
  ];

  it("toont de uitgelichte badges als PlayStyles-chips op de kaart", () => {
    render(<ProfileHero d={hero({ featuredBadges: BADGES.slice(0, 2) })} />);
    const rij = screen.getByRole("list", { name: "Uitgelichte badges" });
    expect(rij).toBeInTheDocument();
    expect(screen.getByLabelText("Comebackkoning")).toBeInTheDocument();
    expect(screen.getByLabelText("Reuzendoder")).toBeInTheDocument();
  });

  it("toont maximaal drie chips, in de volgorde van uitlichten", () => {
    render(<ProfileHero d={hero({ featuredBadges: BADGES })} />);
    const chips = within(
      screen.getByRole("list", { name: "Uitgelichte badges" }),
    ).getAllByRole("listitem");
    expect(chips.map((c) => c.getAttribute("aria-label"))).toEqual([
      "Comebackkoning",
      "Reuzendoder",
      "Nachtbraker",
    ]);
  });

  it("toont geen chip-rij zonder uitgelichte badges", () => {
    render(<ProfileHero d={hero({ featuredBadges: [] })} />);
    expect(
      screen.queryByRole("list", { name: "Uitgelichte badges" }),
    ).not.toBeInTheDocument();
  });
});

describe("ProfileHero — speciale editie op de kaart (#621)", () => {
  it("draagt de Icon-editie mét editie-regel, net als op het klassement", () => {
    const { container } = render(
      <ProfileHero d={hero({ editie: "icon", editieTekst: "👑 Big Daddy" })} />,
    );
    expect(container.querySelector(".fut-kaart")).toHaveClass("fut-kaart--icon");
    expect(screen.getByText("👑 Big Daddy")).toBeInTheDocument();
  });

  it("draagt de In-Form-editie van de speler van de week", () => {
    const { container } = render(
      <ProfileHero
        d={hero({ editie: "inform", editieTekst: "⚡ In-Form · +48" })}
      />,
    );
    expect(container.querySelector(".fut-kaart")).toHaveClass(
      "fut-kaart--inform",
    );
    expect(screen.getByText("⚡ In-Form · +48")).toBeInTheDocument();
  });

  it("blijft zonder editie een gewone tier-kaart", () => {
    const { container } = render(<ProfileHero d={hero()} />);
    expect(container.querySelector(".fut-kaart--icon")).toBeNull();
    expect(container.querySelector(".fut-kaart--inform")).toBeNull();
  });
});
