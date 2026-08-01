import { DeletableMatchCard } from "@/features/matches/components/MatchList";
import { PlannedMatchCard } from "@/features/matches/components/PlannedMatchCard";
import { teamLabel } from "@/features/matches/api";
import { formatTime } from "@/lib/utils/format";
import { rondeWinnaars } from "../dagStatus";
import type { Upset } from "@/features/matches/upset";
import type { Match, Profile, RoastIntensiteit, Team } from "@/types";

/* ------------------------------------------------------------------ */
/* Eén ronde van vandaag (#839).                                       */
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
}) {
  const done = list.filter((m) => m.status === "completed").length;
  const roundDone = done === list.length;
  const titel = round === 0 ? "Losse matches" : `Ronde ${round}`;
  const bodyId = `ronde-${round}-matches`;
  const winnaars = rondeWinnaars(list, (id) => teamLabel(teams[id], profiles));

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
      </div>

      {/* Ingeklapt vertelt de ronde wat er te weten valt: wie won. */}
      {!open && winnaars && <p className="round__winnaars">🏆 {winnaars}</p>}

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
