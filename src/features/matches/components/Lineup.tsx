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
import { tierForWeergave } from "@/features/rating/tiers";
import {
  editieLabel,
  editieVoor,
  type EditieContext,
} from "@/features/standings/edities";
import { featuredPlaystyles } from "@/features/profiles/badges";
import { FormChips } from "@/features/rating/components/FormChips";
import {
  FutKaart,
  FutKaartDefs,
  FutKaartVoorkant,
} from "@/features/rating/components/FutKaart";
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
  edities,
}: {
  match: Match;
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  histories: Record<string, RatingPoint[]>;
  ratings: Record<string, PlayerRating>;
  /** Recente matches van (een speler van) team A resp. B — voedt de chemie. */
  matchesA: Match[];
  matchesB: Match[];
  /** Editie- en dictator-context (#545/#621/#625): overal identiek
   *  opgebouwd, zodat de kaart op het veld dezelfde is als elders. */
  edities: EditieContext;
}) {
  return (
    <section className="card lineup">
      <div className="card__head">
        <h2 className="card__title">Opstelling</h2>
      </div>
      <FutKaartDefs />
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
          edities={edities}
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
          edities={edities}
        />
      </div>
      <LineupUitleg />
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
  edities,
}: {
  side: "a" | "b";
  team: Team | undefined;
  matches: Match[];
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  histories: Record<string, RatingPoint[]>;
  ratings: Record<string, PlayerRating>;
  matchId: string;
  edities: EditieContext;
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
            edities={edities}
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

/** FUT-schildkaart in de opstelling (#495): de gedeelde FutKaart met de
 *  standaard-voorkant en een vorm/balans-achterkant. Tikken draait de kaart
 *  om (3D-flip, zoals in FUT). De flip-knop is een onzichtbare overlay zodat
 *  de link op de achterkant een echte <Link> kan blijven (geen geneste
 *  interactie). De "lineup-kaart"-klasse bindt de veld-maat (--kaart-breedte)
 *  en de focus-ring aan de kaart. */
function SpelerKaart({
  pid,
  profiel,
  histories,
  ratings,
  matchId,
  edities,
}: {
  pid: string;
  profiel: Profile | undefined;
  histories: Record<string, RatingPoint[]>;
  ratings: Record<string, PlayerRating>;
  matchId: string;
  edities: EditieContext;
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
  // Weergave-tier (#545/#621): buiten De Troon draagt niemand de dictator-special.
  // Alleen de zittende dictator toont de troon-kaart; overige 1600+-spelers
  // zakken visueel naar GOAT voor consistentie met klassement en profiel.
  const isDictator = pid === edities.dictatorId;
  const tier = tierForWeergave(elo, isDictator);
  // Editie (#497/#621/#625): dezelfde rand als op klassement en profiel —
  // de kaart van een speler is overal dezelfde.
  const editie = editieVoor(pid, edities);
  const naam = profiel ? displayName(profiel) : "Onbekend";
  const draai = () => {
    setOmgedraaid((v) => !v);
    setOoitOmgedraaid(true);
  };
  return (
    <FutKaart
      className="lineup-kaart"
      tier={tier}
      editie={editie}
      omgedraaid={omgedraaid}
      voorOverlay={
        <button
          type="button"
          className="fut-kaart__flip"
          onClick={draai}
          aria-expanded={omgedraaid}
          aria-label={`Statistieken van ${naam}`}
        />
      }
      voor={
        <FutKaartVoorkant
          elo={elo}
          tier={tier}
          naam={naam}
          avatar={<Avatar profile={profiel} size={48} />}
          editie={editieLabel(editie, edities)}
          // PlayStyles (#500) ook op het veld (#621): dezelfde chips als op
          // de profielkaart, uit de opgeslagen featured-ids.
          playstyles={featuredPlaystyles(profiel?.featured_badges)}
        />
      }
      achterOverlay={
        <button
          type="button"
          className="fut-kaart__flip"
          onClick={draai}
          tabIndex={omgedraaid ? 0 : -1}
          aria-label="Draai de kaart terug"
        />
      }
      achter={
        ooitOmgedraaid && (
          <KaartStats pid={pid} profiel={profiel} actief={omgedraaid} />
        )
      }
    />
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
      <span className="fut-kaart__stats-rij">
        <span className="fut-kaart__stats-label">Vorm</span>
        {vorm.length > 0 ? <FormChips form={vorm} size="sm" /> : "—"}
      </span>
      <span className="fut-kaart__stats-rij">
        <span className="fut-kaart__stats-label">Balans</span>
        <span
          aria-label={`${balans.W} winst, ${balans.D} gelijk, ${balans.L} verlies`}
        >
          {gespeeld > 0 ? `${balans.W}W · ${balans.D}G · ${balans.L}V` : "—"}
        </span>
      </span>
      {profiel && (
        <Link
          className="fut-kaart__stats-link"
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
