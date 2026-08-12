import { pollExpired } from "@/features/groups/pollLogic";
import { dateInZone } from "@/lib/utils/time";
import { wachtOpUitslag } from "@/features/dashboard/dashboardHelpers";
import type { OpenPollBundle } from "@/features/dashboard/dashboardHelpers";
import type { Match } from "@/types";

/* ------------------------------------------------------------------ */
/* Attentiestippen op de vaste navigatie (#1214).                      */
/*                                                                     */
/* De bel telt meldingen; de balk zelf was stil. Wie de app opent op    */
/* Klassement of Clubblad zag niet dat er een stem op hem wachtte of    */
/* dat er een uitslag ontbrak — de stemkaart (#1196) bracht de          */
/* hándeling naar het overzicht, maar niet het signaal.                 */
/*                                                                     */
/* Bewust een stip en geen teller: de bel draagt al de getelde variant, */
/* en twee tellersoorten in dezelfde shell wordt ruis. Zelfde           */
/* signaal-taal, andere korrel.                                         */
/*                                                                     */
/* Pure functies, zodat de regels te toetsen zijn zonder de shell te    */
/* renderen — en zodat "wanneer verdient iets aandacht" op één plek     */
/* staat in plaats van in de JSX van de balk.                           */
/* ------------------------------------------------------------------ */

/**
 * Wacht de agenda op jou?
 *
 * Twee redenen, allebei uit de bundels die het overzicht toch al ophaalt:
 *
 *  1. een lopende poll waarop jij nog niet stemde — dat is letterlijk een stem
 *     die uitstaat;
 *  2. een vastgelegde speeldag vandaag waarop jij "kan" stemde.
 *
 * De ja-stem-eis bij (2) is dezelfde als die van de reminder op het overzicht
 * (`pickPollBanner`): wie zich niet opgaf, speelt niet mee en hoeft er geen
 * stip voor te krijgen.
 */
export function agendaAttentie(
  rijen: OpenPollBundle[],
  myId: string,
  nowMs: number,
): boolean {
  for (const { polls, options, votes } of rijen) {
    const open = polls.filter(
      (p) => p.status === "open" && !pollExpired(p, options, nowMs),
    );
    for (const poll of open) {
      const optieIds = new Set(
        options.filter((o) => o.poll_id === poll.id).map((o) => o.id),
      );
      const gestemd = votes.some(
        (v) => optieIds.has(v.option_id) && v.player_id === myId,
      );
      if (!gestemd) return true;
    }

    const vast = polls.filter(
      (p) =>
        (p.status === "locked" || p.status === "booked") && p.locked_option_id,
    );
    for (const poll of vast) {
      const optie = options.find((o) => o.id === poll.locked_option_id);
      if (!optie) continue;
      // De clubdag van díé poll (#322-snapshot), niet die van de browser.
      if (optie.date !== dateInZone(poll.club_timezone, 0, nowMs)) continue;
      const ikSpeelMee = votes.some(
        (v) =>
          v.option_id === optie.id &&
          v.player_id === myId &&
          v.status === "yes",
      );
      if (ikSpeelMee) return true;
    }
  }
  return false;
}

/**
 * Wacht er een uitslag op jou?
 *
 * Alleen matches waarvan het uur voorbij is — een ronde van volgende week is
 * geen taak, en een stip die er permanent staat is geen signaal meer. Zelfde
 * maatstaf als de matchkaart op het overzicht (#1210).
 */
export function spelenAttentie(matches: Match[], nowMs: number): boolean {
  return matches.some((m) => wachtOpUitslag(m, nowMs));
}
