import { useMemo, useState, type ReactNode } from "react";
import { Sheet } from "@/ui/Sheet";
import { Skeleton } from "@/ui/Skeleton";
import { TierBadge } from "@/features/rating/components/TierBadge";
import { FormChips } from "@/features/rating/components/FormChips";
import { useAsync } from "@/lib/hooks/useAsync";
import { getPlayerRatings } from "@/features/standings/ratingsApi";
import { getPlayerStandings, getPlayerStanding } from "@/features/standings/api";
import { getProfilesMap, displayName } from "@/features/profiles/api";
import {
  getPlayerMatches,
  getTeamsMap,
  teamLabel,
  readSetScores,
  formatSetScores,
} from "@/features/matches/api";
import { headToHead } from "@/features/profiles/headToHead";
import {
  comparisonSide,
  jointMatches,
  jointRol,
  ratingRankIndex,
  ratioBalk,
  type VergelijkKant,
} from "@/features/profiles/compare";
import { winRate } from "@/features/rating/results";
import { formatDate } from "@/lib/utils/format";
import type { Match, Profile, Team } from "@/types";
import "./ComparisonSheet.css";

// Speler Duel & Vergelijker (#469): bottom-sheet die twee spelers naast elkaar
// legt. App-brede data (ratings/standen/profielen/teams) laden we één keer; de
// matches + serverstand van een gekozen kant herladen enkel bij een wissel. De
// rekenlogica zit in features/profiles/compare.ts, de onderlinge balans in
// headToHead().

const HISTORIE_LIMIET = 10;

/** Wie "wint" een statistiek-rij: bepaalt welke kant oplicht. */
function winnaar(
  a: number | null,
  b: number | null,
  hoog = true,
): "links" | "rechts" | "geen" {
  if (a == null && b == null) return "geen";
  if (a == null) return "rechts";
  if (b == null) return "links";
  if (a === b) return "geen";
  const aWint = hoog ? a > b : a < b;
  return aWint ? "links" : "rechts";
}

export function ComparisonSheet({
  open,
  onClose,
  defaultLeftId,
  defaultRightId,
}: {
  open: boolean;
  onClose: () => void;
  defaultLeftId: string;
  defaultRightId: string;
}) {
  const [leftId, setLeftId] = useState(defaultLeftId);
  const [rightId, setRightId] = useState(defaultRightId);

  // App-brede data (achter de cached()-laag, dus geen dubbele netwerkcalls).
  const ratings = useAsync(getPlayerRatings, []);
  const standings = useAsync(getPlayerStandings, []);
  const profiles = useAsync(getProfilesMap, []);
  const teams = useAsync(getTeamsMap, []);

  // Per kant: de historie (ruime limiet, pariteit met het profiel) en de
  // serverstand — herladen alleen wanneer de gekozen speler wijzigt.
  const leftMatches = useAsync(() => getPlayerMatches(leftId, 200), [leftId]);
  const rightMatches = useAsync(() => getPlayerMatches(rightId, 200), [rightId]);
  const leftStanding = useAsync(() => getPlayerStanding(leftId), [leftId]);
  const rightStanding = useAsync(() => getPlayerStanding(rightId), [rightId]);

  const pmap = profiles.data ?? {};
  const tmap = teams.data ?? {};
  const rmap = ratings.data ?? {};

  const rankIndex = useMemo(
    () => ratingRankIndex(standings.data ?? [], ratings.data ?? {}),
    [standings.data, ratings.data],
  );

  // Kiesbare spelers: alle echte profielen (geen gasten), op naam gesorteerd.
  const spelers = useMemo(
    () =>
      Object.values(profiles.data ?? {})
        .filter((p) => !p.is_guest)
        .sort((a, b) => displayName(a).localeCompare(displayName(b), "nl")),
    [profiles.data],
  );

  const basisLaadt =
    ratings.loading || standings.loading || profiles.loading || teams.loading;
  const zelfde = leftId === rightId;

  const links: VergelijkKant | null =
    !basisLaadt && leftMatches.data
      ? comparisonSide({
          id: leftId,
          naam: displayName(pmap[leftId]),
          standing: leftStanding.data ?? null,
          matches: leftMatches.data,
          teams: tmap,
          ratings: rmap,
          rankIndex,
        })
      : null;
  const rechts: VergelijkKant | null =
    !basisLaadt && rightMatches.data
      ? comparisonSide({
          id: rightId,
          naam: displayName(pmap[rightId]),
          standing: rightStanding.data ?? null,
          matches: rightMatches.data,
          teams: tmap,
          ratings: rmap,
          rankIndex,
        })
      : null;

  // Onderlinge balans + gezamenlijke historie rekenen we over de matches van de
  // linkerkant (die álle wedstrijden bevatten waarin links meedeed — en dus ook
  // elke gezamenlijke met rechts).
  const balans =
    links && rechts && !zelfde
      ? headToHead(leftMatches.data ?? [], tmap, leftId, rightId)
      : null;
  const historie =
    links && rechts && !zelfde
      ? jointMatches(leftMatches.data ?? [], tmap, leftId, rightId, HISTORIE_LIMIET)
      : [];

  return (
    <Sheet open={open} onClose={onClose} title="⚔️ Vergelijk" className="vs-sheet">
      <div className="vs-pickers">
        <PlayerPicker
          label="Speler links"
          value={leftId}
          onChange={setLeftId}
          spelers={spelers}
        />
        <span className="vs-pickers__vs" aria-hidden="true">
          vs
        </span>
        <PlayerPicker
          label="Speler rechts"
          value={rightId}
          onChange={setRightId}
          spelers={spelers}
        />
      </div>

      {basisLaadt ? (
        <Skeleton rows={6} />
      ) : zelfde ? (
        <p className="vs-hint">Kies twee verschillende spelers om te vergelijken.</p>
      ) : !links || !rechts ? (
        <Skeleton rows={6} />
      ) : (
        <>
          <StatVergelijking links={links} rechts={rechts} />
          {balans && <OnderlingeBalans balans={balans} links={links} rechts={rechts} />}
          <GezamenlijkeHistorie
            matches={historie}
            teams={tmap}
            profiles={pmap}
            aId={leftId}
            bId={rightId}
          />
        </>
      )}
    </Sheet>
  );
}

