import { Link } from "react-router-dom";
import { courtsLabel } from "@/features/groups/planPollHelpers";
import { pollSharePath } from "@/features/groups/pollsApi";
import { pickPollBanner, pollDay, type OpenPollBundle } from "../dashboardHelpers";
import { PollCourtWatermark } from "./DashboardWatermarks";

// De vastgelegde of geboekte speeldag als reminder bij het inloggen, met de
// banen en de toegangscode op de dag zelf. Uit Dashboard.tsx gelicht (#736);
// welke poll wint staat in pickPollBanner.
//
// Stemmen op een lopende poll stond hier tot #1196 ook, als "Stem nu"-link.
// Dat is nu StemKaart: die laat je ter plekke antwoorden in plaats van je door
// te sturen. De twee kunnen naast elkaar staan — de ene vraagt iets, de andere
// herinnert ergens aan.

export function PollBanner({
  bundles,
  myId,
  now = Date.now(),
}: {
  bundles: OpenPollBundle[];
  myId: string;
  now?: number;
}) {
  const pick = pickPollBanner(bundles, myId, now);
  if (!pick) return null;

  return (
    <section className="card poll-banner poll-banner--fixed">
      <PollCourtWatermark />
      <div className="card__head">
        <h2 className="card__title card__title--tight">
          🎾 Speeldag {pick.booked ? "geboekt" : "gekozen"} · {pick.group.name}
        </h2>
      </div>
      <p className="poll-banner__text">
        Jullie spelen {pollDay(pick.date)} om {pick.startTime}
        {pick.booked ? " — baan geboekt ✓" : " — baan nog te boeken."}
      </p>
      {/* Banen (#802) en toegangscode (#675) alleen op de speeldag zelf: dan
          open je het overzicht juist hiervoor. pickPollBanner bewaakt die
          dagkeuze. */}
      {(pick.courts != null || pick.accessCode != null) && (
        <p className="poll-banner__code">
          {pick.courts != null && (
            <>
              🎾{" "}
              <strong className="poll-banner__court">
                {courtsLabel(pick.courts)}
              </strong>
            </>
          )}
          {pick.courts != null && pick.accessCode != null && " · "}
          {pick.accessCode != null && (
            <>
              🔑 Toegangscode velden: <strong>{pick.accessCode}</strong>
            </>
          )}
        </p>
      )}
      <Link
        className={`btn btn--sm${pick.booked ? "" : " btn--primary"}`}
        to={pollSharePath(pick.pollId)}
      >
        {pick.booked ? "Bekijk →" : "Regel de baan →"}
      </Link>
    </section>
  );
}

export default PollBanner;
