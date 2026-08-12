import { describe, it, expect, beforeEach } from "vitest";
import {
  leesRecent,
  onthoudRecent,
  sorteerSpelers,
} from "@/features/matches/spelerVolgorde";
import type { Profile } from "@/types";

const speler = (id: string, naam: string, gast = false) =>
  ({
    id,
    username: naam,
    full_name: naam,
    avatar_url: null,
    is_guest: gast,
  }) as unknown as Profile;

const ik = speler("mij", "Zoe Zeldenrust");
const anna = speler("a", "Anna Aerts");
const bram = speler("b", "Bram Bakker");
const cis = speler("c", "Cis Claes");
const gast = speler("g", "Aad de Gast", true);

describe("sorteerSpelers", () => {
  it("zet jezelf bovenaan, ook met een naam achteraan het alfabet", () => {
    const lijst = sorteerSpelers([anna, ik, bram], { myId: "mij", recent: [] });
    expect(lijst.map((p) => p.id)).toEqual(["mij", "a", "b"]);
  });

  it("zet wie je het laatst meenam vóór de rest", () => {
    const lijst = sorteerSpelers([anna, bram, cis], {
      myId: "mij",
      recent: ["c"],
    });
    expect(lijst.map((p) => p.id)).toEqual(["c", "a", "b"]);
  });

  it("houdt binnen 'recent' de volgorde van de laatste keer aan", () => {
    const lijst = sorteerSpelers([anna, bram, cis], {
      myId: "mij",
      recent: ["c", "b"],
    });
    expect(lijst.map((p) => p.id)).toEqual(["c", "b", "a"]);
  });

  it("zet gasten onderaan, hoe recent ook", () => {
    // Een gast bestaat maar voor één avond; hem boven je vaste maten zetten
    // omdat hij toevallig alfabetisch vooraan staat, klopt niet.
    const lijst = sorteerSpelers([gast, bram, anna], {
      myId: "mij",
      recent: ["g"],
    });
    expect(lijst.map((p) => p.id)).toEqual(["a", "b", "g"]);
  });

  it("laat de meegegeven lijst zelf ongemoeid", () => {
    const invoer = [bram, anna];
    sorteerSpelers(invoer, { myId: "mij", recent: [] });
    expect(invoer.map((p) => p.id)).toEqual(["b", "a"]);
  });
});

describe("recent onthouden", () => {
  beforeEach(() => localStorage.clear());

  it("zet de laatste selectie vooraan en ontdubbelt", () => {
    onthoudRecent("groep", ["a", "b"], "mij");
    onthoudRecent("groep", ["c", "a"], "mij");
    expect(leesRecent("groep")).toEqual(["c", "a", "b"]);
  });

  it("laat jezelf eruit: je staat toch al bovenaan", () => {
    onthoudRecent("groep", ["mij", "a"], "mij");
    expect(leesRecent("groep")).toEqual(["a"]);
  });

  it("houdt groepen uit elkaar", () => {
    onthoudRecent("groep", ["a"], "mij");
    onthoudRecent(null, ["b"], "mij");
    expect(leesRecent("groep")).toEqual(["a"]);
    expect(leesRecent(null)).toEqual(["b"]);
  });

  it("overleeft rommel in de opslag", () => {
    localStorage.setItem("vamos:match-mru:groep", "{geen json");
    expect(leesRecent("groep")).toEqual([]);
    localStorage.setItem("vamos:match-mru:groep", '{"niet":"een lijst"}');
    expect(leesRecent("groep")).toEqual([]);
  });

  it("onthoudt er hoogstens acht", () => {
    onthoudRecent("groep", ["1", "2", "3", "4", "5", "6", "7", "8", "9"], "mij");
    expect(leesRecent("groep")).toHaveLength(8);
    expect(leesRecent("groep")).not.toContain("9");
  });
});
