// Opstelling (#427): FUT-achtige weergave van de match op een padelveld in
// bovenaanzicht — team A boven het net, team B eronder — met per speler een
// schildkaart in de kleur van zijn divisie en tussen de partners een
// chemielijn (zie chemistry.ts). Tik op een kaart en hij draait om (zoals in
// FUT) met vorm en balans op de achterkant. Puur presentationeel: alle data
// komt via props (de achterkant laadt zijn eigen gecachte matches); de veld-
// en lijngraphics zijn inline SVG met een vaste viewBox (zelfde conventie als
// RatingChart — geen DOM-meting, jsdom-testbaar).

import { useState } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "@/ui/Avatar";
import { useAsync } from "@/lib/hooks/useAsync";
import { displayName } from "@/features/profiles/api";
import { getPlayerMatches, getTeamsMap } from "@/features/matches/api";
import { outcomeFor, playersOf, recentForm } from "@/features/rating/results";
import { tierFor, tierTitle } from "@/features/rating/tiers";
import { FormChips } from "@/features/rating/components/FormChips";
import {
  chemie,
  CHEMIE_MATCH_LIMIT,
  MIN_SAMEN_CHEMIE,
  type Chemie,
} from "@/features/matches/chemistry";
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
      <SchildDefs />
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
      <LineupUitleg />
    </section>
  );
}

/** Schildvormen (#495): vier clipPaths met exact dezelfde onderkant (de punt
 *  op 50%/100% blijft het chemielijn-anker) en een bovenrand die oploopt met
 *  de divisiegroep — vlak, kroon-notch, spitse vleugels, kroon-crest.
 *  Lineup.css kiest per tier via de --schild-variabele. objectBoundingBox
 *  laat de paden meeschalen met elke kaartbreedte. */
function SchildDefs() {
  return (
    <svg width="0" height="0" className="lineup__schilddefs" aria-hidden="true">
      <defs>
        <clipPath id="lineup-schild-vlak" clipPathUnits="objectBoundingBox">
          <path d="M 0.04 0 L 0.96 0 L 1 0.055 L 1 0.60 C 1 0.74 0.955 0.795 0.865 0.838 L 0.565 0.972 C 0.545 0.982 0.523 1 0.5 1 C 0.477 1 0.455 0.982 0.435 0.972 L 0.135 0.838 C 0.045 0.795 0 0.74 0 0.60 L 0 0.055 Z" />
        </clipPath>
        <clipPath id="lineup-schild-notch" clipPathUnits="objectBoundingBox">
          <path d="M 0.085 0 L 0.40 0 C 0.44 0 0.46 0.022 0.5 0.022 C 0.54 0.022 0.56 0 0.60 0 L 0.915 0 C 0.962 0 1 0.028 1 0.062 L 1 0.60 C 1 0.74 0.955 0.795 0.865 0.838 L 0.565 0.972 C 0.545 0.982 0.523 1 0.5 1 C 0.477 1 0.455 0.982 0.435 0.972 L 0.135 0.838 C 0.045 0.795 0 0.74 0 0.60 L 0 0.062 C 0 0.028 0.038 0 0.085 0 Z" />
        </clipPath>
        <clipPath id="lineup-schild-punt" clipPathUnits="objectBoundingBox">
          <path d="M 0.035 0.01 L 0.44 0.04 C 0.47 0.042 0.48 0.058 0.5 0.058 C 0.52 0.058 0.53 0.042 0.56 0.04 L 0.965 0.01 L 1 0.075 L 1 0.60 C 1 0.74 0.955 0.795 0.865 0.838 L 0.565 0.972 C 0.545 0.982 0.523 1 0.5 1 C 0.477 1 0.455 0.982 0.435 0.972 L 0.135 0.838 C 0.045 0.795 0 0.74 0 0.60 L 0 0.075 Z" />
        </clipPath>
        <clipPath id="lineup-schild-kroon" clipPathUnits="objectBoundingBox">
          <path d="M 0.085 0.035 L 0.38 0.035 C 0.43 0.035 0.44 0 0.5 0 C 0.56 0 0.57 0.035 0.62 0.035 L 0.915 0.035 C 0.962 0.035 1 0.062 1 0.095 L 1 0.60 C 1 0.74 0.955 0.795 0.865 0.838 L 0.565 0.972 C 0.545 0.982 0.523 1 0.5 1 C 0.477 1 0.455 0.982 0.435 0.972 L 0.135 0.838 C 0.045 0.795 0 0.74 0 0.60 L 0 0.095 C 0 0.062 0.038 0.035 0.085 0.035 Z" />
        </clipPath>
      </defs>
    </svg>
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
      <div className="lineup__rij">
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
      </div>
      {c && <ChemieBadge chemie={c} />}
    </div>
  );
}

