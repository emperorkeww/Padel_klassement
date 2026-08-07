import { describe, it, expect } from "vitest";
import {
  ACTIE_LABEL,
  heeftUitslag,
  matchFase,
  matchRechten,
  primaireActie,
  tippenOpen,
  type MatchRechten,
} from "./matchState";
import { MATCH_DONE, MATCH_PLANNED, TEAMS } from "@/test/fixtures";
import type { Match, Team } from "@/types";

const tmap = Object.fromEntries(TEAMS.map((t) => [t.id, t])) as Record<
  string,
  Team
>;

const NU = Date.parse("2026-07-02T10:00:00.000Z");
const STRAKS = "2026-07-02T20:00:00.000Z";
const EERDER = "2026-07-02T08:00:00.000Z";

const gepland = { ...MATCH_PLANNED, played_at: STRAKS } as Match;
const gespeeld = MATCH_DONE as Match;

/** Kale rechten waarop de tests hun ene relevante vlag zetten. */
const GEEN: MatchRechten = {
  isDeelnemer: false,
  magInvullen: false,
  magCorrigeren: false,
  magBeheren: false,
  alsBeheerder: false,
};

describe("matchFase", () => {
  it("leest een geplande match met starttijd als 'gepland'", () => {
    expect(matchFase(gepland)).toBe("gepland");
  });

  it("onderscheidt een geplande match zonder starttijd", () => {
    // Zonder starttijd is er geen maand/speeldag om lef en joker op af te
    // rekenen; die blokkade hangt aan precies deze fase.
    expect(matchFase({ ...gepland, played_at: null })).toBe(
      "gepland-zonder-tijd",
    );
  });

  it("leest een afgeronde match met cijfers als 'gespeeld'", () => {
    expect(matchFase(gespeeld)).toBe("gespeeld");
  });

  it("herkent een afgeronde match zonder cijfers", () => {
    expect(
      matchFase({ ...gespeeld, score_a: null, score_b: null } as Match),
    ).toBe("gespeeld-zonder-score");
  });

  it("telt half ingevulde cijfers als 'zonder score'", () => {
    // matches_result_consistent laat één leeg cijfer toe; de kaart moet dat
    // niet als eindstand tonen.
    expect(matchFase({ ...gespeeld, score_b: null } as Match)).toBe(
      "gespeeld-zonder-score",
    );
  });

  it("geeft 'afgelast' bij status cancelled", () => {
    expect(matchFase({ ...gepland, status: "cancelled" } as Match)).toBe(
      "afgelast",
    );
  });

  it("behandelt in_progress als gepland", () => {
    // De enum kent de waarde, de app schrijft hem nooit. Een eigen fase die
    // nooit voorkomt zou alleen dode takken opleveren.
    expect(matchFase({ ...gepland, status: "in_progress" } as Match)).toBe(
      "gepland",
    );
  });
});

describe("heeftUitslag", () => {
  it("is waar zodra beide cijfers er staan", () => {
    expect(heeftUitslag(gespeeld)).toBe(true);
    expect(heeftUitslag(gepland)).toBe(false);
    expect(heeftUitslag({ ...gespeeld, score_b: null } as Match)).toBe(false);
  });
});

