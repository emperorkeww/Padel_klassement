import { describe, it, expect } from "vitest";
import { speeldagIcs, type SpeeldagAgenda } from "./speeldagIcs";

const NU = new Date("2026-07-20T10:00:00.000Z");

const speeldag: SpeeldagAgenda = {
  pollId: "poll-1",
  groupName: "Vrijdagavond padel",
  clubName: "LAGO CLUB Padel Beveren",
  date: "2026-08-07",
  startTime: "20:00",
  duration: 90,
  courts: "3",
  accessCode: "1234",
  changedAt: "2026-07-15T18:30:00.000Z",
};

describe("speeldagIcs", () => {
  it("bouwt het event met groep, club, banen en code", () => {
    const lines = speeldagIcs(speeldag, "CONFIRMED", NU).split("\r\n");
    expect(lines).toContain("SUMMARY:Padel: Vrijdagavond padel");
    expect(lines).toContain("LOCATION:LAGO CLUB Padel Beveren");
    expect(lines).toContain("UID:speeldag-poll-1@vamos-padel");
    expect(lines).toContain("STATUS:CONFIRMED");
    expect(
      lines.find((l) => l.startsWith("DESCRIPTION:")),
    ).toContain("Toegangscode 1234");
  });

  it("hangt de SEQUENCE aan de laatste wijziging van de speeldag", () => {
    const eerder = speeldagIcs(speeldag, "CONFIRMED", NU);
    const later = speeldagIcs(
      { ...speeldag, changedAt: "2026-07-16T18:30:00.000Z" },
      "CONFIRMED",
      NU,
    );
    const seq = (ics: string) =>
      Number(/SEQUENCE:(\d+)/.exec(ics)?.[1] ?? NaN);
    expect(seq(later)).toBeGreaterThan(seq(eerder));
    // Onveranderd is onveranderd: twee downloads geven exact hetzelfde bestand.
    expect(speeldagIcs(speeldag, "CONFIRMED", NU)).toBe(eerder);
  });

  /* De kern van de reparatie: een annulering moet de agenda-app overtuigen
     dat dit nieuwer is dan wat ze al heeft. Gelijke SEQUENCE = genegeerd. */
  it("geeft de annulering dezelfde UID maar een hogere SEQUENCE", () => {
    const bevestigd = speeldagIcs(speeldag, "CONFIRMED", NU);
    const geannuleerd = speeldagIcs(speeldag, "CANCELLED", NU);
    const seq = (ics: string) =>
      Number(/SEQUENCE:(\d+)/.exec(ics)?.[1] ?? NaN);

    expect(geannuleerd).toContain("UID:speeldag-poll-1@vamos-padel");
    expect(geannuleerd).toContain("STATUS:CANCELLED");
    expect(seq(geannuleerd)).toBeGreaterThan(seq(bevestigd));
    // Ook het tijdstip blijft hetzelfde, zodat een client die op meer dan de
    // UID matcht de afspraak nog steeds herkent.
    expect(geannuleerd).toContain("DTSTART;TZID=Europe/Brussels:20260807T200000");
  });

  it("laat weg wat er niet is: geen banen, geen code", () => {
    const ics = speeldagIcs(
      { ...speeldag, courts: null, accessCode: null },
      "CONFIRMED",
      NU,
    );
    expect(ics).toContain("DESCRIPTION:Vrijdagavond padel\r\n");
    expect(ics).not.toContain("Toegangscode");
  });
});
