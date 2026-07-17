// Opstelling (#427): FUT-achtige weergave van de match op een padelveld in
// bovenaanzicht — team A boven het net, team B eronder — met per speler een
// schildkaart in de kleur van zijn divisie en tussen de partners een
// chemielijn (zie chemistry.ts). Puur presentationeel: alle data komt via
// props; de veld- en lijngraphics zijn inline SVG met een vaste viewBox
// (zelfde conventie als RatingChart — geen DOM-meting, jsdom-testbaar).

import { Link } from "react-router-dom";
import { Avatar } from "@/ui/Avatar";
import { displayName } from "@/features/profiles/api";
import { playersOf } from "@/features/rating/results";
import { tierFor, tierTitle } from "@/features/rating/tiers";
import { chemie, type Chemie } from "@/features/matches/chemistry";
import type { Match, PlayerRating, Profile, RatingPoint, Team } from "@/types";
import "./Lineup.css";

export function Lineup({
  match,
  teams,
  profiles,
  histories,
  ratings,
  matchesA,
  matchesB,
}: {
  match: Match;
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  histories: Record<string, RatingPoint[]>;
  ratings: Record<string, PlayerRating>;
  /** Recente matches van (een speler van) team A resp. B — voedt de chemie. */
  matchesA: Match[];
  matchesB: Match[];
}) {
  return (
    <section className="card lineup">
      <div className="card__head">
        <h2 className="card__title">Opstelling</h2>
      </div>
      <div className="lineup__veld">
        {/* Kooi, net en servicelijnen — puur decor. */}
        <svg
          className="lineup__veldlijnen"
          viewBox="0 0 300 420"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <rect x="6" y="6" width="288" height="408" rx="2" strokeWidth="3" />
          <line x1="6" y1="210" x2="294" y2="210" strokeWidth="4" />
          <line x1="6" y1="96" x2="294" y2="96" strokeWidth="2" />
          <line x1="6" y1="324" x2="294" y2="324" strokeWidth="2" />
          <line x1="150" y1="6" x2="150" y2="96" strokeWidth="2" />
          <line x1="150" y1="324" x2="150" y2="414" strokeWidth="2" />
        </svg>
        <Helft
          side="a"
          team={teams[match.team_a_id]}
          matches={matchesA}
          teams={teams}
          profiles={profiles}
          histories={histories}
          ratings={ratings}
          matchId={match.id}
        />
        <Helft
          side="b"
          team={teams[match.team_b_id]}
          matches={matchesB}
          teams={teams}
          profiles={profiles}
          histories={histories}
          ratings={ratings}
          matchId={match.id}
        />
      </div>
    </section>
  );
}

/** Eén speelhelft: de kaart(en) van een team, plus chemielijn en -badge
 *  wanneer het een duo is. */
function Helft({
  side,
  team,
  matches,
  teams,
  profiles,
  histories,
  ratings,
  matchId,
}: {
  side: "a" | "b";
  team: Team | undefined;
  matches: Match[];
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  histories: Record<string, RatingPoint[]>;
  ratings: Record<string, PlayerRating>;
  matchId: string;
}) {
  const spelers = playersOf(team);
  const duo = spelers.length === 2;
  const c = duo
    ? chemie(matches, teams, histories, spelers[0], spelers[1])
    : null;
  return (
    <div className={`lineup__helft lineup__helft--${side}`}>
      {c && <ChemieLijn niveau={c.niveau} />}
      {spelers.map((pid) => (
        <SpelerKaart
          key={pid}
          pid={pid}
          profiel={profiles[pid]}
          histories={histories}
          ratings={ratings}
          matchId={matchId}
        />
      ))}
      {c && <ChemieBadge chemie={c} />}
    </div>
  );
}

/** De verbindingslijn tussen de partners. Decoratief (de badge draagt de
 *  betekenis als tekst); een lichte casing houdt hem leesbaar op het veld. */
function ChemieLijn({ niveau }: { niveau: Chemie["niveau"] }) {
  return (
    <svg
      className={`lineup__lijn lineup__lijn--${niveau}`}
      viewBox="0 0 110 24"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <line className="lineup__lijn-casing" x1="4" y1="12" x2="106" y2="12" />
      <line className="lineup__lijn-kern" x1="4" y1="12" x2="106" y2="12" />
    </svg>
  );
}

/** De chemie als échte tekst — verplicht naast de decoratieve lijn. */
function ChemieBadge({ chemie: c }: { chemie: Chemie }) {
  if (c.niveau === "onbekend") {
    return (
      <span className="lineup__chemie">
        Nog te weinig samen ({c.samen})
      </span>
    );
  }
  const rond = Math.round(c.gemiddeldeDelta);
  return (
    <span className="lineup__chemie">
      <span
        className={`lineup__chemie-delta ${rond >= 0 ? "is-up" : "is-down"}`}
      >
        {rond >= 0 ? "+" : "−"}
        {Math.abs(rond)} Elo
      </span>
      /match ({c.samen} samen)
    </span>
  );
}

/** FUT-schildkaart: Elo groot, divisie-emoji, avatar en naam; het frame kleurt
 *  mee met de divisie van de speler (zelfde token-mapping als TierBadge.css). */
function SpelerKaart({
  pid,
  profiel,
  histories,
  ratings,
  matchId,
}: {
  pid: string;
  profiel: Profile | undefined;
  histories: Record<string, RatingPoint[]>;
  ratings: Record<string, PlayerRating>;
  matchId: string;
}) {
  // Elo ná deze match; bij een geplande match (geen history-rij) de huidige
  // rating, en zonder beide een kale kaart.
  const elo =
    histories[pid]?.find((h) => h.match_id === matchId)?.rating_after ??
    ratings[pid]?.rating ??
    null;
  const tier = tierFor(elo);
  return (
    <div
      className={`lineup-kaart${tier ? ` lineup-kaart--${tier.key}` : ""}`}
    >
      <div className="lineup-kaart__vlak">
        <span className="lineup-kaart__elo">{elo ?? "—"}</span>
        <span className="lineup-kaart__elo-label">Elo</span>
        {tier && (
          <span className="lineup-kaart__tier" title={tierTitle(tier)}>
            {tier.emoji}
          </span>
        )}
        <span className="lineup-kaart__avatar">
          <Avatar profile={profiel} size={44} />
        </span>
        {profiel ? (
          <Link className="lineup-kaart__naam" to={`/spelers/${pid}`}>
            {displayName(profiel)}
          </Link>
        ) : (
          <span className="lineup-kaart__naam">Onbekend</span>
        )}
      </div>
    </div>
  );
}

export default Lineup;
