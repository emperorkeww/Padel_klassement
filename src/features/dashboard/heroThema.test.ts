import { describe, expect, it } from "vitest";
import {
  HERO_OVERLAY_PRIORITEIT,
  HERO_PERMANENT_PRIORITEIT,
  heroKlassen,
  heroLijstProfiel,
  heroOverlay,
  heroPermanent,
} from "./heroThema";

// Deze suite stond tot #771 als "heroThema" in dashboardHelpers.test.ts, met één
// ladder van zeven statussen. Sinds #771 zijn het twee assen; de verwachtingen
// per as zijn ongewijzigd overgenomen, behalve dat In-Form en On Fire nu overlays
// zijn in plaats van kaartvarianten.

const geen = {
  dictator: false,
  bigDaddy: false,
  kampioen: false,
  inForm: false,
  onFire: false,
  pias: false,
  piet: false,
  schild: false,
};

describe("heroPermanent (#644/#760/#771)", () => {
  it("laat de kaart zonder enige status op zijn eigen divisie staan", () => {
    expect(heroPermanent(geen)).toBeNull();
  });

  it("geeft elke permanente status zijn eigen materiaal", () => {
    expect(heroPermanent({ ...geen, dictator: true })).toBe("dictator");
    expect(heroPermanent({ ...geen, bigDaddy: true })).toBe("bigdaddy");
    expect(heroPermanent({ ...geen, kampioen: true })).toBe("kampioen");
    expect(heroPermanent({ ...geen, pias: true })).toBe("pias");
    expect(heroPermanent({ ...geen, piet: true })).toBe("piet");
  });

  it("houdt de tijdelijke statussen buiten het permanente materiaal (#771)", () => {
    // De kern van #771: in vorm zijn of een reeks hebben verandert niet wélke
    // kaart je draagt. Zonder permanente status blijft de kaart dus zijn divisie.
    expect(heroPermanent({ ...geen, inForm: true })).toBeNull();
    expect(heroPermanent({ ...geen, onFire: true })).toBeNull();
    // En het permanente thema blijft staan als er een overlay over ligt: dit was
    // vóór #771 een In-Form-kaart waarop de schande onzichtbaar werd.
    expect(heroPermanent({ ...geen, pias: true, inForm: true })).toBe("pias");
    expect(heroPermanent({ ...geen, piet: true, onFire: true })).toBe("piet");
    expect(heroPermanent({ ...geen, kampioen: true, inForm: true })).toBe(
      "kampioen",
    );
  });

  it("spiegelt de volgorde van EDITIE_PRIORITEIT op de FUT-kaart", () => {
    // De hele ladder in één keer: bij álles tegelijk wint de troon, en met elke
    // hogere status uitgeschakeld schuift precies de volgende naar voren.
    expect(HERO_PERMANENT_PRIORITEIT).toEqual([
      "dictator",
      "bigdaddy",
      "kampioen",
      "pias",
      "piet",
    ]);
    const alles = {
      ...geen,
      dictator: true,
      bigDaddy: true,
      kampioen: true,
      pias: true,
      piet: true,
    };
    expect(heroPermanent(alles)).toBe("dictator");
    expect(heroPermanent({ ...alles, dictator: false })).toBe("bigdaddy");
    expect(heroPermanent({ ...alles, dictator: false, bigDaddy: false })).toBe(
      "kampioen",
    );
    expect(
      heroPermanent({
        ...alles,
        dictator: false,
        bigDaddy: false,
        kampioen: false,
      }),
    ).toBe("pias");
    expect(
      heroPermanent({
        ...alles,
        dictator: false,
        bigDaddy: false,
        kampioen: false,
        pias: false,
      }),
    ).toBe("piet");
  });

  it("laat verdienste de schande verdringen, net als op de FUT-kaart", () => {
    // Andere assen: het klassement kent geen groepen, de schande-tokens wel.
    // Wie tegelijk #1 en schande-drager is, krijgt het thema van de eer — de
    // schande-crest blijft ernaast staan (DashboardHero.tsx).
    expect(heroPermanent({ ...geen, bigDaddy: true, piet: true })).toBe("bigdaddy");
    expect(heroPermanent({ ...geen, bigDaddy: true, pias: true })).toBe("bigdaddy");
    expect(
      heroPermanent({ ...geen, dictator: true, pias: true, piet: true }),
    ).toBe("dictator");
    expect(heroPermanent({ ...geen, kampioen: true, pias: true })).toBe("kampioen");
  });

  it("laat binnen de eer de zeldzaamste titel voorgaan", () => {
    expect(heroPermanent({ ...geen, dictator: true, bigDaddy: true })).toBe(
      "dictator",
    );
    expect(heroPermanent({ ...geen, bigDaddy: true, kampioen: true })).toBe(
      "bigdaddy",
    );
  });

  it("laat binnen de schande de weeklens winnen van het rondgaande token", () => {
    expect(heroPermanent({ ...geen, pias: true, piet: true })).toBe("pias");
  });

  it("dooft met een roast-schild alleen de schande-thema's", () => {
    expect(heroPermanent({ ...geen, pias: true, schild: true })).toBeNull();
    expect(heroPermanent({ ...geen, piet: true, schild: true })).toBeNull();
    expect(
      heroPermanent({ ...geen, pias: true, piet: true, schild: true }),
    ).toBeNull();
    // Eer valt niet onder het schild: daar valt niets te beschermen.
    expect(heroPermanent({ ...geen, bigDaddy: true, schild: true })).toBe(
      "bigdaddy",
    );
    expect(heroPermanent({ ...geen, dictator: true, schild: true })).toBe(
      "dictator",
    );
    expect(heroPermanent({ ...geen, kampioen: true, schild: true })).toBe(
      "kampioen",
    );
    // Met schild valt de kaart terug op de hoogste eer-status, niet op de divisie.
    expect(
      heroPermanent({ ...geen, kampioen: true, pias: true, schild: true }),
    ).toBe("kampioen");
  });
});