function PlayerPicker({
  label,
  value,
  onChange,
  spelers,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  spelers: Profile[];
}) {
  return (
    <label className="vs-picker">
      <span className="vs-picker__label">{label}</span>
      <select
        className="select"
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
      >
        {spelers.map((p) => (
          <option key={p.id} value={p.id}>
            {displayName(p)}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatVergelijking({
  links,
  rechts,
}: {
  links: VergelijkKant;
  rechts: VergelijkKant;
}) {
  return (
    <section className="card vs-card">
      <div className="vs-names">
        <span className="vs-names__name">{links.naam}</span>
        <span className="vs-names__name">{rechts.naam}</span>
      </div>

      <StatRij
        label="Elo"
        win={winnaar(links.rating, rechts.rating)}
        left={links.rating ?? "—"}
        right={rechts.rating ?? "—"}
        leftExtra={<TierBadge rating={links.rating} size="sm" />}
        rightExtra={<TierBadge rating={rechts.rating} size="sm" />}
      />
      <StatRij
        label="Positie"
        win={winnaar(links.rank, rechts.rank, false)}
        left={links.rank ? `#${links.rank}` : "—"}
        right={rechts.rank ? `#${rechts.rank}` : "—"}
      />
      <StatRij
        label="Punten"
        win={winnaar(links.punten, rechts.punten)}
        left={links.punten}
        right={rechts.punten}
      />
      <StatRij
        label="Winrate"
        win={winnaar(links.winrate, rechts.winrate)}
        left={links.winrate != null ? `${links.winrate}%` : "—"}
        right={rechts.winrate != null ? `${rechts.winrate}%` : "—"}
      />
      <StatRij
        label="Gespeeld"
        win="geen"
        left={links.gespeeld}
        right={rechts.gespeeld}
      />
      <StatRij
        label="Badges"
        win={winnaar(links.badges, rechts.badges)}
        left={links.badges}
        right={rechts.badges}
      />
      <StatRij
        label="Vorm"
        win="geen"
        left={links.vorm.length ? <FormChips form={links.vorm} size="sm" /> : "—"}
        right={rechts.vorm.length ? <FormChips form={rechts.vorm} size="sm" /> : "—"}
      />
    </section>
  );
}

function StatRij({
  label,
  win,
  left,
  right,
  leftExtra,
  rightExtra,
}: {
  label: string;
  win: "links" | "rechts" | "geen";
  left: ReactNode;
  right: ReactNode;
  leftExtra?: ReactNode;
  rightExtra?: ReactNode;
}) {
  return (
    <div className="vs-rij">
      <span className={`vs-rij__side vs-rij__side--left${win === "links" ? " is-winner" : ""}`}>
        <span className="vs-rij__value">{left}</span>
        {leftExtra}
      </span>
      <span className="vs-rij__label">{label}</span>
      <span className={`vs-rij__side vs-rij__side--right${win === "rechts" ? " is-winner" : ""}`}>
        <span className="vs-rij__value">{right}</span>
        {rightExtra}
      </span>
    </div>
  );
}

function OnderlingeBalans({
  balans,
  links,
  rechts,
}: {
  balans: ReturnType<typeof headToHead>;
  links: VergelijkKant;
  rechts: VergelijkKant;
}) {
  const { gewonnen, verloren, gespeeld } = balans.alsTegenstanders;
  const gelijk = Math.max(0, gespeeld - gewonnen - verloren);
  const ratio = ratioBalk(gewonnen, verloren, gelijk);
  const { samen, gewonnen: samenGewonnen } = balans.alsPartners;

  return (
    <section className="card vs-card">
      <h3 className="card__title">Onderlinge balans</h3>

      {gespeeld === 0 && samen === 0 ? (
        <p className="onderling__leeg">Nog nooit samen op de baan gestaan.</p>
      ) : (
        <>
          {gespeeld > 0 && (
            <div className="vs-balans">
              <div className="vs-balans__kop">
                <span className="vs-balans__label">Als tegenstanders</span>
                <span className="vs-balans__cijfer">
                  {gewonnen}
                  <span className="vs-balans__sep">–</span>
                  {gelijk > 0 ? `${gelijk}–` : ""}
                  {verloren}
                </span>
              </div>
              <div
                className="vs-ratio"
                role="img"
                aria-label={`${links.naam} ${gewonnen} gewonnen, ${gelijk} gelijk, ${rechts.naam} ${verloren} gewonnen`}
              >
                {ratio.win > 0 && (
                  <span className="vs-ratio__win" style={{ width: `${ratio.win}%` }} />
                )}
                {ratio.draw > 0 && (
                  <span className="vs-ratio__draw" style={{ width: `${ratio.draw}%` }} />
                )}
                {ratio.loss > 0 && (
                  <span className="vs-ratio__loss" style={{ width: `${ratio.loss}%` }} />
                )}
              </div>
              <div className="vs-balans__voet">
                <span>{links.naam}</span>
                <span>{rechts.naam}</span>
              </div>
            </div>
          )}

          {samen > 0 && (
            <div className="vs-balans">
              <div className="vs-balans__kop">
                <span className="vs-balans__label">Als partners</span>
                <span className="vs-balans__cijfer">
                  {samen} {samen === 1 ? "match" : "matches"} ·{" "}
                  {winRate(samenGewonnen, samen)}% gewonnen
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function GezamenlijkeHistorie({
  matches,
  teams,
  profiles,
  aId,
  bId,
}: {
  matches: Match[];
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  aId: string;
  bId: string;
}) {
  return (
    <section className="card vs-card">
      <h3 className="card__title">Gezamenlijke matches</h3>
      {matches.length === 0 ? (
        <p className="onderling__leeg">Nog geen gezamenlijke matches.</p>
      ) : (
        <ul className="vs-historie">
          {matches.map((m) => {
            const rol = jointRol(m, teams, aId, bId);
            const sets = formatSetScores(readSetScores(m));
            const uitslag =
              sets ||
              (m.score_a != null && m.score_b != null
                ? `${m.score_a}–${m.score_b}`
                : "");
            return (
              <li key={m.id} className="vs-historie__rij">
                <span className={`vs-rol vs-rol--${rol}`}>
                  {rol === "duo" ? "🤝 Samen" : "⚔️ Tegen"}
                </span>
                <span className="vs-historie__teams">
                  {teamLabel(teams[m.team_a_id], profiles)} vs{" "}
                  {teamLabel(teams[m.team_b_id], profiles)}
                </span>
                {uitslag && <span className="vs-historie__score">{uitslag}</span>}
                <span className="vs-historie__datum">
                  {formatDate(m.played_at ?? m.created_at)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default ComparisonSheet;
