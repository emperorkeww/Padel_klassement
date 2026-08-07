import { useState } from "react";
import { Link } from "react-router-dom";
import { useAsync } from "@/lib/hooks/useAsync";
import { formatDate } from "@/lib/utils/format";
import { readSetScores, teamLabel } from "@/features/matches/api";
import { getGroup } from "@/features/groups/api";
import { heeftUitslag } from "@/features/matches/matchState";
import { MatchMomenten } from "@/features/matches/components/MatchMomenten";
import { ScoreEditor } from "@/features/matches/components/ScoreEditor";
import { TeamBlock } from "@/features/matches/components/TeamBlock";
import type { Highlight } from "@/features/feed/feedLogic";
import type { Upset } from "@/features/matches/upset";
import type { TierBand } from "@/features/rating/tiers";
import type { Match, Profile, RatingPoint, Team } from "@/types";

/**
 * Het scorebord van het matchdetail: de metaregel, de twee teams met de score
 * ertussen, de bijzondere momenten, de set-stand en — voor wie mag — de
 * correctie-invoer.
 *
 * Uitgesneden uit MatchDetail in #1144; markup en gedrag ongewijzigd. Het
 * scorebord ís de kop van de pagina, vandaar dat de h1 er (screenreader-only)
 * boven staat in de pagina zelf.
 */
export function MatchScorebord({
  match: m,
  teams,
  profiles,
  histories,
  derby,
  upset,
  scoreHi,
  canEdit,
  benIkInvoerder,
  invoerderNaam,
  onSaved,
}: {
  match: Match;
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  histories: Record<string, RatingPoint[]>;
  derby: TierBand | null;
  upset: Upset | null;
  scoreHi: Highlight | null;
  /** Mag de kijker de uitslag corrigeren? (aanmaker of groepseigenaar, #978) */
  canEdit: boolean;
  /** Voerde de kijker deze uitslag zelf in? Bepaalt alleen de uitlegzin. */
  benIkInvoerder: boolean;
  invoerderNaam: string;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);

  const teamA = teams[m.team_a_id];
  const teamB = teams[m.team_b_id];
  const done = m.status === "completed";
  const aWon = m.winner_team_id === m.team_a_id;
  const bWon = m.winner_team_id === m.team_b_id;
  const isDraw = done && m.winner_team_id === null;
  // Per-set uitslag (optioneel), als paren zodat elke set zijn winnaar kan tonen.
  const setPairs = readSetScores(m);

  return (
    <section className="card md-board">
      <div className="md-hero">
        {/* Kalme metaregel: status · datum · ronde · groep. */}
        <div className="md-meta">
          <span className={`md-meta__status ${done ? "" : "is-open"}`}>
            {done ? "Afgerond" : "Gepland"}
          </span>
          <span className="md-meta__sep" aria-hidden="true">
            ·
          </span>
          <span>{formatDate(m.played_at ?? m.created_at) || "—"}</span>
          {m.round_number != null && (
            <>
              <span className="md-meta__sep" aria-hidden="true">
                ·
              </span>
              <span>Ronde {m.round_number}</span>
            </>
          )}
          {m.format === "1v1" && (
            <>
              <span className="md-meta__sep" aria-hidden="true">
                ·
              </span>
              <span title="Singles">1v1</span>
            </>
          )}
          <GroupBadge groupId={m.group_id} />
        </div>

        {/* `is-done` schakelt de teamkleuren uit zodra er een uitslag is
            (#948): op een gespeelde match hoort de kleur de úitslag te
            dragen, niet de kant. Zolang er niets gespeeld is identificeren
            de tinten juist wél de twee teams. */}
        <div className={`md-versus${done ? " is-done" : ""}`}>
          <TeamBlock
            team={teamA}
            side="a"
            label={teamLabel(teamA, profiles)}
            profiles={profiles}
            won={done && aWon}
            histories={histories}
            matchId={m.id}
          />
          <div className="md-score">
            {heeftUitslag(m) ? (
              <span className="md-score__num">
                {/* Het winnende cijfer kleurt mee: wie won zie je in de score zelf. */}
                <span className={done && aWon ? "is-winside" : ""}>
                  {m.score_a}
                </span>
                <span className="md-score__dash">–</span>
                <span className={done && bWon ? "is-winside" : ""}>
                  {m.score_b}
                </span>
              </span>
            ) : (
              <span className="md-score__vs">vs</span>
            )}
            {done && !isDraw && heeftUitslag(m) && (
              <span className="md-score__note">eindstand</span>
            )}
          </div>
          <TeamBlock
            team={teamB}
            side="b"
            label={teamLabel(teamB, profiles)}
            profiles={profiles}
            won={done && bWon}
            histories={histories}
            matchId={m.id}
          />
        </div>

        <MatchMomenten
          derby={derby}
          upset={upset}
          scoreHi={scoreHi}
          isDraw={isDraw}
        />

        {setPairs && (
          <div className="md-sets">
            <span className="md-sets__label">Sets</span>
            {setPairs.map(([a, b], i) => (
              <span key={i} className="md-sets__chip">
                <span className={a > b ? "is-winside" : ""}>{a}</span>-
                <span className={b > a ? "is-winside" : ""}>{b}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Wie mag corrigeren, en waarom (#915)? Zonder deze regel las het
          ontbreken van de knop als een bug in plaats van als een regel. */}
      {done && (
        <div className="md-board__foot">
          {canEdit ? (
            <>
              {!editing && (
                <div className="md-edit-actions">
                  <button
                    className="btn btn--sm"
                    onClick={() => setEditing(true)}
                  >
                    {m.score_a != null ? "Score aanpassen" : "Score invoeren"}
                  </button>
                </div>
              )}
              {editing ? (
                <ScoreEditor
                  match={m}
                  labelA={teamLabel(teamA, profiles)}
                  labelB={teamLabel(teamB, profiles)}
                  onClose={() => setEditing(false)}
                  onSaved={() => {
                    setEditing(false);
                    onSaved();
                  }}
                />
              ) : (
                <p className="md-edit-note">
                  {benIkInvoerder
                    ? "Jij voerde deze uitslag in, dus jij kunt hem corrigeren."
                    : "Jij beheert deze groep, dus jij kunt de uitslag corrigeren."}
                </p>
              )}
            </>
          ) : (
            <p className="md-edit-note">
              {m.group_id
                ? `Alleen ${invoerderNaam} of de beheerder van de groep kan deze uitslag aanpassen.`
                : `Alleen wie de uitslag invoerde kan hem aanpassen — dat was ${invoerderNaam}.`}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/** De groep als klikbare badge: meteen de weg terug naar de groep (en zijn stand). */
function GroupBadge({ groupId }: { groupId: string | null }) {
  const group = useAsync(
    () => (groupId ? getGroup(groupId) : Promise.resolve(null)),
    [groupId],
  );
  if (!groupId) return null;
  return (
    <Link className="badge badge--link" to={`/groepen/${groupId}`}>
      {group.data?.name ?? "Groep"} →
    </Link>
  );
}

export default MatchScorebord;