describe("heroOverlay (#771)", () => {
  it("laat de kaart zonder tijdelijke status onbedekt", () => {
    expect(heroOverlay(geen)).toBeNull();
    expect(heroOverlay({ ...geen, dictator: true, pias: true })).toBeNull();
  });

  it("geeft elke tijdelijke status zijn eigen overlay", () => {
    expect(heroOverlay({ ...geen, inForm: true })).toBe("inform");
    expect(heroOverlay({ ...geen, onFire: true })).toBe("onfire");
  });

  it("toont er nooit twee tegelijk: In-Form gaat voor On Fire", () => {
    // On Fire is de enige status met meerdere dragers tegelijk (#632) en staat
    // daarom achteraan: een gedeelde eer verdringt geen zeldzamere.
    expect(HERO_OVERLAY_PRIORITEIT).toEqual(["inform", "onfire"]);
    expect(heroOverlay({ ...geen, inForm: true, onFire: true })).toBe("inform");
  });

  it("trekt zich niets aan van het roast-schild", () => {
    expect(heroOverlay({ ...geen, inForm: true, schild: true })).toBe("inform");
    expect(heroOverlay({ ...geen, onFire: true, schild: true })).toBe("onfire");
  });

  it("ligt over élk permanent thema, ook over de schande", () => {
    const s = { ...geen, pias: true, inForm: true };
    expect(heroPermanent(s)).toBe("pias");
    expect(heroOverlay(s)).toBe("inform");
  });
});

describe("heroKlassen (#771)", () => {
  it("zet de overlay náást de variant, niet in plaats daarvan", () => {
    // AC4: de overlay vervangt de onderliggende kaartstatus niet — de
    // pias-klasse blijft staan, ook als In-Form het vlak overneemt.
    expect(heroKlassen("pias", "onfire")).toBe(
      "hero hero--pias hero--overlay-onfire",
    );
    expect(heroKlassen("pias", "inform")).toBe(
      "hero hero--pias hero--overlay-inform hero--lijst-inform",
    );
  });

  it("laat weg wat er niet is", () => {
    expect(heroKlassen(null, null)).toBe("hero");
    expect(heroKlassen("dictator", null)).toBe("hero hero--dictator");
    expect(heroKlassen(null, "onfire")).toBe("hero hero--overlay-onfire");
  });
});

describe("heroLijstProfiel (#834)", () => {
  it("geeft Big Daddy zijn profiel, behalve onder In-Form", () => {
    // Het permanente materiaal blijft van de kaart; On Fire gaat er ín (zie
    // HeroLagen), niet overheen.
    expect(heroLijstProfiel("bigdaddy", null)).toBe("bigdaddy");
    expect(heroLijstProfiel("bigdaddy", "onfire")).toBe("bigdaddy");
    // In-Form heeft een eigen profiel en dat wint: er is één In-Form-kaart, en
    // die ziet er overal hetzelfde uit.
    expect(heroLijstProfiel("bigdaddy", "inform")).toBe("inform");
  });

  it("geeft In-Form zijn profiel op élke kaart", () => {
    expect(heroLijstProfiel(null, "inform")).toBe("inform");
    for (const thema of ["dictator", "kampioen", "pias", "piet"] as const)
      expect(heroLijstProfiel(thema, "inform"), thema).toBe("inform");
  });

  it("geeft On Fire (nog) geen eigen profiel", () => {
    // Er is één referentieontwerp per kaart, en dat van 🔥 is er nog niet.
    expect(heroLijstProfiel(null, "onfire")).toBeNull();
    expect(heroLijstProfiel(null, null)).toBeNull();
  });

  it("zet de klasse zodra de overlay het profiel draagt", () => {
    // Big Daddy heeft aan `.hero--bigdaddy` genoeg; In-Form heeft een tweede
    // klasse nodig omdat `.hero--overlay-inform` ook de inkt zet die hij met
    // niemand deelt, en omdat zijn materiaalblok het permanente thema in de
    // cascade moet verslaan.
    expect(heroKlassen(null, "inform")).toBe(
      "hero hero--overlay-inform hero--lijst-inform",
    );
    expect(heroKlassen("bigdaddy", "onfire")).toBe(
      "hero hero--bigdaddy hero--overlay-onfire",
    );
  });
});
