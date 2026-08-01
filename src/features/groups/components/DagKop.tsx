import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { formatTime } from "@/lib/utils/format";
import { displayName } from "@/features/profiles/api";
import { automaatStatus, dagVoortgang, type Automaat } from "../dagStatus";
import { longDay } from "../planPollHelpers";
import type { PlayPoll, PollOption } from "../pollsApi";
import type { Match, Profile } from "@/types";
import "./DagKop.css";

/* ------------------------------------------------------------------ */
/* Dagkop van de Vandaag-tab (#839): één blok dat de hele speeldag     */
/* samenvat, boven de losse blokken die er al stonden.                 */
/*                                                                     */
/* Lost drie dingen tegelijk op die los van elkaar in het issue        */
/* stonden, maar dezelfde oorzaak hadden — er was geen niveau bóven de */
/* kaarten:                                                            */
/*                                                                     */
/*  1. Voortgang stond alleen per ronde ("2/4 uitslagen"), nooit voor  */
/*     de avond als geheel. DayStats telde wel mee, maar stond ónder   */
/*     de wedstrijden en rendert niets op een lege dag.                */
/*  2. De deelknop stond op twee plekken: in de kop van Wedstrijden    */
/*     en, zodra alles ingevuld was, in de afsluitkaart erboven.       */
/*     Dezelfde actie die verhuist zodra de dag afloopt.               */
/*  3. De automaat (#827/#846) was onzichtbaar. Stond er 's ochtends   */
/*     niets, dan was niet te zien of hij uit stond, nog moest komen,  */
/*     of dat iets hem tegenhield.                                     */
/* ------------------------------------------------------------------ */

export function DagKop({
  groupId,
  group,
  polls,
  pollOptions,
  rounds,
  profiles,
  today,
  timezone,
  dayDone,
  share,
  onShowStand,
}: {
  groupId: string;
  group: { auto_rondes?: boolean };
  polls: PlayPoll[];
  pollOptions: PollOption[];
  /** Rondes van vandaag, zoals de tab ze ook aan de wedstrijdenlijst geeft. */
  rounds: { round: number; list: Match[] }[];
  profiles: Record<string, Profile>;
  today: string;
  timezone: string;
  dayDone: boolean;
  /** De deelposter; woont sinds #839 alleen hier. */
  share: ReactNode;
  onShowStand: () => void;
}) {
  const v = dagVoortgang(rounds);

  // Wie de eerste ronde van vandaag aanmaakte: alleen nodig als blijkt dat de
  // automaat er niet aan te pas kwam.
  const eersteRonde = rounds.find((r) => r.round > 0)?.list[0] ?? null;

  const automaat = automaatStatus({
    polls,
    options: pollOptions,
    today,
    timezone,
    autoRondes: group.auto_rondes ?? true,
    rondes: v.rondes,
    doorId: eersteRonde?.created_by ?? null,
  });

  const pct = v.totaal > 0 ? Math.round((v.gespeeld / v.totaal) * 100) : 0;

  return (
    <section
      className={`card dagkop${dayDone ? " dagkop--done" : ""}`}
      aria-labelledby="dagkop-title"
    >
      <div className="card__head">
        <h2 className="card__title card__title--tight" id="dagkop-title">
          Vandaag · {longDay(today)}
        </h2>
        {/* Eén vaste plek voor de deelposter, ook als de dag afloopt. */}
        {v.totaal > 0 && share}
      </div>

      <p className="dagkop__line">{voortgangZin(v, dayDone)}</p>

      {v.totaal > 0 && (
        <div
          className="dagkop__bar"
          role="img"
          aria-label={`${v.gespeeld} van ${v.totaal} uitslagen ingevuld`}
        >
          <span className="dagkop__bar-fill" style={{ width: `${pct}%` }} />
        </div>
      )}

      {automaat && (
        <p className="dagkop__automaat">
          <AutomaatChip
            automaat={automaat}
            profiles={profiles}
            groupId={groupId}
          />
        </p>
      )}

      {dayDone && (
        <div className="dagkop__actions">
          <button className="btn btn--sm btn--primary" onClick={onShowStand}>
            Bekijk de stand →
          </button>
        </div>
      )}
    </section>
  );
}

/** Eén regel die zegt hoe ver de avond staat — of wat de eerste stap is. */
function voortgangZin(
  v: ReturnType<typeof dagVoortgang>,
  dayDone: boolean,
): string {
  if (v.totaal === 0) {
    return "Nog niets ingedeeld. Deel hieronder de teams in — of log een partij die je los speelde.";
  }
  if (dayDone) {
    return `🏁 Alle ${v.totaal} uitslagen staan erin — mooi gespeeld!`;
  }
  const stand = `${v.gespeeld} van ${v.totaal} uitslagen binnen`;
  if (v.openRonde == null) return stand;
  // "Ronde 2 van 3" alleen als dat klopt; bij losse nummering (bv. een ronde
  // verwijderd) zou "ronde 4 van 3" onzin zijn.
  const van = v.openRonde <= v.rondes ? ` van ${v.rondes}` : "";
  return `Ronde ${v.openRonde}${van} loopt · ${stand}`;
}

/** Waar de indeling van vandaag vandaan komt, als één pil. */
function AutomaatChip({
  automaat,
  profiles,
  groupId,
}: {
  automaat: NonNullable<Automaat>;
  profiles: Record<string, Profile>;
  groupId: string;
}) {
  switch (automaat.soort) {
    case "klaargezet":
      return (
        <span className="dagkop__chip dagkop__chip--auto">
          🤖 automatisch klaargezet om {formatTime(automaat.tijdstip)}
        </span>
      );
    case "handmatig":
      return (
        <span className="dagkop__chip">
          ✋{" "}
          {automaat.doorId && profiles[automaat.doorId]
            ? `door ${displayName(profiles[automaat.doorId])} ingedeeld`
            : "handmatig ingedeeld"}
        </span>
      );
    case "komt":
      return (
        <span className="dagkop__chip dagkop__chip--wacht">
          🤖 de automaat deelt om {automaat.uur} zelf in
        </span>
      );
    case "wacht":
      return (
        <span className="dagkop__chip dagkop__chip--wacht">
          🤖 de automaat wacht op de baanboeking
        </span>
      );
    case "overgeslagen":
      return (
        <span className="dagkop__chip dagkop__chip--let-op">
          🤖 de automaat deelde niets in — deel zelf in
        </span>
      );
    case "uit":
      return (
        <span className="dagkop__chip dagkop__chip--let-op">
          ✋ de automaat staat uit ·{" "}
          <Link to={`/groepen/${groupId}?tab=leden`}>aanzetten bij Leden</Link>
        </span>
      );
  }
}

export default DagKop;