describe("matchRechten", () => {
  it("herkent de deelnemer", () => {
    // p1 speelt in t-ab, p3 in t-cd, p9 nergens.
    expect(
      matchRechten({ match: gepland, teams: tmap, myId: "p1" }).isDeelnemer,
    ).toBe(true);
    expect(
      matchRechten({ match: gepland, teams: tmap, myId: "p3" }).isDeelnemer,
    ).toBe(true);
    expect(
      matchRechten({ match: gepland, teams: tmap, myId: "p9" }).isDeelnemer,
    ).toBe(false);
  });

  it("herkent de deelnemer ook in een singles-team", () => {
    const singles = { ...gepland, team_a_id: "t-a", team_b_id: "t-c" } as Match;
    expect(
      matchRechten({ match: singles, teams: tmap, myId: "p1" }).isDeelnemer,
    ).toBe(true);
    // p2 speelde in het dubbel mét p1, maar staat niet in het singles-team.
    expect(
      matchRechten({ match: singles, teams: tmap, myId: "p2" }).isDeelnemer,
    ).toBe(false);
  });

  it("laat de deelnemer wel invullen maar niet corrigeren (#413)", () => {
    // p2 speelt mee maar maakte de match niet aan: de policy "Deelnemer kan
    // uitslag invullen" dekt alleen de overgang naar completed.
    const r = matchRechten({ match: gepland, teams: tmap, myId: "p2" });
    expect(r.magInvullen).toBe(true);
    expect(r.magCorrigeren).toBe(false);
  });

  it("laat de aanmaker invullen én corrigeren", () => {
    // created_by van de fixture is p1.
    const r = matchRechten({ match: gepland, teams: tmap, myId: "p1" });
    expect(r.magInvullen).toBe(true);
    expect(r.magCorrigeren).toBe(true);
  });

  it("geeft de groepseigenaar alles, ook zonder mee te spelen (#978)", () => {
    const r = matchRechten({
      match: gepland,
      teams: tmap,
      myId: "p9",
      isGroupOwner: true,
    });
    expect(r.isDeelnemer).toBe(false);
    expect(r.magInvullen).toBe(true);
    expect(r.magCorrigeren).toBe(true);
    expect(r.magBeheren).toBe(true);
  });

  it("geeft een buitenstaander niets", () => {
    expect(matchRechten({ match: gepland, teams: tmap, myId: "p9" })).toEqual({
      isDeelnemer: false,
      magInvullen: false,
      magCorrigeren: false,
      magBeheren: false,
      alsBeheerder: false,
    });
  });

  it("geeft een uitgelogde kijker niets", () => {
    const r = matchRechten({ match: gepland, teams: tmap, myId: null });
    expect(r.magInvullen).toBe(false);
    expect(r.magCorrigeren).toBe(false);
  });

  // De beheerder van de app (#1159). Zijn rechten staan bewust niet in de
  // RLS-policies — hij schrijft via de edge function `admin-content` — dus
  // `alsBeheerder` moet zeggen wélke route de knop neemt.
  describe("beheerder van de app (#1159)", () => {
    it("geeft een buitenstaander die beheerder is alles, gemarkeerd als beheerdaad", () => {
      const r = matchRechten({
        match: gepland,
        teams: tmap,
        myId: "p9",
        isAppAdmin: true,
      });
      expect(r.magInvullen).toBe(true);
      expect(r.magCorrigeren).toBe(true);
      expect(r.magBeheren).toBe(true);
      expect(r.alsBeheerder).toBe(true);
      // Hij speelt nog steeds niet mee; dat blijft een feit en geen recht.
      expect(r.isDeelnemer).toBe(false);
    });

    it("markeert het níet als beheerdaad wanneer de aanmaker toevallig ook beheerder is", () => {
      // Wie op eigen titel mag, schrijft rechtstreeks over RLS en hoeft niet in
      // het auditlogboek te belanden.
      const r = matchRechten({
        match: gepland,
        teams: tmap,
        myId: "p1",
        isAppAdmin: true,
      });
      expect(r.magCorrigeren).toBe(true);
      expect(r.alsBeheerder).toBe(false);
    });

    it("markeert het níet als beheerdaad voor de groepseigenaar", () => {
      const r = matchRechten({
        match: gepland,
        teams: tmap,
        myId: "p9",
        isGroupOwner: true,
        isAppAdmin: true,
      });
      expect(r.magBeheren).toBe(true);
      expect(r.alsBeheerder).toBe(false);
    });

    it("geeft een uitgelogde kijker niets, ook niet met de vlag aan", () => {
      const r = matchRechten({
        match: gepland,
        teams: tmap,
        myId: null,
        isAppAdmin: true,
      });
      expect(r.magInvullen).toBe(false);
      expect(r.magCorrigeren).toBe(false);
      expect(r.alsBeheerder).toBe(false);
    });
  });

  // Dit is de valkuil waarvoor deze module bestaat: `magBeheren` hangt op
  // perspectiveId (op een profielpagina de profieleigenaar), `magInvullen` op
  // myId (de ingelogde kijker). Trek je ze gelijk, dan krijgt een bezoeker van
  // andermans profiel beheerknoppen die de server weigert.
  describe("perspectiveId vs myId", () => {
    it("hangt magBeheren aan perspectiveId, niet aan de kijker", () => {
      const r = matchRechten({
        match: gepland,
        teams: tmap,
        myId: "p2",
        perspectiveId: "p1", // p1 maakte de match aan
      });
      expect(r.magBeheren).toBe(true);
      expect(r.magCorrigeren).toBe(false); // p2 is niet de aanmaker
    });

    it("geeft geen beheer zonder perspectief, ook niet aan de aanmaker", () => {
      // Zo werkte het altijd al: zonder perspectiveId valt de aanmaker-tak weg
      // en blijft alleen groepseigenaarschap over.
      const r = matchRechten({ match: gepland, teams: tmap, myId: "p1" });
      expect(r.magBeheren).toBe(false);
      expect(r.magCorrigeren).toBe(true);
    });
  });
});

