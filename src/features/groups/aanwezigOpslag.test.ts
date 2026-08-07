import { beforeEach, describe, expect, it } from "vitest";
import {
  aanwezigSleutel,
  bewaarKeuzes,
  leesKeuzes,
  pasKeuzesToe,
  ruimOudeKeuzes,
} from "./aanwezigOpslag";

const LEDEN = ["p1", "p2", "p3", "p4"];

beforeEach(() => {
  localStorage.clear();
});

describe("bewaren en lezen", () => {
  it("leest terug wat er bewaard is", () => {
    bewaarKeuzes("g1", "2026-08-07", { p2: false });
    expect(leesKeuzes("g1", "2026-08-07")).toEqual({ p2: false });
  });

  it("houdt groepen en dagen uit elkaar", () => {
    bewaarKeuzes("g1", "2026-08-07", { p2: false });
    expect(leesKeuzes("g2", "2026-08-07")).toEqual({});
    expect(leesKeuzes("g1", "2026-08-08")).toEqual({});
  });

  it("wist de sleutel als er niets meer af te wijken valt", () => {
    bewaarKeuzes("g1", "2026-08-07", { p2: false });
    bewaarKeuzes("g1", "2026-08-07", {});
    expect(localStorage.getItem(aanwezigSleutel("g1", "2026-08-07"))).toBeNull();
  });

  it("valt terug op niets bij onleesbare opslag", () => {
    localStorage.setItem(aanwezigSleutel("g1", "2026-08-07"), "{kapot");
    expect(leesKeuzes("g1", "2026-08-07")).toEqual({});
  });

  it("negeert waarden die geen ja of nee zijn", () => {
    localStorage.setItem(
      aanwezigSleutel("g1", "2026-08-07"),
      JSON.stringify({ p1: true, p2: "misschien" }),
    );
    expect(leesKeuzes("g1", "2026-08-07")).toEqual({ p1: true });
  });
});

// Een dag kan twee speeldagen dragen (ochtend + avond). Wie je 's ochtends
// uitzet hoort 's avonds gewoon weer mee te doen (#1146).
describe("twee speeldagen op één dag", () => {
  it("houdt de momenten van dezelfde dag uit elkaar", () => {
    bewaarKeuzes("g1", "2026-08-07", { p2: false }, "opt-ochtend");
    bewaarKeuzes("g1", "2026-08-07", { p3: false }, "opt-avond");

    expect(leesKeuzes("g1", "2026-08-07", "opt-ochtend")).toEqual({ p2: false });
    expect(leesKeuzes("g1", "2026-08-07", "opt-avond")).toEqual({ p3: false });
    // En de sleutel zonder moment (de Spelen-tab) staat er los van.
    expect(leesKeuzes("g1", "2026-08-07")).toEqual({});
  });

  it("veegt de andere speeldag van vandaag niet weg bij het opruimen", () => {
    bewaarKeuzes("g1", "2026-08-06", { p1: false }, "opt-gisteren");
    bewaarKeuzes("g1", "2026-08-07", { p2: false }, "opt-ochtend");

    bewaarKeuzes("g1", "2026-08-07", { p3: false }, "opt-avond");

    // De ochtend van vandaag blijft; gisteren is opgeruimd zoals altijd.
    expect(leesKeuzes("g1", "2026-08-07", "opt-ochtend")).toEqual({ p2: false });
    expect(leesKeuzes("g1", "2026-08-06", "opt-gisteren")).toEqual({});
  });

  it("zet het moment in de sleutel", () => {
    expect(aanwezigSleutel("g1", "2026-08-07", "opt-1")).toBe(
      "groep:g1:aanwezig:2026-08-07@opt-1",
    );
    expect(aanwezigSleutel("g1", "2026-08-07")).toBe(
      "groep:g1:aanwezig:2026-08-07",
    );
  });
});

describe("opruimen", () => {
  it("gooit de dagen van gisteren weg maar laat andere groepen staan", () => {
    bewaarKeuzes("g1", "2026-08-06", { p1: false });
    bewaarKeuzes("g2", "2026-08-06", { p1: false });

    ruimOudeKeuzes("g1", "2026-08-07");

    expect(leesKeuzes("g1", "2026-08-06")).toEqual({});
    expect(leesKeuzes("g2", "2026-08-06")).toEqual({ p1: false });
  });

  // Bewaren ruimt zelf op: zo blijft er nooit een dag van vorige week hangen
  // zonder dat iets daar expliciet om vraagt.
  it("ruimt op zodra er voor een nieuwe dag bewaard wordt", () => {
    bewaarKeuzes("g1", "2026-08-06", { p1: false });
    bewaarKeuzes("g1", "2026-08-07", { p2: false });
    expect(leesKeuzes("g1", "2026-08-06")).toEqual({});
  });
});

describe("pasKeuzesToe", () => {
  it("laat de poll staan zolang er niets is aangeraakt", () => {
    expect([...pasKeuzesToe(LEDEN, ["p1", "p2"], {})]).toEqual(["p1", "p2"]);
  });

  it("zet een speler uit die je hebt uitgetikt", () => {
    expect([...pasKeuzesToe(LEDEN, ["p1", "p2"], { p2: false })]).toEqual(["p1"]);
  });

  it("zet een speler aan die niet in de poll zat", () => {
    expect([...pasKeuzesToe(LEDEN, ["p1"], { p4: true })]).toEqual(["p1", "p4"]);
  });

  // Dit is waarom we afwijkingen bewaren en niet de hele set: wie ná jouw
  // correctie alsnog "ja" stemt, hoort gewoon in de lijst te verschijnen.
  it("laat nieuwe poll-stemmen door voor wie je niet hebt aangeraakt", () => {
    const keuzes = { p2: false };
    expect([...pasKeuzesToe(LEDEN, ["p1", "p2"], keuzes)]).toEqual(["p1"]);
    expect([...pasKeuzesToe(LEDEN, ["p1", "p2", "p3"], keuzes)]).toEqual([
      "p1",
      "p3",
    ]);
  });

  it("tovert geen vertrokken lid terug de lijst in", () => {
    expect([...pasKeuzesToe(["p1"], ["p1", "p9"], { p9: true })]).toEqual(["p1"]);
  });
});
