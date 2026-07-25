// Eregalerij-tab (#711): de permanente geschiedenis van een groep. Per
// afgesloten kwartaal de kampioen, het podium en de Pias van dat seizoen, en
// eronder het recordboek van de groep. Alle cijfers komen uit de pure modules
// ernaast (eregalerij.ts, records.ts); dit bestand doet alleen de weergave.
//
// De data is dezelfde die de groepspagina al geladen heeft — geen extra query.
// De afleiding is wél zwaar (elke afgesloten kwartaalstand + de pias per
// kwartaal), dus GroupDetail hangt de tab achter dezelfde lazy-poort als de
// Stand-tab (#674 C2) en dit component rekent in useMemo.

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "@/ui/Avatar";
import { displayName } from "@/features/profiles/api";
import { ShareChampion } from "@/features/standings/components/ShareChampion";
import { eregalerij } from "@/features/seizoen/eregalerij";
import { groepsRecords } from "@/features/seizoen/records";
import type { MatchRatings } from "@/features/groups/maandpias";
import type { Match, PlayerStanding, Profile, Team } from "@/types";
import "./Eregalerij.css";

/** 🥇🥈🥉 voor de eerste drie; daarna geen medaille meer. */
const MEDAILLES = ["🥇", "🥈", "🥉"];

/** Bv. "14 mrt 2026" — mét jaar: een recordboek reikt over seizoenen heen. */
function recordDatum(dag: string | null): string | null {
  if (!dag) return null;
  const d = new Date(dag);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function EregalerijTab({
  matches,
  teams,
  profiles,
  ratingsByMatch,
  myId,
  now,
}: {
  /** Alle matches van de groep (ruwe lijst; niet-afgeronde vallen zelf weg). */
  matches: Match[];
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  /** Pre-match ratings voor de choke-detectie van de pias (optioneel). */
  ratingsByMatch?: Map<string, MatchRatings>;
  myId: string;
  /** Injecteerbaar voor tests; anders de klok. */
  now?: Date;
}) {
  const seizoenen = useMemo(
    () => eregalerij({ matches, teams, profiles, ratingsByMatch, now }),
    [matches, teams, profiles, ratingsByMatch, now],
  );
  const records = useMemo(
    () => groepsRecords(matches, teams, profiles),
    [matches, teams, profiles],
  );

  const naamVan = (id: string) => displayName(profiles[id]);
  const isIk = (id: string) => id === myId;

  return (
    <div className="eregalerij">
      {seizoenen.length === 0 ? (
        <section className="card">
          <h2 className="card__title">🏆 Eregalerij</h2>
          <p className="empty">
            Nog geen afgesloten seizoen. Zodra het kwartaal om is, komt de
            kampioen hier voor altijd te staan.
          </p>
        </section>
      ) : (
        seizoenen.map((s) => {
          const podium = s.standings.slice(0, 3);
          const pias = s.pias;
          const beschermd = pias
            ? (profiles[pias.playerId]?.roast_schild ?? false)
            : false;
          return (
            <section className="card eregalerij-seizoen" key={s.season.id}>
              <div className="card__head">
                <h2 className="card__title">{s.naam.label}</h2>
                <ShareChampion
                  seasonLabel={s.naam.titel}
                  rows={s.standings.map((p: PlayerStanding) => ({
                    name: naamVan(p.player_id),
                    points: p.points,
                  }))}
                />
              </div>
              <p className="eregalerij-seizoen__meta">
                {s.gespeeld === 1 ? "1 match" : `${s.gespeeld} matches`} ·{" "}
                {s.season.label}
              </p>

              <ol className="eregalerij-podium">
                {podium.map((p, i) => (
                  <li
                    className={`eregalerij-podium__rij${i === 0 ? " eregalerij-podium__rij--kampioen" : ""}`}
                    key={p.player_id}
                  >
                    <span className="eregalerij-podium__medaille" aria-hidden="true">
                      {MEDAILLES[i]}
                    </span>
                    <Avatar profile={profiles[p.player_id] ?? p} size={i === 0 ? 44 : 32} />
                    <Link className="eregalerij-podium__naam" to={`/spelers/${p.player_id}`}>
                      {naamVan(p.player_id)}
                      {isIk(p.player_id) && (
                        <span className="badge badge--accent eregalerij-podium__ik">jij</span>
                      )}
                    </Link>
                    <span className="eregalerij-podium__punten">
                      {i === 0 && (
                        <span className="eregalerij-podium__titel">Kampioen</span>
                      )}
                      {p.points} ptn
                    </span>
                  </li>
                ))}
              </ol>

              {pias && (
                <p className="eregalerij-pias">
                  <span aria-hidden="true">{beschermd ? "📊" : "🤡"}</span>{" "}
                  {beschermd ? (
                    <>
                      Opvallend seizoen voor{" "}
                      <Link to={`/spelers/${pias.playerId}`}>{naamVan(pias.playerId)}</Link>.
                      Geen roast: het roast-schild staat aan.
                    </>
                  ) : (
                    <>
                      <strong>Pias van het seizoen:</strong>{" "}
                      <Link to={`/spelers/${pias.playerId}`}>{naamVan(pias.playerId)}</Link>{" "}
                      — {pias.detail}
                    </>
                  )}
                </p>
              )}
            </section>
          );
        })
      )}

      {records.length > 0 && (
        <section className="card">
          <h2 className="card__title">📖 Recordboek</h2>
          <p className="eregalerij-seizoen__meta">
            De eeuwige records van deze groep, over alle seizoenen heen.
          </p>
          <ul className="eregalerij-records">
            {records.map((r) => {
              const datum = recordDatum(r.datum);
              return (
                <li className="eregalerij-record" key={r.id}>
                  <span className="eregalerij-record__emoji" aria-hidden="true">
                    {r.emoji}
                  </span>
                  <span className="eregalerij-record__body">
                    <span className="eregalerij-record__titel">{r.titel}</span>
                    <span className="eregalerij-record__houder">
                      {r.houders.map((id, i) => (
                        <span key={id}>
                          {i > 0 && " & "}
                          <Link to={`/spelers/${id}`}>{naamVan(id)}</Link>
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className="eregalerij-record__waarde">
                    {r.matchId ? (
                      <Link to={`/matches/${r.matchId}`}>{r.detail}</Link>
                    ) : (
                      r.detail
                    )}
                    {datum && (
                      <span className="eregalerij-record__datum">{datum}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

export default EregalerijTab;
