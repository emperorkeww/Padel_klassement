import { Link } from "react-router-dom";
import { playersOf } from "@/features/rating/results";
import { groupByRound } from "../groupDetailHelpers";
import { dagVoortgang, speeldagStand } from "../dagStatus";
import { pollSharePath } from "../pollsApi";
import type { SpeeldagMoment } from "../speeldagMatches";
import type { Match, Team } from "@/types";

/* ------------------------------------------------------------------ */
/* De speeldag van vandaag, samengevat en doorverwezen (#1209).        */
/*                                                                     */
/* Sinds #1121 heeft een speeldag een eigen pagina, maar de Vandaag-   */
/* tab bleef hem óók beheren: dezelfde generator, dezelfde rondes,     */
/* dezelfde losse partij, op een ander scherm. Twee eigenaars voor één */
/* avond, die bovendien uiteen kunnen lopen — de tab filtert op        */
/* vandaag, de pagina op het vastgelegde moment (#1133/#1146).         */
/*                                                                     */
/* Deze kaart is wat er van de tab overblijft zodra er een vastgelegd  */
/* moment is: waar en hoe laat, hoe ver de avond staat, en de knop     */
/* ernaartoe. Beheren gebeurt op /speeldag/:id.                        */
/*                                                                     */
/* Eén kaart per moment: twee sessies op één dag (#1146) zijn twee     */
/* avonden met een eigen indeling, dus ook twee bestemmingen.          */
/* ------------------------------------------------------------------ */

export function SpeeldagVerwijzing({
  moment,
  matches,
  teams,
}: {
  moment: SpeeldagMoment;
  /** De wedstrijden van dít moment (matchesVoorSpeeldag deed de verdeling). */
  matches: Match[];
  teams: Record<string, Team>;
}) {
  const voortgang = dagVoortgang(groupByRound(matches));
  const spelers = aantalSpelers(matches, teams);

  // Het spelersaantal komt uit de indeling, niet uit de ja-stemmen: de
  // groepspagina laadt die stemmen niet, en wie er straks écht op de baan
  // staat blijkt toch pas uit de wedstrijden. Zolang er niets ingedeeld is
  // blijft de bijzin dus alleen over de stand gaan.
  const regel = [
    spelers > 0 ? `${spelers} spelers` : null,
    speeldagStand(voortgang),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="card" aria-labelledby={`speeldag-${moment.option.id}`}>
      <div className="card__head">
        <h2
          className="card__title card__title--tight"
          id={`speeldag-${moment.option.id}`}
        >
          Speeldag om {moment.option.start_time}
        </h2>
      </div>
      <p className="card__subtitle">{regel}</p>
      <Link
        className="btn btn--sm btn--primary"
        to={pollSharePath(moment.option.poll_id)}
      >
        Beheer deze speeldag →
      </Link>
    </section>
  );
}

/** Hoeveel verschillende spelers er vanavond aan een wedstrijd meedoen. */
function aantalSpelers(matches: Match[], teams: Record<string, Team>): number {
  const ids = new Set<string>();
  for (const m of matches) {
    for (const teamId of [m.team_a_id, m.team_b_id]) {
      for (const pid of playersOf(teams[teamId])) ids.add(pid);
    }
  }
  return ids.size;
}

export default SpeeldagVerwijzing;
