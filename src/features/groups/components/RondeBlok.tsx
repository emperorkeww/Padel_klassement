import { DeletableMatchCard } from "@/features/matches/components/MatchList";
import { PlannedMatchCard } from "@/features/matches/components/PlannedMatchCard";
import { teamLabel } from "@/features/matches/api";
import { displayName } from "@/features/profiles/api";
import { useMatchEffecten } from "@/features/matches/useMatchEffecten";
import { formatTime } from "@/lib/utils/format";
import { rondeWinnaars } from "../dagStatus";
import type { Upset } from "@/features/matches/upset";
import type { Match, Profile, RoastIntensiteit, Team } from "@/types";
import "./RondeBlok.css";

/* ------------------------------------------------------------------ */
/* Eén ronde van een speeldag (#839).                                  */
/*                                                                     */
/* Sinds #1133 niet meer per se vandaag: de speeldagpagina toont met   */
/* dezelfde blokken de rondes van de dag die je uit de agenda opende.  */
/*                                                                     */
/* Twee dingen die het issue los benoemde, maar die in dezelfde lijst  */
/* zitten:                                                             */
/*                                                                     */
/*  1. Afgeronde rondes namen evenveel ruimte in als de ronde waar het */
/*     om gaat. Ze klappen nu dicht tot kop + winnaars; de ronde met   */
/*     openstaande uitslagen staat altijd open.                        */
/*  2. Binnen één ronde stonden twee kaarttalen naast elkaar: een      */
/*     PlannedMatchCard met countdown, winkansbalk en inzet-tegels     */
/*     naast een platte uitslagkaart. Beide zitten nu in hetzelfde     */
/*     frame met dezelfde kopregel (tijd · ronde · status) — de        */
/*     geplande houdt haar diepte, de afgeronde blijft compact.        */
/* ------------------------------------------------------------------ */

/** Gedeeld en leeg: een verse Set per render zou elk kind opnieuw laten
 *  renderen. */
const EMPTY: ReadonlySet<string> = new Set();