describe("tippenOpen", () => {
  it("staat open op een geplande groepsmatch vóór de starttijd", () => {
    expect(tippenOpen(gepland, NU)).toBe(true);
  });

  it("sluit zodra de starttijd geweest is", () => {
    expect(tippenOpen({ ...gepland, played_at: EERDER } as Match, NU)).toBe(
      false,
    );
  });

  it("blijft open zolang er geen starttijd is", () => {
    expect(tippenOpen({ ...gepland, played_at: null } as Match, NU)).toBe(true);
  });

  it("sluit op een afgeronde match", () => {
    expect(tippenOpen(gespeeld, NU)).toBe(false);
  });

  it("staat nooit open op een losse match", () => {
    expect(tippenOpen({ ...gepland, group_id: null } as Match, NU)).toBe(false);
  });
});

describe("primaireActie", () => {
  const actie = (
    fase: Parameters<typeof primaireActie>[0]["fase"],
    rechten: Partial<MatchRechten>,
    tippen = false,
  ) =>
    primaireActie({
      fase,
      rechten: { ...GEEN, ...rechten },
      tippenOpen: tippen,
    });

  it("laat wie mag invullen de uitslag invullen", () => {
    expect(actie("gepland", { magInvullen: true })).toBe("uitslag-invullen");
  });

  it("biedt de kijker die alleen mag tippen, tippen aan", () => {
    expect(actie("gepland", {}, true)).toBe("tippen");
  });

  it("valt terug op bekijken als er niets te doen is", () => {
    expect(actie("gepland", {})).toBe("bekijken");
  });

  it("laat een organisator een half klaargezette match vervolledigen", () => {
    expect(actie("gepland-zonder-tijd", { magBeheren: true })).toBe(
      "match-vervolledigen",
    );
  });

  it("houdt uitslag invullen boven vervolledigen", () => {
    // Wie de uitslag kan invullen krijgt dát als hoofdzaak; een tijdstip zetten
    // is administratie en zit in het ⋯-menu.
    expect(
      actie("gepland-zonder-tijd", { magInvullen: true, magBeheren: true }),
    ).toBe("uitslag-invullen");
  });

  it("laat een afgeronde match zonder cijfers invullen door wie mag corrigeren", () => {
    expect(actie("gespeeld-zonder-score", { magCorrigeren: true })).toBe(
      "score-invoeren",
    );
    expect(actie("gespeeld-zonder-score", { magInvullen: true })).toBe(
      "bekijken",
    );
  });

  it("geeft een gespeelde match altijd bekijken als primaire actie", () => {
    // Corrigeren kan wel, maar dat is een uitzondering en hoort in het ⋯-menu.
    expect(actie("gespeeld", { magCorrigeren: true, magBeheren: true })).toBe(
      "bekijken",
    );
  });

  it("doet niets bijzonders met een afgelaste match", () => {
    expect(actie("afgelast", { magInvullen: true, magBeheren: true })).toBe(
      "bekijken",
    );
  });
});

describe("ACTIE_LABEL", () => {
  it("heeft voor elke actie een opschrift", () => {
    const acties = [
      "uitslag-invullen",
      "score-invoeren",
      "match-vervolledigen",
      "tippen",
      "bekijken",
    ] as const;
    for (const a of acties) expect(ACTIE_LABEL[a]).toBeTruthy();
  });
});
