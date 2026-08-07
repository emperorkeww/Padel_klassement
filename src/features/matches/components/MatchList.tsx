import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Match, Profile, Team } from "@/types";
import { deleteMatch, formatSetScores, readSetScores } from "@/features/matches/api";
import { formatRelativeDay } from "@/lib/utils/format";
import { outcomeFor } from "@/features/rating/results";
import type { Upset } from "@/features/matches/upset";
import { traktatieRegel } from "@/features/matches/drankkaart";
import { TeamSide } from "@/features/matches/components/TeamSide";
import { useAuth } from "@/features/auth/AuthProvider";
import { useToast } from "@/ui/ToastProvider";
import { errorMessage } from "@/lib/utils/errors";
import { tap } from "@/lib/utils/haptics";

/** Grace-window waarin een verwijderde match nog teruggehaald kan worden. */
const UNDO_MS = 5000;

/** Eén match als kaart: teams met avatars links/rechts, score in het midden.
 *  Met `perspectiveId` kleurt de kaart mee met winst/verlies van die speler. */
export function MatchCard({
  match: m,
  teams,
  profiles,
  perspectiveId,
  upset,
  lef,
  joker,
}: {
  match: Match;
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  perspectiveId?: string;
  /** Upset-indicatie (#85): getoond bij een afgeronde underdog-winst. */
  upset?: Upset | null;
  /** Lef-regel (#981), kant-en-klaar via lefKaartRegel: wie er dubbel of
   *  niets speelde en hoe dat afliep. null/undefined = geen inzet (of nog
   *  niet onthuld) en dus geen regel. */
  lef?: string | null;
  /** Jokerregel (#1003), kant-en-klaar via jokerKaartRegel. Zelfde route als
   *  `lef` en om dezelfde reden een prop: de kaarten staan in een aparte tabel
   *  en worden per lijst in bulk opgehaald, niet per matchkaart. */
  joker?: string | null;
}) {
  const done = m.status === "completed";
  const aWon = done && m.winner_team_id === m.team_a_id;
  const bWon = done && m.winner_team_id === m.team_b_id;
  const drew = done && m.winner_team_id === null;
  const scored = m.score_a != null && m.score_b != null;
  const setLine = formatSetScores(readSetScores(m));
  const traktatie = traktatieRegel(m);

  const outcome = perspectiveId ? outcomeFor(m, teams, perspectiveId) : null;
  const outcomeClass =
    outcome === "W"
      ? "match-card--win"
      : outcome === "L"
        ? "match-card--loss"
        : outcome === "D"
          ? "match-card--draw"
          : "";

  return (
    <Link className={`match-card ${outcomeClass}`} to={`/matches/${m.id}`}>
      <TeamSide team={teams[m.team_a_id]} profiles={profiles} won={aWon} />
      <span className="match-card__mid">
        <span className="match-card__score">
          {scored ? `${m.score_a}–${m.score_b}` : done ? "gespeeld" : "vs"}
        </span>
        <span className="match-card__meta">
          {drew
            ? "gelijkspel"
            : done
              ? formatRelativeDay(m.played_at ?? m.created_at) || "afgerond"
              : m.round_number != null
                ? `ronde ${m.round_number} · gepland`
                : "gepland"}
        </span>
        {m.format === "1v1" && (
          <span className="match-card__meta match-card__format" title="Singles">
            1v1
          </span>
        )}
        {done && upset && (
          <span
            className="match-card__meta match-card__upset"
            title="Underdog won — winkans vooraf lager dan 35%"
          >
            🎯 upset · {Math.round(upset.chance * 100)}% kans
          </span>
        )}
        {setLine && (
          <span className="match-card__meta match-card__sets">{setLine}</span>
        )}
        {/* Lef-inzet (#981): blijft ook op de ingeklapte kaart staan, zodat
            wie waar dubbel of niets speelde na de speeldag terug te lezen is. */}
        {lef && <span className="match-card__meta match-card__lef">{lef}</span>}
        {/* Joker (#1003): net als de lef-regel blijft de gespeelde kaart op de
            ingeklapte kaart staan — een schild dat een nederlaag wegnam hoort
            terug te lezen te zijn naast de uitslag die het niet veranderde. */}
        {joker && (
          <span className="match-card__meta match-card__joker">{joker}</span>
        )}
        {/* Drankje-inzet (#1004). Bewust hier afgeleid en niet als prop
            doorgegeven zoals `lef`: die moet uit een aparte tabel komen, dit
            staat al op de matchrij zelf. Zo verschijnt de traktatie overal waar
            deze kaart hangt — historie, profiel, uitslagenfeed. */}
        {traktatie && (
          <span className="match-card__meta match-card__traktatie">
            {traktatie}
          </span>
        )}
      </span>
      <TeamSide
        team={teams[m.team_b_id]}
        profiles={profiles}
        won={bWon}
        right
      />
    </Link>
  );
}

