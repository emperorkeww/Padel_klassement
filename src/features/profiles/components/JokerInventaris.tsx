import { useAsync } from "@/lib/hooks/useAsync";
import { useCacheRevision } from "@/lib/hooks/useCacheRevision";
import {
  jokerIcoon,
  jokerLabel,
  maandLabel,
  type MatchJoker,
} from "@/features/matches/jokers";
import { getJokersForMatches } from "@/features/matches/jokersApi";
import type { Match } from "@/types";
import "./JokerInventaris.css";

/** Maand van vandaag (YYYY-MM-01) — het tegoed dat nú openstaat. */
function dezeMaand(now = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${m}-01`;
}

/**
 * Jokervoorraad op het profiel (#1003): ligt de kaart van deze maand er nog, en
 * wat speelde je de maanden ervoor?
 *
 * Het anker `jokers` is het doelwit van de jokerknop in de app-shell; wie daar
 * op tikt komt hier uit. Alleen op je eigen profiel: andermans ongebruikte
 * kaart is geen publieke informatie — die zou verklappen wat er nog aan kan
 * komen, en dat is precies wat de anti-meelift-regel op de matchkaart afschermt.
 *
 * De kaarten komen uit de matches die het profiel toch al ophaalt, dus één
 * bulk-query en geen extra rondgang per maand.
 */
export function JokerInventaris({
  matches,
  playerId,
  /** Is dit je eigen profiel? Alleen dan valt er een voorraad te tonen. */
  isMij,
}: {
  matches: Match[];
  playerId: string;
  isMij: boolean;
}) {
  const rev = useCacheRevision("match-jokers");
  const ids = matches
    .filter((m) => m.group_id != null)
    .map((m) => m.id)
    .join(",");
  const jokers = useAsync(
    () => (isMij ? getJokersForMatches(ids ? ids.split(",") : []) : Promise.resolve([])),
    [ids, isMij, rev],
  );

  if (!isMij) return null;

  const mijn = (jokers.data ?? []).filter((j) => j.player_id === playerId);
  const maand = dezeMaand();
  const dezeMaandKaart =
    mijn.find((j) => j.period_month.slice(0, 10) === maand) ?? null;
  // Nieuwste eerst; de maand van vandaag staat al apart bovenaan.
  const eerder = mijn
    .filter((j) => j.period_month.slice(0, 10) !== maand)
    .sort((a, b) => b.period_month.localeCompare(a.period_month))
    .slice(0, 6);

  return (
    <section className="card" id="jokers">
      <h2 className="card__title">Je jokers</h2>
      <p className="card__subtitle">
        Eén kaart per kalendermaand, te spelen op een geplande groepsmatch
        waarin je zelf meedoet.
      </p>

      <div
        className={`jokerinv__nu ${
          dezeMaandKaart ? "jokerinv__nu--op" : "jokerinv__nu--klaar"
        }`}
      >
        <span className="jokerinv__icoon" aria-hidden="true">
          {dezeMaandKaart ? jokerIcoon(dezeMaandKaart.joker) : "🃏"}
        </span>
        <span className="jokerinv__tekst">
          <strong>{maandLabel(maand)}</strong>
          <span>
            {dezeMaandKaart
              ? `Gespeeld: ${jokerLabel(dezeMaandKaart.joker)}.`
              : "Je kaart ligt nog klaar."}
          </span>
        </span>
      </div>

      {eerder.length > 0 && (
        <ul className="jokerinv__historie">
          {eerder.map((j: MatchJoker) => (
            <li key={`${j.match_id}-${j.period_month}`}>
              <span className="jokerinv__maand">
                {maandLabel(j.period_month.slice(0, 10))}
              </span>
              <span className="jokerinv__kaart">
                <span aria-hidden="true">{jokerIcoon(j.joker)}</span>{" "}
                {jokerLabel(j.joker)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default JokerInventaris;
