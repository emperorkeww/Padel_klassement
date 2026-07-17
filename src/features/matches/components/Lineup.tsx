// Opstelling (#427): FUT-achtige weergave van de match op een padelveld in
// bovenaanzicht — team A boven het net, team B eronder — met per speler een
// schildkaart in de kleur van zijn divisie en tussen de partners een
// chemielijn (zie chemistry.ts). Tik op een kaart voor een korte
// spelersamenvatting (SpelerPopup). Puur presentationeel: alle data komt via
// props; de veld- en lijngraphics zijn inline SVG met een vaste viewBox
// (zelfde conventie als RatingChart — geen DOM-meting, jsdom-testbaar).

import { useState } from "react";
import { Avatar } from "@/ui/Avatar";
import { displayName } from "@/features/profiles/api";
import { playersOf } from "@/features/rating/results";
import { tierFor, tierTitle } from "@/features/rating/tiers";
import {
  chemie,
  MIN_SAMEN_CHEMIE,
  type Chemie,
} from "@/features/matches/chemistry";
import { SpelerPopup } from "@/features/matches/components/SpelerPopup";
import type { Match, PlayerRating, Profile, RatingPoint, Team } from "@/types";
import "./Lineup.css";

/** De speler van wie de popup openstaat, met de kaart-Elo als context. */
type PopupSpeler = { pid: string; profiel: Profile | undefined; elo: number | null };

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
  const [popup, setPopup] = useState<PopupSpeler | null>(null);
  return (
    <section className="card lineup">
      <div className="card__head">
        <h2 className="card__title">Opstelling</h2>
      </div>
      <div className="lineup__veld">
        <VeldLijnen />
        <Helft
          side="a"
          team={teams[match.team_a_id]}
          matches={matchesA}
          teams={teams}
          profiles={profiles}
          histories={histories}
          ratings={ratings}
          matchId={match.id}
          onSpeler={setPopup}
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
          onSpeler={setPopup}
        />
      </div>
      <LineupUitleg />
      {popup && (
        <SpelerPopup
          pid={popup.pid}
          profiel={popup.profiel}
          elo={popup.elo}
          onClose={() => setPopup(null)}
        />
      )}
    </section>
  );
}

/** Veldmarkeringen (bovenaanzicht, 10×20 m in een 300×420-viewBox, dus
 *  1 m ≈ 21 px): kooi, net in het midden, servicelijnen op ±7 m van het net
 *  en de middenlijn die het servicevak in tweeën deelt (die loopt van het
 *  net tot de servicelijn, niet door het achtervak). Puur decor. */
function VeldLijnen() {
  return (
    <svg
      className="lineup__veldlijnen"
      viewBox="0 0 300 420"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect x="6" y="6" width="288" height="408" rx="2" strokeWidth="3" />
      <line x1="6" y1="210" x2="294" y2="210" strokeWidth="4" />
      <line x1="6" y1="68" x2="294" y2="68" strokeWidth="2" />
      <line x1="6" y1="352" x2="294" y2="352" strokeWidth="2" />
      <line x1="150" y1="68" x2="150" y2="210" strokeWidth="2" />
      <line x1="150" y1="210" x2="150" y2="352" strokeWidth="2" />
    </svg>
  );
}

/** Eén speelhelft: de kaart(en) van een team, met tussen de partners de
 *  chemielijn en bij de achterlijn de chemie als tekstbadge. */
