import type { PollOption, PollVote } from "./pollsApi";
import { nonVoters, tallyOption } from "./pollLogic";
import { shortDay } from "./planPollHelpers";

/* ------------------------------------------------------------------ */
/* Deeltekst van een lopende speeldag-poll (#886). Tegenhanger van     */
/* shareWinner in WinnerCard, die pas bestaat zodra het moment vastligt */
/* — juist tijdens het stemmen wil je de groep porren.                  */
/*                                                                      */
/* Puur: de knop plakt er alleen de deep-link naast en stuurt 'm naar   */
/* het deelvenster.                                                     */
/* ------------------------------------------------------------------ */

/** Zoveel momenten schrijven we uit; de rest wordt geteld. Een poll mag er
 *  vijf hebben (MAX_OPTIONS) en een deelbericht met vijf bullets leest in de
 *  groepschat als een boodschappenlijst. */
const MAX_MOMENTEN = 4;

export interface OpenPollShareOpts {
  groepsnaam: string;
  /** Clubnaam zoals op de poll opgeslagen. */
  clubnaam: string;
  /** Alle momenten van déze poll. */
  options: PollOption[];
  votes: PollVote[];
  /** Player-id's van de groepsleden — bepaalt wie nog moet stemmen. */
  memberIds: string[];
  naam: (playerId: string) => string;
  /** Vandaag in clubtijd (YYYY-MM-DD): verlopen momenten laten we weg. */
  today: string;
}

/**
 * Deeltekst voor de groepschat: waar het over gaat, welke momenten voorliggen
 * met de stand tot nu toe, en wie er nog moet stemmen. Die laatste regel is de
 * hele reden dat je deelt — zonder namen is het een mededeling, met namen een
 * uitnodiging.
 */
export function openPollShareText({
  groepsnaam,
  clubnaam,
  options,
  votes,
  memberIds,
  naam,
  today,
}: OpenPollShareOpts): string {
  // Verlopen momenten staan nog op de kaart maar zijn niet meer stembaar
  // (PollCard: votable = o.date >= today) — ze horen dus niet in een oproep.
  const momenten = options
    .filter((o) => o.date >= today)
    .sort((a, b) =>
      a.date === b.date
        ? a.start_time.localeCompare(b.start_time)
        : a.date.localeCompare(b.date),
    );

  const lines = [`🎾 Padel — ${groepsnaam}`];

  if (momenten.length === 0) {
    lines.push("🗳 De momenten van deze speeldag zijn verlopen.");
    lines.push(`📍 ${clubnaam}`);
    return lines.join("\n");
  }

  lines.push(
    `🗳 Stem mee — ${momenten.length} ${momenten.length === 1 ? "moment" : "momenten"}:`,
  );
  for (const o of momenten.slice(0, MAX_MOMENTEN)) {
    const yes = tallyOption(o, votes).yes.length;
    const stand =
      yes === 0 ? "nog geen ja" : `${yes} ${yes === 1 ? "kan" : "kunnen"}`;
    lines.push(`• ${shortDay(o.date)} · ${o.start_time} — ${stand}`);
  }
  const rest = momenten.length - MAX_MOMENTEN;
  if (rest > 0) {
    lines.push(`• … en nog ${rest} ${rest === 1 ? "moment" : "momenten"}`);
  }

  lines.push(`📍 ${clubnaam}`);

  const wachtend = nonVoters(memberIds, momenten, votes);
  lines.push(
    wachtend.length > 0
      ? `⏳ Nog niet gestemd: ${wachtend.map(naam).join(", ")}`
      : "✅ Iedereen heeft gestemd — het moment wordt zo gekozen.",
  );

  return lines.join("\n");
}
