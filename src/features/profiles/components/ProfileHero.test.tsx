import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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
