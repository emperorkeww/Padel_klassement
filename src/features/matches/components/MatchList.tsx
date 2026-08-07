import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Match, Profile, Team } from "@/types";
import { useIsAdmin } from "@/features/admin/useIsAdmin";
import { verwijderMatchSlim } from "@/features/admin/matchBeheer";
import { formatRelativeDay } from "@/lib/utils/format";
import { outcomeFor } from "@/features/rating/results";
import type { Upset } from "@/features/matches/upset";
import type { MatchExtras } from "@/features/matches/useMatchEffecten";
import { matchEffecten, heeftEffect } from "@/features/matches/matchEffecten";
import { historieMeta } from "@/features/matches/matchMeta";
import { TeamSide } from "@/features/matches/components/TeamSide";
import {
  MatchEffectBadge,
  MatchEffectSurface,
} from "@/features/matches/components/MatchEffectSurface";
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
  // Eén extra regel, met een teller voor de rest (#1144). De volgorde en het
  // waarom staan in matchMeta.ts; hier alleen de weergave.
  const meta = historieMeta({ match: m, upset, joker, lef });

  const outcome = perspectiveId ? outcomeFor(m, teams, perspectiveId) : null;
  const outcomeClass =
    outcome === "W"
      ? "match-card--win"
      : outcome === "L"
        ? "match-card--loss"
        : outcome === "D"
          ? "match-card--draw"
          : "";

  // Effect-swirls (#1151): drie vlaggen, drie data-attributen, drie zelfstandige
  // SVG-ribbons die optellen. Bewust geen samengestelde klasse per combinatie —
  // `data-fx` zegt alleen "er ligt iets" (voor de tekstkleur), de rest zet elk
  // zijn eigen laag aan. Bij een vierde effect komt er één attribuut en ribbon bij.
  const fx = matchEffecten({ match: m, lef, joker });
  const vlag = (aan: boolean) => (aan ? "" : undefined);
  const metaIsEffect =
    meta?.sleutel === "lef" ||
    meta?.sleutel === "joker" ||
    meta?.sleutel === "traktatie";

  return (
    <Link
      className={`match-card ${outcomeClass}`}
      to={`/matches/${m.id}`}
      data-fx={vlag(heeftEffect(fx))}
      data-fx-lef={vlag(fx.lef)}
      data-fx-joker={vlag(fx.joker)}
      data-fx-inzet={vlag(fx.inzet)}
    >
      <MatchEffectSurface effecten={fx} />
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
        {/* Speelvorm blijft een eigen chipje en telt niet mee als "moment":
            het zegt wát voor match dit is, niet wat er gebeurde. */}
        {m.format === "1v1" && (
          <span className="match-card__meta match-card__format" title="Singles">
            1v1
          </span>
        )}
        {heeftEffect(fx) && (
          <MatchEffectBadge match={m} effecten={fx} lef={lef} joker={joker} />
        )}
        {meta && !metaIsEffect && (
          <span
            className={`match-card__meta match-card__${meta.sleutel}`}
            title={
              meta.sleutel === "upset"
                ? "Underdog won — winkans vooraf lager dan 35%"
                : undefined
            }
          >
            {meta.tekst}
            {/* Eerlijk over wat er niet past: tikken opent de volledige match. */}
            {meta.rest > 0 && (
              <span className="match-card__meer"> +{meta.rest}</span>
            )}
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
  // De beheerder van de app mag ook andermans match weghalen (#1159). De check
  // zit hier en niet in een extra prop: elke aanroeper (groepsdetail, ronde,
  // historie) krijgt hem zo vanzelf, en useIsAdmin cachet per sessie.
  const isAppAdmin = useIsAdmin() === true;
  const eigenRecht = !!user && (m.created_by === user.id || canManage);
  const canDelete = eigenRecht || isAppAdmin;
  // Alleen wanneer het recht *uitsluitend* uit de beheerdersrol komt, loopt het
  // langs de edge function — dat is ook de enige route die het logt.
  const alsBeheerder = !eigenRecht && isAppAdmin;

  function startDelete() {
    setPending(true);
    timer.current = setTimeout(async () => {
      try {
        await verwijderMatchSlim(m.id, alsBeheerder);
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
        <span>
          {alsBeheerder ? "Match verwijderd als beheerder." : "Match verwijderd."}
        </span>
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
  extras,
}: {
  matches: Match[];
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  empty?: string;
  perspectiveId?: string;
  /** Upsets per match-id (#85); ontbrekend = geen upset-chip. */
  upsets?: Map<string, Upset>;
  /** Lef- en jokerregel per match (#1151), uit useMatchEffecten. Ontbrekend =
   *  geen regels; die stonden hier tot dat issue helemaal niet, waardoor het
   *  profiel dezelfde match zonder inzet toonde en de Spelen-pagina mét. */
  extras?: (match: Match) => MatchExtras;
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
            lef={extras?.(m).lef}
            joker={extras?.(m).joker}
          />
        </li>
      ))}
    </ul>
  );
}

export default MatchList;