function Helft({
  side,
  team,
  matches,
  teams,
  profiles,
  histories,
  ratings,
  matchId,
  onSpeler,
}: {
  side: "a" | "b";
  team: Team | undefined;
  matches: Match[];
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  histories: Record<string, RatingPoint[]>;
  ratings: Record<string, PlayerRating>;
  matchId: string;
  onSpeler: (s: PopupSpeler) => void;
}) {
  const spelers = playersOf(team);
  const duo = spelers.length === 2;
  const c = duo
    ? chemie(matches, teams, histories, spelers[0], spelers[1])
    : null;
  return (
    <div className={`lineup__helft lineup__helft--${side}`}>
      {spelers.map((pid, i) => (
        <span key={pid} className="lineup__plek">
          {i === 1 && c && <ChemieLijn niveau={c.niveau} />}
          <SpelerKaart
            pid={pid}
            profiel={profiles[pid]}
            histories={histories}
            ratings={ratings}
            matchId={matchId}
            onOpen={onSpeler}
          />
        </span>
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
      viewBox="0 0 120 24"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <line className="lineup__lijn-casing" x1="4" y1="12" x2="116" y2="12" />
      <line className="lineup__lijn-kern" x1="4" y1="12" x2="116" y2="12" />
    </svg>
  );
}

/** De chemie als échte tekst — verplicht naast de decoratieve lijn. */
function ChemieBadge({ chemie: c }: { chemie: Chemie }) {
  if (c.niveau === "onbekend") {
    return (
      <span className="lineup__chemie lineup__chemie--onbekend">
        Chemie: nog te weinig samen ({c.samen})
      </span>
    );
  }
  const rond = Math.round(c.gemiddeldeDelta);
  return (
    <span className={`lineup__chemie lineup__chemie--${c.niveau}`}>
      Chemie:{" "}
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
 *  mee met de divisie van de speler (zelfde token-mapping als TierBadge.css).
 *  De kaart is een knop: tikken opent de spelersamenvatting. */
function SpelerKaart({
  pid,
  profiel,
  histories,
  ratings,
  matchId,
  onOpen,
}: {
  pid: string;
  profiel: Profile | undefined;
  histories: Record<string, RatingPoint[]>;
  ratings: Record<string, PlayerRating>;
  matchId: string;
  onOpen: (s: PopupSpeler) => void;
}) {
  // Elo ná deze match; bij een geplande match (geen history-rij) de huidige
  // rating, en zonder beide een kale kaart.
  const elo =
    histories[pid]?.find((h) => h.match_id === matchId)?.rating_after ??
    ratings[pid]?.rating ??
    null;
  const tier = tierFor(elo);
  const naam = profiel ? displayName(profiel) : "Onbekend";
  return (
    <button
      type="button"
      className={`lineup-kaart${tier ? ` lineup-kaart--${tier.key}` : ""}`}
      onClick={() => onOpen({ pid, profiel, elo })}
      aria-haspopup="dialog"
      aria-label={`Samenvatting van ${naam}`}
    >
      <span className="lineup-kaart__vlak">
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
        <span className="lineup-kaart__naam">{naam}</span>
      </span>
    </button>
  );
}

/** Uitleg bij het veld (zelfde explainer-patroon als het klassement): wat de
 *  kaarten, de lijn en de chemie-badges betekenen. */
function LineupUitleg() {
  return (
    <details className="explainer lineup__uitleg">
      <summary>Wat zie ik hier?</summary>
      <div className="explainer__body">
        <dl>
          <div>
            <dt>Het veld</dt>
            <dd>
              Team A verdedigt de bovenste helft, team B de onderste. Tik op
              een kaart voor een korte samenvatting van die speler.
            </dd>
          </div>
          <div>
            <dt>De kaarten</dt>
            <dd>
              Elo van de speler ná deze match (bij een geplande match: de
              huidige rating). Het kader kleurt mee met zijn divisie.
            </dd>
          </div>
          <div>
            <dt>De lijn tussen partners</dt>
            <dd>
              De chemie van het duo — presteert het sámen beter dan hun rating
              voorspelt?
              <span className="lineup__legende">
                <LegendeLijn niveau="hoog" label="hoog (dik, vol)" />
                <LegendeLijn niveau="midden" label="midden (gestreept)" />
                <LegendeLijn niveau="laag" label="laag (dun, vol)" />
                <LegendeLijn
                  niveau="onbekend"
                  label="nog onbekend (gestippeld)"
                />
              </span>
            </dd>
          </div>
          <div>
            <dt>De badge boven/onder het veld</dt>
            <dd>
              Diezelfde chemie als getal: hoeveel Elo-punten het duo per
              gezamenlijke match boven (+) of onder (−) de verwachting scoort.
              <em> "Nog te weinig samen"</em> betekent minder dan{" "}
              {MIN_SAMEN_CHEMIE} gezamenlijke matches — te vroeg voor een
              oordeel.
            </dd>
          </div>
        </dl>
      </div>
    </details>
  );
}

function LegendeLijn({
  niveau,
  label,
}: {
  niveau: Chemie["niveau"];
  label: string;
}) {
  return (
    <span className="lineup__legende-item">
      <svg
        className={`lineup__lijn lineup__lijn--${niveau} lineup__lijn--voorbeeld`}
        viewBox="0 0 56 14"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <line className="lineup__lijn-casing" x1="2" y1="7" x2="54" y2="7" />
        <line className="lineup__lijn-kern" x1="2" y1="7" x2="54" y2="7" />
      </svg>
      {label}
    </span>
  );
}

export default Lineup;