/** MatchCard met een verwijder-knop (aanmaker of groepseigenaar). Na klik een
 *  korte undo-strook zodat een vergissing teruggedraaid kan worden. */
export function DeletableMatchCard({
  match: m,
  teams,
  profiles,
  perspectiveId,
  upset,
  lef,
  joker,
  canManage = false,
  onDeleted,
}: {
  match: Match;
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  perspectiveId?: string;
  upset?: Upset | null;
  /** Lef-regel (#981), doorgegeven aan de onderliggende MatchCard. */
  lef?: string | null;
  /** Jokerregel (#1003), idem. */
  joker?: string | null;
  /** True voor de groepseigenaar: mag ook matches van anderen verwijderen. */
  canManage?: boolean;
  onDeleted: () => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canDelete = !!user && (m.created_by === user.id || canManage);

  function startDelete() {
    setPending(true);
    timer.current = setTimeout(async () => {
      try {
        await deleteMatch(m.id);
        tap();
        onDeleted();
      } catch (err) {
        setPending(false); // niets verwijderd; kaart komt terug
        toast.error(errorMessage(err));
      }
    }, UNDO_MS);
  }

  function undoDelete() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setPending(false);
  }

  if (pending) {
    return (
      <div className="match-card__undo" role="status">
        <span>Match verwijderd.</span>
        <button className="btn btn--sm" onClick={undoDelete}>
          Ongedaan maken
        </button>
      </div>
    );
  }

  if (!canDelete) {
    return (
      <MatchCard
        match={m}
        teams={teams}
        profiles={profiles}
        perspectiveId={perspectiveId}
        upset={upset}
        lef={lef}
        joker={joker}
      />
    );
  }

  return (
    <div className="match-card-wrap">
      <MatchCard
        match={m}
        teams={teams}
        profiles={profiles}
        perspectiveId={perspectiveId}
        upset={upset}
        lef={lef}
        joker={joker}
      />
      <button
        type="button"
        className="match-card__del"
        aria-label="Match verwijderen"
        title="Match verwijderen"
        onClick={startDelete}
      >
        🗑
      </button>
    </div>
  );
}

export function MatchList({
  matches,
  teams,
  profiles,
  empty = "Nog geen matches.",
  perspectiveId,
  upsets,
}: {
  matches: Match[];
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  empty?: string;
  perspectiveId?: string;
  /** Upsets per match-id (#85); ontbrekend = geen upset-chip. */
  upsets?: Map<string, Upset>;
}) {
  if (matches.length === 0) return <p className="empty">{empty}</p>;

  return (
    <ul className="matchlist">
      {matches.map((m) => (
        <li key={m.id}>
          <MatchCard
            match={m}
            teams={teams}
            profiles={profiles}
            perspectiveId={perspectiveId}
            upset={upsets?.get(m.id) ?? null}
          />
        </li>
      ))}
    </ul>
  );
}

export default MatchList;