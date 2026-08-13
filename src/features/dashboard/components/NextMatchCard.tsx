import { useState } from "react";
import { Link } from "react-router-dom";
import { useToast } from "@/ui/ToastProvider";
import { celebrate } from "@/lib/utils/confetti";
import { tap, winPulse } from "@/lib/utils/haptics";
import { inTeam } from "@/features/rating/results";
import { teamLabel } from "@/features/matches/api";
import { vulUitslagIn } from "@/features/admin/matchBeheer";
import { matchRechten } from "@/features/matches/matchState";
import { TeamSide } from "@/features/matches/components/TeamSide";
import {
  ScoreSheet,
  type ScoreInvoer,
} from "@/features/matches/components/ScoreSheet";
import type { Match, Profile, Team } from "@/types";
import { matchWhen, wachtOpUitslag } from "../dashboardHelpers";

// De eerstvolgende match van de kijker, compact op het overzicht (#273): wie +
// wanneer. Sinds #1210 ook wáár je de uitslag invult — de knop opent de
// score-sheet hier, in plaats van je naar /matches/:id te sturen om daar
// nogmaals te klikken. Uitslag invullen is de meest voorkomende schrijfactie
// van de app; die hoort op het scherm waar je toch al staat (het patroon van de
// stemkaart, #1196).
//
// Eén kaart, twee toestanden: een match waarvan het uur voorbij is wacht op
// zijn uitslag, een match die nog moet komen is "je volgende". Dezelfde knop,
// een andere kop — het is hetzelfde ding in een andere fase, dus geen tweede
// kaart ernaast.
//
// Corrigeren, verzetten en verwijderen blijven op het matchdetail: dat is de
// afbakening van #1210, en de link in de kop houdt die route open.
//
// De drie kolommen van de gedeelde .match-card werken hier niet op 390px (#940):
// dan houdt elk team ~90px over en truncaten alle vier de namen, terwijl
// "ronde 1 · gepland · Vrijdagavond Padel" in het midden de volle breedte pakt.
// De namen zijn het punt van deze kaart, dus die metadata staat nu als eigen
// regel onder de paring en op mobiel stapelen de twee teams (CSS). In het midden
// blijft "vs" staan — dezelfde plek waar de matchlijst de uitslag zet.

export function NextMatchCard({
  match,
  groupName,
  teams,
  profiles,
  myId,
  onSaved,
}: {
  match: Match;
  groupName: string | null;
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  /** De ingelogde kijker; bepaalt of de invulknop er staat. */
  myId: string;
  /** Na een opgeslagen uitslag: het overzicht herlaadt en de kaart schuift door
   *  naar de volgende openstaande match (of verdwijnt). */
  onSaved?: () => void;
}) {
  const toast = useToast();
  const [scoreOpen, setScoreOpen] = useState(false);

  // Rechten uit de gedeelde spiegel van de policies (#1144). Geen groeps- of
  // beheerdersrol meegegeven: het overzicht toont alleen je eigen matches, dus
  // wie hier iets mag, mag het als deelnemer of aanmaker. Weigert de server
  // toch, dan meldt de sheet dat en blijft je invoer staan.
  const rechten = matchRechten({ match, teams, myId, perspectiveId: myId });
  const wacht = wachtOpUitslag(match);

  /** Opslaan langs dezelfde route als de geplande kaart in de groep: dezelfde
   *  api-functie, dezelfde viering. Een fout gaat door naar ScoreSheet, die
   *  hem meldt en de sheet openhoudt. */
  async function save(invoer: ScoreInvoer) {
    const { scoreA: a, scoreB: b } = invoer;
    const winnerTeamId = a === b ? null : a > b ? match.team_a_id : match.team_b_id;
    await vulUitslagIn(
      {
        matchId: match.id,
        winnerTeamId,
        scoreA: a,
        scoreB: b,
        setScores: invoer.setScores,
        playedAt: match.played_at, // geplande speeltijd behouden (#1271)
      },
      rechten.alsBeheerder,
    );
    if (winnerTeamId && inTeam(teams[winnerTeamId], myId)) {
      celebrate();
      winPulse();
    } else {
      tap();
    }
    toast.success("Resultaat opgeslagen.");
    onSaved?.();
  }

  return (
    <section className="card card--next glas glas--standaard">
      <div className="card__head">
        <h2 className="card__title">
          {wacht ? "Vul de uitslag in" : "Jouw volgende match"}
        </h2>
        <Link className="profile-link" to={`/matches/${match.id}`}>
          Bekijk de match →
        </Link>
      </div>
      <div className="next-match">
        <div className="match-card">
          <TeamSide team={teams[match.team_a_id]} profiles={profiles} won={false} />
          <span className="match-card__mid">
            <span className="match-card__score">vs</span>
          </span>
          <TeamSide
            team={teams[match.team_b_id]}
            profiles={profiles}
            won={false}
            right
          />
        </div>
        <p className="next-match__meta">{matchWhen(match, groupName)}</p>
      </div>

      {rechten.magInvullen && (
        <div className="next-match__acties">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setScoreOpen(true)}
          >
            Uitslag invullen
          </button>
        </div>
      )}

      {/* Dezelfde sheet als de geplande kaart en het matchdetail (#1144), dus
          dezelfde invoer, dezelfde sets en dezelfde foutmelding. */}
      {rechten.magInvullen && (
        <ScoreSheet
          open={scoreOpen}
          match={match}
          labelA={teamLabel(teams[match.team_a_id], profiles)}
          labelB={teamLabel(teams[match.team_b_id], profiles)}
          onClose={() => setScoreOpen(false)}
          onSave={save}
        />
      )}
    </section>
  );
}

export default NextMatchCard;