export function RondeBlok({
  round,
  list,
  open,
  onToggle,
  teams,
  profiles,
  myId,
  isOwner,
  matches,
  intensiteit,
  upsets,
  onMatches,
  onWissen,
  wisBezig = false,
  afgemeld = EMPTY,
}: {
  round: number;
  list: Match[];
  open: boolean;
  onToggle: () => void;
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  myId: string;
  isOwner: boolean;
  /** Volledige historie: voedt rivaliteit en coach op de geplande kaart. */
  matches: Match[];
  intensiteit: RoastIntensiteit;
  upsets: Map<string, Upset>;
  onMatches: () => void;
  /** Wist de hele ronde (#1271). Weglaten = geen wisknop; de knop verschijnt
   *  alleen bij een ronde zonder uitslagen. */
  onWissen?: () => void;
  wisBezig?: boolean;
  /** Spelers die zich voor deze speeldag afmeldden (#1271). */
  afgemeld?: ReadonlySet<string>;
}) {
  const done = list.filter((m) => m.status === "completed").length;
  const roundDone = done === list.length;
  const titel = round === 0 ? "Losse matches" : `Ronde ${round}`;
  const bodyId = `ronde-${round}-matches`;
  const winnaars = rondeWinnaars(list, (id) => teamLabel(teams[id], profiles));

  // Lef en jokers op de afgeronde kaarten (#981/#1003), plus de effectvlaggen
  // voor de achtergrond (#1151): één bulk-query per soort voor de hele ronde in
  // plaats van een fetch per kaart. De geplande kaarten halen hun eigen
  // (gedeelde, gecachte) inzetten al op voor de kop-pil.
  const extras = useMatchEffecten({ matches: list, teams, profiles, myId });

  // Wie in deze ronde staat maar zich intussen afmeldde. Alleen bij geplande
  // matches: bij een gespeelde ronde is het geen waarschuwing meer maar een
  // feit (#1271).
  const afgemeldHier = [
    ...new Set(
      list
        .filter((m) => m.status === "scheduled")
        .flatMap((m) =>
          [teams[m.team_a_id], teams[m.team_b_id]].flatMap((t) =>
            t ? [t.player1_id, t.player2_id] : [],
          ),
        )
        .filter((id): id is string => !!id && afgemeld.has(id)),
    ),
  ].map((id) => displayName(profiles[id]));

  return (
    <div
      className={`round ${roundDone ? "is-done" : "is-open"}${
        open ? "" : " is-dicht"
      }`}
    >
      <div className="round-head">
        {/* De knop draagt de hele kop als raakvlak (::after), zodat de kop een
            heading blijft in plaats van in een button te verdwijnen. */}
        <button
          type="button"
          className="round-head__toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          aria-label={`${titel} ${open ? "inklappen" : "uitklappen"}`}
          onClick={onToggle}
        >
          <span className="round-head__caret" aria-hidden="true">
            ⌄
          </span>
        </button>
        <h3 className="card__title card__title--compact">{titel}</h3>
        <span
          className={`round-head__progress ${
            roundDone ? "round-head__progress--done" : ""
          }`}
        >
          {roundDone ? "Afgerond" : `${done}/${list.length} uitslagen`}
        </span>
        {/* Een weg terug (#1271). Alleen zolang er nog geen uitslag in staat:
            daarna raakt wissen de stand en de Elo-keten, en dat gaat per match
            met de undo-strook erbij. De bevestiging is een ConfirmDialog en
            geen two-tap: dat laatste is op touch onvoorspelbaar. */}
        {onWissen && done === 0 && round !== 0 && (
          <button
            type="button"
            className="btn btn--sm round-head__wissen"
            disabled={wisBezig}
            onClick={onWissen}
          >
            {wisBezig ? "Bezig…" : "Wissen"}
          </button>
        )}
      </div>

      {/* Ingeklapt vertelt de ronde wat er te weten valt: wie won. */}
      {!open && winnaars && <p className="round__winnaars">🏆 {winnaars}</p>}

      {/* Een late afmelding ging nergens over (#1271): de ja-stemmen werden
          netjes herladen, maar dat veranderde alleen de standaardselectie voor
          de vólgende generatie. De ronde die al klaarstond bleef staan, met
          iemand erin die niet komt. */}
      {afgemeldHier.length > 0 && (
        <p className="round__afgemeld" role="status">
          ⚠ {afgemeldHier.join(", ")}{" "}
          {afgemeldHier.length === 1 ? "heeft" : "hebben"} zich afgemeld
          {onWissen ? " — wis deze ronde en genereer opnieuw." : "."}
        </p>
      )}

      {open && (
        <div className="stack" id={bodyId}>
          {list.map((m) =>
            m.status === "completed" ? (
              // Zelfde frame en kopregel als de geplande kaart ernaast; alleen
              // de staat verschilt, niet de ontwerptaal.
              <div className="ronde-kaart ronde-kaart--klaar" key={m.id}>
                <div className="ronde-kaart__kop">
                  <span className="ronde-kaart__wanneer">
                    {matchWanneer(m)}
                  </span>
                  <span className="ronde-kaart__status">uitslag ✓</span>
                </div>
                <DeletableMatchCard
                  match={m}
                  teams={teams}
                  profiles={profiles}
                  perspectiveId={myId}
                  upset={upsets.get(m.id) ?? null}
                  lef={extras(m).lef}
                  joker={extras(m).joker}
                  canManage={isOwner}
                  onDeleted={onMatches}
                />
              </div>
            ) : (
              <PlannedMatchCard
                key={m.id}
                match={m}
                teams={teams}
                profiles={profiles}
                perspectiveId={myId}
                history={matches}
                intensiteit={intensiteit}
                // De andere banen van deze ronde (#1327): daarmee kan "Spelers
                // wijzigen" twee spelers van baan laten ruilen in plaats van
                // alleen iemand te vervangen.
                rondeMatches={list}
                onSaved={onMatches}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

/** Kopregel van een gespeelde match: "20:00 · ronde 2" — dezelfde volgorde als
 *  de geplande kaart, zodat de twee onder elkaar op één lijn lezen. */
function matchWanneer(m: Match): string {
  return [
    formatTime(m.played_at ?? m.created_at),
    m.round_number != null ? `ronde ${m.round_number}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default RondeBlok;
