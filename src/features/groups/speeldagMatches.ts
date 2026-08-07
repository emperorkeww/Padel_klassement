// Welke wedstrijden horen bij één speeldag (#1133)?
//
// Een match heeft geen `poll_id`; die koppeling bestaat niet in het datamodel.
// De afleiding is dezelfde die GroupDetail al maakt voor de Spelen-tab — "valt
// deze match op de clubdag van vandaag" — maar dan op de datum van de speeldag
// in plaats van op vandaag. Zo ziet de pagina waarop je de rondes klaarzette ze
// ook meteen staan, ook als die dag nog moet komen of al geweest is.
//
// Sinds #1146 is de kalenderdag niet meer het laatste woord. Een groep kan er
// twee op één datum hebben — een ochtendsessie en een avondsessie — en dan
// toonden beide pagina's elkaars wedstrijden. Gegenereerde rondes dragen sinds
// #827 de echte starttijd, dus een match hoort bij het moment waar hij het
// dichtst bij ligt. Met één speeldag per dag verandert dat niets.
//
// Blijft gewenst: een losse partij op dezelfde avond telt mee, precies zoals
// in de Spelen-tab.

import { clubEpoch, dayInZone } from "@/lib/utils/time";
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
 * De vastgelegde momenten van álle speeldagen op één kalenderdag, op tijd
 * gesorteerd. Meestal is dat er precies één; twee (ochtend + avond) is de reden
 * dat deze functie bestaat.
 */
export function momentenOpDag(
  polls: PlayPoll[],
  options: PollOption[],
  dag: string,
): SpeeldagMoment[] {
  return polls
    .map((p) => speeldagMoment(p, options))
    .filter((m): m is SpeeldagMoment => m != null && m.dag === dag)
    .sort((a, b) => a.option.start_time.localeCompare(b.option.start_time));
}

/** Het moment van een speeldag als echt tijdstip (ms), DST-proof. */
function startVan(moment: SpeeldagMoment): number {
  return clubEpoch(moment.option.date, moment.option.start_time, moment.tz);
}

/**
 * De wedstrijden die bij dit moment horen. `played_at` is de bron zodra hij er
 * is (#827 geeft gegenereerde rondes de echte starttijd mee); zonder tijdstip
 * valt het terug op het moment van aanmaken, net als overal elders.
 *
 * `andere` zijn de overige momenten van diezelfde dag. Staat daar niets in —
 * het normale geval — dan is dit gewoon "alles van die kalenderdag". Anders
 * wint het dichtstbijzijnde moment: een match om 10:30 hoort bij de sessie van
 * 10:00 en niet bij die van 20:00.
 */
export function matchesVoorSpeeldag(
  matches: Match[],
  moment: SpeeldagMoment,
  andere: SpeeldagMoment[] = [],
): Match[] {
  const { dag, tz } = moment;
  const opDeDag = matches.filter(
    (m) => dayInZone(m.played_at ?? m.created_at, tz) === dag,
  );
  const concurrenten = andere.filter((m) => m.option.id !== moment.option.id);
  if (concurrenten.length === 0) return opDeDag;

  const mijn = startVan(moment);
  const rest = concurrenten.map(startVan);
  return opDeDag.filter((m) => {
    const t = new Date(m.played_at ?? m.created_at).getTime();
    const afstand = Math.abs(t - mijn);
    // Precies middenin tussen twee momenten (praktisch onmogelijk, maar het
    // kán): dan verschijnt hij op allebei. Liever twee keer zichtbaar dan
    // nergens.
    return rest.every((ander) => afstand <= Math.abs(t - ander));
  });
}
