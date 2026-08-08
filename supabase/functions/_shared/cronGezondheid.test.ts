import { describe, expect, it } from "vitest";
import {
  beoordeelCron,
  drempelMinuten,
  verwachtIntervalMinuten,
  type CronJobFeiten,
} from "./cronGezondheid.ts";

// De vijf schedules die supabase/snippets/*_cron.sql echt aanmaakt. Als iemand
// daar een schema wijzigt zonder hier te kijken, hoort dat op te vallen.
describe("verwachtIntervalMinuten — de echte schedules", () => {
  it.each([
    ["10,25,40,55 * * * *", 15, "appeal-deadline"],
    ["*/15 * * * *", 15, "match-reminders"],
    ["5 * * * *", 60, "poll-deadline"],
    ["17,32,47 * * * *", 30, "snapshot-availability-vers"],
    ["2 * * * *", 60, "snapshot-availability-week"],
  ])("%s -> %i minuten (%s)", (schedule, verwacht) => {
    expect(verwachtIntervalMinuten(schedule)).toBe(verwacht);
  });
});

describe("verwachtIntervalMinuten — randen", () => {
  it("rekent bij een minutenlijst met het gat over het uur heen", () => {
    // 47 -> 17 is 30 minuten; het gemiddelde (20) zou te streng zijn.
    expect(verwachtIntervalMinuten("17,32,47 * * * *")).toBe(30);
  });

  it("rekent bij */n met de sprong terug naar :00", () => {
    // */40 draait op :00 en :40; het grootste gat is 40, niet 20.
    expect(verwachtIntervalMinuten("*/40 * * * *")).toBe(40);
    // */25 draait op :00, :25, :50 — het gat :50 -> :00 is maar 10.
    expect(verwachtIntervalMinuten("*/25 * * * *")).toBe(25);
  });

  it("kent elke minuut", () => {
    expect(verwachtIntervalMinuten("* * * * *")).toBe(1);
  });

  it("kent een vast uur als dagelijks", () => {
    expect(verwachtIntervalMinuten("30 3 * * *")).toBe(1440);
  });

  it("ontdubbelt en sorteert een rommelige lijst", () => {
    expect(verwachtIntervalMinuten("40,10,25,55,10 * * * *")).toBe(15);
  });

  it("geeft null bij alles wat we niet met zekerheid lezen", () => {
    expect(verwachtIntervalMinuten("0 0 * * 1")).toBeNull(); // weekdag
    expect(verwachtIntervalMinuten("0 0 1 * *")).toBeNull(); // dag van de maand
    expect(verwachtIntervalMinuten("0-30 * * * *")).toBeNull(); // bereik
    expect(verwachtIntervalMinuten("kapot")).toBeNull();
    expect(verwachtIntervalMinuten("* * * *")).toBeNull(); // vier velden
  });
});

describe("drempelMinuten", () => {
  it("legt een bodem van tien minuten onder de marge", () => {
    expect(drempelMinuten(1)).toBe(11);
    expect(drempelMinuten(15)).toBe(25);
  });

  it("schaalt mee met langzame jobs", () => {
    expect(drempelMinuten(60)).toBe(90);
    expect(drempelMinuten(1440)).toBe(2160);
  });
});

const NU = new Date("2026-08-08T12:00:00Z");

function job(over: Partial<CronJobFeiten> = {}): CronJobFeiten {
  return {
    jobname: "appeal-deadline",
    schedule: "10,25,40,55 * * * *",
    actief: true,
    laatste_start: "2026-08-08T11:55:00Z",
    laatste_status: "succeeded",
    ...over,
  };
}

describe("beoordeelCron", () => {
  it("noemt een verse, geslaagde run ok", () => {
    expect(beoordeelCron(job(), NU)).toEqual({
      status: "ok",
      stilMinuten: 5,
      drempel: 25,
    });
  });

  it("blijft ok tot precies op de drempel", () => {
    const o = beoordeelCron(
      job({ laatste_start: "2026-08-08T11:35:00Z" }),
      NU,
    );
    expect(o.stilMinuten).toBe(25);
    expect(o.status).toBe("ok");
  });

  it("wordt laat zodra de drempel overschreden is", () => {
    const o = beoordeelCron(
      job({ laatste_start: "2026-08-08T11:34:00Z" }),
      NU,
    );
    expect(o.stilMinuten).toBe(26);
    expect(o.status).toBe("laat");
  });

  it("meldt een uitgezette job als uit en niet als storing", () => {
    // Precies het geval dat je niet als rood wilt zien: iemand heeft hem
    // bewust gepauzeerd.
    expect(beoordeelCron(job({ actief: false, laatste_start: null }), NU)).toEqual(
      { status: "uit", stilMinuten: null, drempel: null },
    );
  });

  it("laat een mislukte run zwaarder wegen dan de klok", () => {
    const o = beoordeelCron(job({ laatste_status: "failed" }), NU);
    expect(o.status).toBe("mislukt");
    expect(o.stilMinuten).toBe(5);
  });

  it("meldt een job die nog nooit draaide", () => {
    const o = beoordeelCron(job({ laatste_start: null }), NU);
    expect(o).toEqual({ status: "nooit", stilMinuten: null, drempel: 25 });
  });

  it("velt geen oordeel over een schema dat het niet kan lezen", () => {
    const o = beoordeelCron(job({ schedule: "0 0 * * 1" }), NU);
    expect(o.status).toBe("onbekend");
    expect(o.drempel).toBeNull();
  });

  it("hangt het oordeel aan de meegegeven klok en niet aan Date.now", () => {
    const later = new Date("2026-08-08T14:00:00Z");
    expect(beoordeelCron(job(), later).status).toBe("laat");
  });
});
