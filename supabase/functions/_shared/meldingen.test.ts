import { describe, expect, it } from "vitest";
import {
  type Melding,
  meldingRijen,
  type Soort,
  VOORKEUR_KOLOM,
  zonderUitgezet,
} from "./meldingen.ts";

const melding = (over: Partial<Melding> = {}): Melding => ({
  recipients: ["a"],
  title: "Titel",
  body: "Body",
  url: "/x",
  soort: "poll",
  tag: "poll-1",
  ...over,
});

describe("VOORKEUR_KOLOM", () => {
  it("dekt elk soort, ook de soorten zonder schakelaar", () => {
    // De check-constraint op notifications.soort en deze map horen exact gelijk
    // te lopen; een nieuw soort zonder regel hier zou stil ongefilterd pushen.
    const soorten: Soort[] = [
      "nieuwe_ronde",
      "uitslag",
      "vriendschapsverzoek",
      "rangwissel",
      "pias",
      "poll",
      "var",
      "speeldag_herinnering",
      "lef",
    ];
    for (const soort of soorten) {
      expect(soort in VOORKEUR_KOLOM).toBe(true);
    }
    expect(Object.keys(VOORKEUR_KOLOM).sort()).toEqual([...soorten].sort());
  });

  it("mapt op de bestaande notify_*-kolommen van profiles (#57)", () => {
    expect(VOORKEUR_KOLOM.nieuwe_ronde).toBe("notify_new_round");
    expect(VOORKEUR_KOLOM.uitslag).toBe("notify_result");
    expect(VOORKEUR_KOLOM.vriendschapsverzoek).toBe("notify_friend_request");
    expect(VOORKEUR_KOLOM.rangwissel).toBe("notify_rank_change");
    expect(VOORKEUR_KOLOM.speeldag_herinnering).toBe("notify_match_reminder");
    // De lef-onthulling (#804) deelt de schakelaar met de herinnering, zoals
    // vóór #1090 in match-reminders zelf.
    expect(VOORKEUR_KOLOM.lef).toBe("notify_match_reminder");
  });

  it("laat polls, VAR en pias ongefilterd", () => {
    expect(VOORKEUR_KOLOM.poll).toBeNull();
    expect(VOORKEUR_KOLOM.var).toBeNull();
    expect(VOORKEUR_KOLOM.pias).toBeNull();
  });
});

describe("meldingRijen", () => {
  it("maakt één rij per ontvanger", () => {
    const rijen = meldingRijen([melding({ recipients: ["a", "b"] })]);
    expect(rijen).toHaveLength(2);
    expect(rijen[0]).toEqual({
      user_id: "a",
      soort: "poll",
      title: "Titel",
      body: "Body",
      url: "/x",
      tag: "poll-1",
    });
    expect(rijen[1].user_id).toBe("b");
  });

  it("ontdubbelt ontvangers binnen één melding", () => {
    // Twee identieke rijen zouden binnen één statement met elkaar botsen op de
    // partiële unieke index (user_id, tag).
    const rijen = meldingRijen([melding({ recipients: ["a", "a", "b"] })]);
    expect(rijen.map((r) => r.user_id)).toEqual(["a", "b"]);
  });

  it("laat lege ontvangers vallen", () => {
    const rijen = meldingRijen([melding({ recipients: ["", "a"] })]);
    expect(rijen.map((r) => r.user_id)).toEqual(["a"]);
  });

  it("houdt de volgorde aan: bij dezelfde tag wint de laatste", () => {
    const rijen = meldingRijen([
      melding({ title: "eerst" }),
      melding({ title: "laatst" }),
    ]);
    expect(rijen.map((r) => r.title)).toEqual(["eerst", "laatst"]);
  });

  it("geeft een lege lijst voor geen meldingen of geen ontvangers", () => {
    expect(meldingRijen([])).toEqual([]);
    expect(meldingRijen([melding({ recipients: [] })])).toEqual([]);
  });
});

describe("zonderUitgezet", () => {
  it("verwijdert wie de schakelaar op false zette", () => {
    const over = zonderUitgezet(["a", "b"], "notify_result", [
      { id: "a", notify_result: false },
      { id: "b", notify_result: true },
    ]);
    expect(over).toEqual(["b"]);
  });

  it("laat iedereen door als er geen kolom is (poll, VAR, pias, lef)", () => {
    expect(zonderUitgezet(["a", "b"], null, [])).toEqual(["a", "b"]);
  });

  it("faalt open bij een ontbrekend profiel of een queryfout", () => {
    // Zoals vóór #57: geen profielrij (of een lege data door een fout) betekent
    // gewoon sturen, niet zwijgen.
    expect(zonderUitgezet(["a"], "notify_result", [])).toEqual(["a"]);
    expect(zonderUitgezet(["a"], "notify_result", [{ id: "a" }])).toEqual(["a"]);
    expect(
      zonderUitgezet(["a"], "notify_result", [{ id: "a", notify_result: null }]),
    ).toEqual(["a"]);
  });

  it("raakt de inbox niet: het filter draait pas ná meldingRijen", () => {
    // Het hart van #1090 — wie de schakelaar uitzette krijgt geen push, maar
    // zijn rij is dan al geschreven.
    const m = melding({ recipients: ["a"], soort: "uitslag" });
    expect(meldingRijen([m]).map((r) => r.user_id)).toEqual(["a"]);
    expect(
      zonderUitgezet(m.recipients, VOORKEUR_KOLOM[m.soort], [
        { id: "a", notify_result: false },
      ]),
    ).toEqual([]);
  });
});
