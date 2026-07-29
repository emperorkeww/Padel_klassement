import type { Match } from "@/types";
import { pollOptions } from "./pollLogic";
import type { PlayPoll, PollOption, PollVote } from "./pollsApi";

// Pure logica voor de fase-gedreven Plannen-tab (#349): welke fase de tab
// toont, of er al wedstrijdrondes voor een geboekte poll bestaan en welke
// poll de focus krijgt. Getest in planFlowLogic.test.ts.

/** De reis van een speeldag over de hele tab: Stemmen → Gekozen → Geboekt → Klaar. */
export type PlanPhase = "stemmen" | "gekozen" | "geboekt" | "klaar";

/** Volgorde + labels van de fasebalk (labels zijn geen exacte kopie van de
 *  statusnamen: "Stemmen" staat als stap-label alleen in de fasebalk). */
export const PLAN_PHASES: PlanPhase[] = ["stemmen", "gekozen", "geboekt", "klaar"];

/** Het gekozen moment van een gelockte/geboekte poll; null zolang de poll open is. */
export function lockedOptionOf(
  poll: PlayPoll,
  options: PollOption[],
): PollOption | null {
  if (!poll.locked_option_id) return null;
  return options.find((o) => o.id === poll.locked_option_id) ?? null;
}

/**
 * Zijn er al wedstrijdrondes klaargezet voor deze geboekte speeldag?
 * Zonder datamodel-wijziging afgeleid uit de matches van de groep: rondes
 * (round_number > 0) die ná het boeken zijn aangemaakt horen bij de speeldag.
 * Bekende imprecisie: een losse ronde tussen boeken en spelen telt ook mee —
 * onschuldig, want de boodschap ("wedstrijden staan klaar") blijft waar.
 */
export function roundsExistFor(poll: PlayPoll, matches: Match[]): boolean {
  return roundsMadeFor(poll, matches) > 0;
}

/**
 * Hoeveel rondes er voor deze speeldag al klaarstaan — zelfde afleiding als
 * {@link roundsExistFor}, maar geteld. Het vertrekpunt voor de starttijden van
 * de volgende rondes (#827): ronde N begint tien minuten na ronde N-1.
 */
export function roundsMadeFor(poll: PlayPoll, matches: Match[]): number {
  if (poll.status !== "booked" || !poll.booked_at) return 0;
  const bookedAt = poll.booked_at;
  const rondes = new Set<number>();
  for (const m of matches) {
    if ((m.round_number ?? 0) > 0 && m.created_at >= bookedAt) {
      rondes.add(m.round_number as number);
    }
  }
  return rondes.size;
}

/** Fase van één poll; `roundsExist` komt uit roundsExistFor (of lokale staat). */
export function pollPhase(poll: PlayPoll, roundsExist: boolean): PlanPhase {
  if (poll.status === "open") return "stemmen";
  if (poll.status === "locked") return "gekozen";
  return roundsExist ? "klaar" : "geboekt";
}

/**
 * Welke actieve poll krijgt de focus (groot in beeld)? `active` is de
 * soonest-first uitvoer van activePolls.
 * 0. Een gedeelde link (#675) wint van alles: wie op "kijk, vrijdag" tikt hoort
 *    díé speeldag te zien, niet degene die de app zelf zou kiezen.
 * 1. De speeldag van vandaag zelf (rondes zetten/laatste check).
 * 2. Anders de eerste poll waar nog actie nodig is (stemmen, kiezen of boeken).
 * 3. Anders de eerstvolgende volledig geboekte speeldag.
 *
 * `preferId` valt stil terug op de normale keuze als de poll niet (meer)
 * actief is — verlopen, geannuleerd of uit een andere groep. Een oude link
 * hoort de tab niet leeg of stuk te laten lijken.
 */
/**
 * De twee secties van de Plannen-tab (#721): wat al vastligt en waarop nog
 * gestemd wordt. Vóór deze splitsing stonden beide door elkaar in één stroom
 * met één poll in focus — waardoor een al geboekte speeldag onder een verse
 * poll verdween, terwijl "wanneer spelen we?" nu net de vraag is die iedereen
 * op deze tab komt stellen. `active` is de soonest-first uitvoer van
 * activePolls, dus beide lijsten blijven chronologisch.
 */
export function splitPolls(active: PlayPoll[]): {
  vastgelegd: PlayPoll[];
  stemmen: PlayPoll[];
} {
  return {
    vastgelegd: active.filter(
      (p) => p.status === "locked" || p.status === "booked",
    ),
    stemmen: active.filter((p) => p.status === "open"),
  };
}

/**
 * Heeft deze speler al op minstens één moment van de poll gestemd? Voedt het
 * "jij moet nog stemmen"-signaal per poll: met meerdere polls naast elkaar
 * (#267) is dat het enige wat je echt uit elkaar moet kunnen houden.
 */
export function heeftGestemd(
  poll: PlayPoll,
  options: PollOption[],
  votes: PollVote[],
  playerId: string,
): boolean {
  const eigen = new Set(pollOptions(poll, options).map((o) => o.id));
  return votes.some((v) => v.player_id === playerId && eigen.has(v.option_id));
}

export function focusPoll(
  active: PlayPoll[],
  options: PollOption[],
  today: string,
  preferId?: string | null,
): PlayPoll | null {
  if (preferId) {
    const gevraagd = active.find((p) => p.id === preferId);
    if (gevraagd) return gevraagd;
  }
  const todaysPoll = active.find(
    (p) => lockedOptionOf(p, options)?.date === today,
  );
  if (todaysPoll) return todaysPoll;
  return active.find((p) => p.status !== "booked") ?? active[0] ?? null;
}
