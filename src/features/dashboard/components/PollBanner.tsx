import { Link } from "react-router-dom";
import { courtsLabel } from "@/features/groups/planPollHelpers";
import { pollSharePath } from "@/features/groups/pollsApi";
import { pickPollBanner, pollDay, type OpenPollBundle } from "../dashboardHelpers";

// Speeldag op het overzicht: een lopende poll om op te stemmen, of de
// vastgelegde/geboekte datum als reminder bij het inloggen. Uit Dashboard.tsx
// gelicht (#736); welke poll wint staat in pickPollBanner.

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

  if (pick.kind === "open") {
    return (
      <section className="card poll-banner">
        <div className="card__head">
          <h2 className="card__title card__title--tight">
            📆 Speeldag-poll loopt · {pick.group.name}
          </h2>
        </div>
        <p className="poll-banner__text">
          {pick.optionCount === 1
            ? "Eén moment staat open"
            : `${pick.optionCount} momenten staan open`}
          {" · "}
          {pick.voterCount === 0
            ? "nog niemand stemde"
            : `${pick.voterCount} ${pick.voterCount === 1 ? "lid" : "leden"} stemden al`}
          {pick.iVoted ? "." : " — jij nog niet."}
        </p>
        <Link
          className={`btn btn--sm${pick.iVoted ? "" : " btn--primary"}`}
          to={pollSharePath(pick.pollId)}
        >
          {pick.iVoted ? "Bekijk de poll →" : "Stem nu →"}
        </Link>
      </section>
    );
  }

  return (
    <section className="card poll-banner poll-banner--fixed">
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
