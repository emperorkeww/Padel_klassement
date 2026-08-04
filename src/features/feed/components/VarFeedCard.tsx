import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useFluit } from "@/lib/hooks/useFluit";
import { displayName } from "@/features/profiles/api";
import { REDENEN } from "@/features/matches/appeal";
import { varUitspraak, type VarUitkomst } from "@/features/coach/varUitspraak";
import type { RoastCtx } from "@/features/coach/roastTone";
import type { FeedEvent } from "@/features/feed/feedLogic";
import type { Profile } from "@/types";
import "./VarFeedCard.css";

/**
 * Rudy's VAR in de feed (#1025): de uitspraak over een betwist punt.
 *
 * Eigen kaart en geen gewone feedregel, want er zit een verhaal in: wie
 * betwistte wat, wat het met de stand deed, en wat Rudy ervan vindt. Draait een
 * toekenning de winnaar van de match om, dan staat dat er met zoveel woorden —
 * dat mag nooit stilletjes gebeuren.
 *
 * Het fluitsignaal klinkt hooguit één keer per zaak (useFluit dedupliceert op
 * de zaak-id) en alleen als de browser het toestaat; de tekst blijft de drager.
 */
export function VarFeedCard({
  event,
  profiles,
  ctx,
  gebruikt,
}: {
  event: Extract<FeedEvent, { kind: "var" }>;
  profiles: Record<string, Profile>;
  /** Roast-toon van de groep + het schild van de klager. */
  ctx: RoastCtx;
  /** Gedeelde set binnen één feed-weergave, tegen herhaalde quips. */
  gebruikt?: Set<string>;
}) {
  const { fluit } = useFluit();
  useEffect(() => {
    fluit(event.appealId);
  }, [event.appealId, fluit]);

  const claimant = profiles[event.claimantId];
  const naam = claimant ? displayName(claimant) : "Een speler";
  const reden =
    REDENEN.find((r) => r.id === event.reden)?.label ?? event.reden;
  const uitspraak = varUitspraak({
    appealId: event.appealId,
    status: event.status as VarUitkomst,
    winnaarDraaitOm: event.winnaarDraaitOm,
    ctx,
    gebruikt,
  });

  const na = event.match
    ? [event.match.score_a, event.match.score_b]
    : [null, null];
  const gecorrigeerd = event.status === "toegekend";

  return (
    <article className="varfeed" aria-label="VAR-uitspraak">
      <header className="varfeed__head">
        <span className="varfeed__kop">
          <span aria-hidden="true">📺</span> VAR
        </span>
        <span className={`varfeed__status is-${event.status}`}>
          {event.status === "toegekend"
            ? "toegekend"
            : event.status === "afgewezen"
              ? "afgewezen"
              : event.status === "verlopen"
                ? "vervallen"
                : "tegoed op"}
        </span>
      </header>

      <p className="varfeed__claim">
        <strong>{naam}</strong> betwistte één punt: {reden}
        {event.setNumber != null && ` (set ${event.setNumber})`}.
        {event.toelichting && <em> “{event.toelichting}”</em>}
      </p>

      {gecorrigeerd && na[0] != null && na[1] != null && (
        <p className="varfeed__score">
          <span className="varfeed__score-oud">
            {event.snapshotA} – {event.snapshotB}
          </span>
          <span aria-hidden="true"> ▸ </span>
          <span className="varfeed__score-nieuw">
            {na[0]} – {na[1]}
          </span>
        </p>
      )}

      {/* Zonder deze regel zou een omgedraaide uitslag in de historie
          verschijnen alsof hij er altijd zo stond. */}
      {event.winnaarDraaitOm && (
        <p className="varfeed__omdraai">
          ⚠️ Hierdoor draaide de winnaar van de match om.
        </p>
      )}

      <p className="varfeed__rudy">
        <span aria-hidden="true">🎙️</span> {uitspraak}
      </p>

      <Link className="varfeed__link" to={`/matches/${event.matchId}`}>
        Naar de match →
      </Link>
    </article>
  );
}

export default VarFeedCard;
