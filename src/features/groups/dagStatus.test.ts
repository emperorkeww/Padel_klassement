import { describe, it, expect } from "vitest";
import { automaatStatus, dagVoortgang, rondeWinnaars } from "./dagStatus";
import type { PlayPoll, PollOption } from "./pollsApi";

const TZ = "Europe/Brussels";
const DAG = "2026-07-08";
/** Clubtijd 07:00 (zomertijd = UTC+2): vóór het uur waarop de cron indeelt. */
const VROEG = Date.parse(`${DAG}T05:00:00.000Z`);
/** Clubtijd 12:00: ruim ná dat uur plus de speling van een uur. */
const MIDDAG = Date.parse(`${DAG}T10:00:00.000Z`);

const OPTIE = {
  id: "opt-1",
  poll_id: "poll-1",
  date: DAG,
  start_time: "20:00",
  duration: 90,
} as unknown as PollOption;

const poll = (overrides: Partial<PlayPoll> = {}): PlayPoll =>
  ({
    id: "poll-1",
    group_id: "g1",
    created_by: "p1",
    status: "booked",
    locked_option_id: OPTIE.id,
    club_timezone: TZ,
    rounds_generated_at: null,
    ...overrides,
  }) as PlayPoll;

const basis = {
  options: [OPTIE],
  today: DAG,
  timezone: TZ,
  autoRondes: true,
};

describe("dagVoortgang", () => {
  it("telt uitslagen over alle rondes samen", () => {
    const v = dagVoortgang([
      { round: 1, list: [{ status: "completed" }, { status: "completed" }] },
      { round: 2, list: [{ status: "completed" }, { status: "scheduled" }] },
    ]);
    expect(v).toEqual({ gespeeld: 3, totaal: 4, rondes: 2, openRonde: 2 });
  });

  it("telt losse partijen mee in het totaal, maar niet als ronde", () => {
    const v = dagVoortgang([
      { round: 0, list: [{ status: "completed" }] },
      { round: 1, list: [{ status: "scheduled" }] },
    ]);
    expect(v.totaal).toBe(2);
    expect(v.rondes).toBe(1);
    // Een losse partij zonder uitslag maakt geen "ronde 0" open.
    expect(v.openRonde).toBe(1);
  });

  it("heeft geen open ronde als alles binnen is", () => {
    const v = dagVoortgang([{ round: 1, list: [{ status: "completed" }] }]);
    expect(v.openRonde).toBeNull();
  });

  it("geeft een lege dag nullen", () => {
    expect(dagVoortgang([])).toEqual({
      gespeeld: 0,
      totaal: 0,
      rondes: 0,
      openRonde: null,
    });
  });
});

describe("rondeWinnaars", () => {
  const label = (id: string) =>
    ({ t1: "Remco & Tom", t2: "Sam & Els", t3: "Kris & Bo" })[id] ?? "";
  const won = (teamId: string | null) => ({
    status: "completed",
    winner_team_id: teamId,
  });

  it("noemt de winnende teams van een afgeronde ronde", () => {
    expect(rondeWinnaars([won("t1"), won("t2")], label)).toBe(
      "Remco & Tom, Sam & Els",
    );
  });

  it("telt hetzelfde team maar één keer", () => {
    expect(rondeWinnaars([won("t1"), won("t1")], label)).toBe("Remco & Tom");
  });

  it("kapt af zodat een ingeklapte ronde één regel blijft", () => {
    expect(rondeWinnaars([won("t1"), won("t2"), won("t3")], label)).toBe(
      "Remco & Tom, Sam & Els +1",
    );
  });

  it("laat gelijkspelen en onafgemaakte matches weg", () => {
    expect(
      rondeWinnaars(
        [won(null), { status: "scheduled", winner_team_id: "t1" }],
        label,
      ),
    ).toBe("");
  });
});

describe("automaatStatus", () => {
  it("meldt dat de cron indeelde zodra de poll een rondes-tijdstip draagt", () => {
    const status = automaatStatus({
      ...basis,
      polls: [poll({ rounds_generated_at: `${DAG}T06:04:00.000Z` })],
      rondes: 3,
      now: MIDDAG,
    });
    expect(status).toEqual({
      soort: "klaargezet",
      tijdstip: `${DAG}T06:04:00.000Z`,
    });
  });

  it("noemt rondes zonder dat tijdstip handmatig, mét wie ze maakte", () => {
    const status = automaatStatus({
      ...basis,
      polls: [poll()],
      rondes: 2,
      doorId: "p9",
      now: MIDDAG,
    });
    expect(status).toEqual({ soort: "handmatig", doorId: "p9" });
  });

  it("kondigt de automaat aan vóór het ochtenduur", () => {
    const status = automaatStatus({
      ...basis,
      polls: [poll()],
      rondes: 0,
      now: VROEG,
    });
    expect(status).toEqual({ soort: "komt", uur: "08:00" });
  });

  it("meldt dat er niets ingedeeld werd als dat uur ruim voorbij is", () => {
    const status = automaatStatus({
      ...basis,
      polls: [poll()],
      rondes: 0,
      now: MIDDAG,
    });
    expect(status).toEqual({ soort: "overgeslagen" });
  });

  it("wacht op de boeking zolang de poll alleen gelockt is", () => {
    // magRondesZetten eist status 'booked': pas dan ligt de bezetting vast.
    const status = automaatStatus({
      ...basis,
      polls: [poll({ status: "locked" })],
      rondes: 0,
      now: VROEG,
    });
    expect(status).toEqual({ soort: "wacht" });
  });

  it("zegt het als de groep de automaat uitzette", () => {
    const status = automaatStatus({
      ...basis,
      autoRondes: false,
      polls: [poll()],
      rondes: 0,
      now: VROEG,
    });
    expect(status).toEqual({ soort: "uit" });
  });

  it("zwijgt zonder speeldag van vandaag", () => {
    // Ad hoc gespeeld zonder poll: over de automaat valt niets te melden.
    expect(
      automaatStatus({ ...basis, polls: [], rondes: 0, now: VROEG }),
    ).toBeNull();
    expect(
      automaatStatus({
        ...basis,
        polls: [poll({ status: "open", locked_option_id: null })],
        rondes: 0,
        now: VROEG,
      }),
    ).toBeNull();
  });

  it("valt bij rondes zonder poll terug op handmatig", () => {
    // Zelf ingedeeld buiten een speeldag om: dat is nog steeds handwerk.
    expect(
      automaatStatus({ ...basis, polls: [], rondes: 1, now: MIDDAG }),
    ).toEqual({ soort: "handmatig", doorId: null });
  });

  it("laat een geboekte speeldag winnen van een gelockte op dezelfde dag", () => {
    const tweede = { ...OPTIE, id: "opt-2", poll_id: "poll-2" };
    const status = automaatStatus({
      ...basis,
      options: [OPTIE, tweede],
      polls: [
        poll({ id: "poll-2", status: "locked", locked_option_id: tweede.id }),
        poll({ rounds_generated_at: `${DAG}T06:04:00.000Z` }),
      ],
      rondes: 3,
      now: MIDDAG,
    });
    expect(status).toEqual({
      soort: "klaargezet",
      tijdstip: `${DAG}T06:04:00.000Z`,
    });
  });
});
