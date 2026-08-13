import { describe, it, expect } from "vitest";
import {
  leesDag,
  leesMaand,
  maandParam,
  paramsNaarStand,
  patchAgendaParams,
  standNaarParams,
  type AgendaStand,
} from "./agendaParams";

// De agendastand staat sinds #1182 in de URL. Wat hier vastligt: de standaard
// staat er níét in (anders draagt elke agenda een sleep parameters mee), een
// kapotte waarde valt stil terug, en één actie schrijft alle sleutels in één
// keer — twee losse setSearchParams in dezelfde tick overschrijven elkaar.

const VANDAAG = "2026-08-07";

const stand = (o: Partial<AgendaStand> = {}): AgendaStand => ({
  maand: { jaar: 2026, maand: 8 },
  dag: VANDAAG,
  open: null,
  weergave: "maand",
  plan: false,
  groepen: null,
  ...o,
});

const params = (s: string) => new URLSearchParams(s);

/** Wat er ná deze wijziging in de URL staat. */
function schrijf(s: AgendaStand, vorige = ""): string {
  return patchAgendaParams(params(vorige), standNaarParams(s, VANDAAG)).toString();
}

describe("agendaParams", () => {
  it("schrijft de standaardstand niet op", () => {
    // Vandaag, de maand van vandaag, geen sheet, maandoverzicht: dat is een
    // kale /agenda en geen /agenda?dag=…&maand=…&weergave=maand.
    expect(schrijf(stand())).toBe("");
  });

  it("schrijft de dag zodra je ergens anders kijkt", () => {
    expect(schrijf(stand({ dag: "2026-08-13" }))).toBe("dag=2026-08-13");
  });

  it("laat de maand weg zolang hij bij de gekozen dag hoort", () => {
    // De maand is bijna altijd af te leiden uit de dag; alleen als je met
    // PageUp/PageDown het raster uit bladert schuift hij los mee.
    expect(schrijf(stand({ dag: "2026-09-05", maand: { jaar: 2026, maand: 9 } }))).toBe(
      "dag=2026-09-05",
    );
    expect(
      schrijf(stand({ dag: "2026-08-07", maand: { jaar: 2026, maand: 9 } })),
    ).toBe("maand=2026-09");
  });

  it("zet het open sheet erin zonder de dag te herhalen", () => {
    expect(schrijf(stand({ dag: "2026-08-13", open: "2026-08-13" }))).toBe(
      "dag=2026-08-13&open=1",
    );
  });

  it("wist een sleutel die niet meer geldt", () => {
    // Sluiten haalt open=1 weg en laat de rest staan; dat is precies waarom
    // alle sleutels in één patch gaan.
    expect(schrijf(stand({ dag: "2026-08-13" }), "dag=2026-08-13&open=1")).toBe(
      "dag=2026-08-13",
    );
  });

  it("leest terug wat het schreef", () => {
    const uit = paramsNaarStand(params("dag=2026-08-13&open=1&weergave=lijst"), VANDAAG);
    expect(uit).toEqual({
      dag: "2026-08-13",
      maand: { jaar: 2026, maand: 8 },
      open: "2026-08-13",
      weergave: "lijst",
      plan: false,
      groepen: null,
    });
  });

  it("valt stil terug op vandaag bij onzin", () => {
    // Niet rechtzetten door de URL te herschrijven: dat zou een tweede
    // schrijver zijn én een extra history-entry opleveren.
    const uit = paramsNaarStand(params("dag=morgen&maand=2026-13&weergave=week"), VANDAAG);
    expect(uit).toEqual({
      dag: VANDAAG,
      maand: { jaar: 2026, maand: 8 },
      open: null,
      weergave: "maand",
      plan: false,
      groepen: null,
    });
  });

  it("draagt het groepsfilter mee, zodat een gedeelde link hetzelfde toont (#1270)", () => {
    // Het filter zat alleen in localStorage: dezelfde link liet bij de ander
    // een andere maand zien. Niet gezeefd tegen jóuw groepen — dat doet
    // `leesGroepKeuze` verderop, met dezelfde zeef als de onthouden keuze.
    expect(paramsNaarStand(params("groepen=g1,g2"), VANDAAG).groepen).toBe("g1,g2");
    expect(schrijf(stand({ groepen: "g1,g2" }))).toBe("groepen=g1%2Cg2");
    // Alle chips uit is de standaard, en die schrijven we niet op.
    expect(schrijf(stand({ groepen: null }), "groepen=g1")).toBe("");
    expect(paramsNaarStand(params("groepen="), VANDAAG).groepen).toBeNull();
  });

  it("leest en schrijft losse waarden", () => {
    expect(maandParam({ jaar: 2026, maand: 3 })).toBe("2026-03");
    expect(leesMaand("2026-03")).toEqual({ jaar: 2026, maand: 3 });
    expect(leesMaand("2026-00")).toBeNull();
    expect(leesMaand("2026")).toBeNull();
    expect(leesDag("2026-08-13")).toBe("2026-08-13");
    expect(leesDag("13-08-2026")).toBeNull();
  });

  it("laat parameters van iemand anders met rust", () => {
    // De agenda is niet de enige die iets in de URL kan zetten.
    expect(schrijf(stand({ dag: "2026-08-13" }), "utm=push")).toBe(
      "utm=push&dag=2026-08-13",
    );
  });
  // #1213: de instap vanaf Banen. Eén sleutel erbij, met dezelfde afspraak als
  // de rest — hij staat er alleen in als hij aanstaat.
  it("leest en schrijft de plan-instap", () => {
    expect(paramsNaarStand(params("dag=2026-08-14&plan=1"), VANDAAG)).toMatchObject({
      dag: "2026-08-14",
      plan: true,
    });
    expect(paramsNaarStand(params(""), VANDAAG).plan).toBe(false);
    expect(schrijf(stand({ plan: true }))).toBe("plan=1");
    // En hij wist zichzelf zodra de agenda hem verwerkt heeft.
    expect(schrijf(stand({ plan: false }), "plan=1")).toBe("");
  });
});