/** De verbindingslijn tussen de partners: een lichte capsule met de
 *  niveau-lijn erin, een zachte gloed in de niveaukleur en eindpunten die in
 *  de kaarten "pluggen". Decoratief — de badge draagt de betekenis als tekst. */
function ChemieLijn({
  niveau,
  voorbeeld = false,
}: {
  niveau: Chemie["niveau"];
  /** Compacte variant voor de legenda in de uitleg (op --surface). */
  voorbeeld?: boolean;
}) {
  return (
    <span
      className={`lineup__lijn lineup__lijn--${niveau}${voorbeeld ? " lineup__lijn--voorbeeld" : ""}`}
      aria-hidden="true"
    >
      <span className="lineup__lijn-kern" />
    </span>
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

/** FUT-schildkaart (#495): Elo met sub-niveau (Romeins) en divisie-emoji
 *  links, avatar rechts, naam op de naamplaat en de divisienaam voluit
 *  eronder; het metaalvlak en frame kleuren mee met de divisie (zelfde
 *  token-mapping als TierBadge.css) en de bovenrand van het schild wisselt
 *  per divisiegroep (zie SchildDefs). Tikken draait de kaart om (3D-flip,
 *  zoals in FUT) naar een achterkant met vorm en balans. De flip-knop is een
 *  onzichtbare overlay zodat de link op de achterkant een echte <Link> kan
 *  blijven (geen geneste interactie). */
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
  const [omgedraaid, setOmgedraaid] = useState(false);
  // Eenmaal omgedraaid blijft de achterkant gemount, zodat hij tijdens het
  // terugdraaien niet leeg valt (en zijn gecachte data behoudt).
  const [ooitOmgedraaid, setOoitOmgedraaid] = useState(false);
  // Elo ná deze match; bij een geplande match (geen history-rij) de huidige
  // rating, en zonder beide een kale kaart.
  const elo =
    histories[pid]?.find((h) => h.match_id === matchId)?.rating_after ??
    ratings[pid]?.rating ??
    null;
  const tier = tierFor(elo);
  const naam = profiel ? displayName(profiel) : "Onbekend";
  const draai = () => {
    setOmgedraaid((v) => !v);
    setOoitOmgedraaid(true);
  };
  return (
    <div
      className={`lineup-kaart${tier ? ` lineup-kaart--${tier.key}` : ""}${omgedraaid ? " is-omgedraaid" : ""}`}
    >
      <div className="lineup-kaart__flipper">
        <div className="lineup-kaart__zijde lineup-kaart__zijde--voor">
          <button
            type="button"
            className="lineup-kaart__flip"
            onClick={draai}
            aria-expanded={omgedraaid}
            aria-label={`Statistieken van ${naam}`}
          />
          <span className="lineup-kaart__liner">
            <span className="lineup-kaart__vlak">
              <span className="lineup-kaart__boven">
                <span className="lineup-kaart__eloblok">
                  <span className="lineup-kaart__elo">{elo ?? "—"}</span>
                  {tier?.subLabel && (
                    <span className="lineup-kaart__sub">{tier.subLabel}</span>
                  )}
                  {tier && (
                    <span
                      className="lineup-kaart__tier"
                      title={tierTitle(tier)}
                    >
                      {tier.emoji}
                    </span>
                  )}
                </span>
                <span className="lineup-kaart__avatar">
                  <Avatar profile={profiel} size={48} />
                </span>
              </span>
              <span className="lineup-kaart__naam">{naam}</span>
              {tier && (
                <span className="lineup-kaart__divisie">{tier.label}</span>
              )}
            </span>
          </span>
        </div>
        <div
          className="lineup-kaart__zijde lineup-kaart__zijde--achter"
          aria-hidden={!omgedraaid}
        >
          <button
            type="button"
            className="lineup-kaart__flip"
            onClick={draai}
            tabIndex={omgedraaid ? 0 : -1}
            aria-label="Draai de kaart terug"
          />
          <span className="lineup-kaart__liner">
            <span className="lineup-kaart__vlak lineup-kaart__vlak--stats">
              {ooitOmgedraaid && (
                <KaartStats pid={pid} profiel={profiel} actief={omgedraaid} />
              )}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** Achterkant van de kaart: vorm en balans over de recente matches van de
 *  speler, met een doorklik naar het profiel. Laadt zijn eigen (gecachte)
 *  data — de opstelling-matches dekken alleen dit duo, de vorm gaat over
 *  álle recente matches van de speler. */
function KaartStats({
  pid,
  profiel,
  actief,
}: {
  pid: string;
  profiel: Profile | undefined;
  actief: boolean;
}) {
  const matches = useAsync(
    () => getPlayerMatches(pid, CHEMIE_MATCH_LIMIT),
    [pid],
  );
  const teams = useAsync(getTeamsMap, []);
  const ms = matches.data ?? [];
  const tmap = teams.data ?? {};
  const vorm = recentForm(ms, tmap, pid);
  const balans = { W: 0, D: 0, L: 0 };
  for (const m of ms) {
    const o = outcomeFor(m, tmap, pid);
    if (o) balans[o]++;
  }
  const gespeeld = balans.W + balans.D + balans.L;
  return (
    <>
      <span className="lineup-kaart__stats-rij">
        <span className="lineup-kaart__stats-label">Vorm</span>
        {vorm.length > 0 ? <FormChips form={vorm} size="sm" /> : "—"}
      </span>
      <span className="lineup-kaart__stats-rij">
        <span className="lineup-kaart__stats-label">Balans</span>
        <span
          aria-label={`${balans.W} winst, ${balans.D} gelijk, ${balans.L} verlies`}
        >
          {gespeeld > 0 ? `${balans.W}W · ${balans.D}G · ${balans.L}V` : "—"}
        </span>
      </span>
      {profiel && (
        <Link
          className="lineup-kaart__stats-link"
          to={`/spelers/${pid}`}
          tabIndex={actief ? 0 : -1}
        >
          Profiel →
        </Link>
      )}
    </>
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
            <dt>
              <span className="lineup__uitleg-icoon" aria-hidden="true">
                🎾
              </span>
              Het veld
            </dt>
            <dd>
              Team A verdedigt de bovenste helft, team B de onderste. Tik op
              een kaart om hem om te draaien: op de achterkant staan de vorm
              en balans van die speler.
            </dd>
          </div>
          <div>
            <dt>
              <span className="lineup__uitleg-icoon" aria-hidden="true">
                🃏
              </span>
              De kaarten
            </dt>
            <dd>
              Elo van de speler ná deze match (bij een geplande match: de
              huidige rating), met daaronder het sub-niveau als Romeins
              cijfer. De kaart kleurt mee met zijn divisie en de vorm van de
              bovenkant stijgt mee met de divisiegroep — de toptiers krijgen
              een donkere special-kaart.
            </dd>
          </div>
          <div>
            <dt>
              <span className="lineup__uitleg-icoon" aria-hidden="true">
                ⚡
              </span>
              De lijn tussen partners
            </dt>
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
            <dt>
              <span className="lineup__uitleg-icoon" aria-hidden="true">
                🏷️
              </span>
              De badge boven/onder het veld
            </dt>
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
      <ChemieLijn niveau={niveau} voorbeeld />
      {label}
    </span>
  );
}

export default Lineup;
