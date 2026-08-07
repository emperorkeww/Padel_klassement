// Welke wedstrijden horen bij één speeldag (#1133)?
//
// Een match heeft geen `poll_id`; die koppeling bestaat niet in het datamodel.
// De afleiding is dezelfde die GroupDetail al maakt voor de Spelen-tab — "valt
// deze match op de clubdag van vandaag" — maar dan op de datum van de speeldag
// in plaats van op vandaag. Zo ziet de pagina waarop je de rondes klaarzette ze
// ook meteen staan, ook als die dag nog moet komen of al geweest is.
//
// Twee bekende en aanvaarde onnauwkeurigheden:
//  - een losse partij op dezelfde dag telt mee. Dat is gewenst: precies zoals
//    in de Spelen-tab hoort die bij de avond.
//  - twee speeldagen op één kalenderdag (ochtend + avond) delen dezelfde lijst.
//    Zeldzaam, en de vorm ("de wedstrijden van die dag") blijft waar.

import { dayInZone } from "@/lib/utils/time";
import type { Match } from "@/types";
import type { PlayPoll, PollOption } from "./pollsApi";

export type SpeeldagMoment = {
  /** Kalenderdag in clubtijd, YYYY-MM-DD. */
  dag: string;
  /** Het vastgelegde moment zelf — draagt ook de starttijd en de duur. */
  option: PollOption;
  /** Tijdzone van de club waarvoor deze poll is aangemaakt (#322-snapshot). */
  tz: string;
};

/**
 * Het vastgelegde moment van een speeldag, of null zolang er niets vastligt.
 *
 * Een geannuleerde speeldag telt niet mee: daar hoort geen wedstrijdenblok bij,
 * ook al staat het gekozen moment nog in de rij. Een `locked` poll wél — de
 * datum ligt dan vast en er kunnen al rondes voor klaarstaan.
 */
export function speeldagMoment(
  poll: PlayPoll,
  options: PollOption[],
): SpeeldagMoment | null {
  if (poll.status !== "locked" && poll.status !== "booked") return null;
  if (!poll.locked_option_id) return null;
  const option = options.find((o) => o.id === poll.locked_option_id);
  if (!option) return null;
  return { dag: option.date, option, tz: poll.club_timezone };
}

/**
 * De wedstrijden die op die kalenderdag vallen. `played_at` is de bron zodra
 * hij er is (#827 geeft gegenereerde rondes de echte starttijd mee); zonder
 * tijdstip valt het terug op het moment van aanmaken, net als overal elders.
 */
export function matchesVoorSpeeldag(
  matches: Match[],
  dag: string,
  tz: string,
): Match[] {
  return matches.filter(
    (m) => dayInZone(m.played_at ?? m.created_at, tz) === dag,
  );
}
