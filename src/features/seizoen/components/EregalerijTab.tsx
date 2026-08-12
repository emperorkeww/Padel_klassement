// Eregalerij-tab (#711): de permanente geschiedenis van een groep. Per
// afgesloten kwartaal de kampioen, het podium, de Pias van dat seizoen en de
// medaille-uitreiking (#713), en eronder het recordboek van de groep. Alle
// cijfers komen uit de pure modules ernaast (eregalerij.ts, records.ts,
// awards.ts); dit bestand doet alleen de weergave.
//
// De data is dezelfde die de groepspagina al geladen heeft — geen extra query.
// De afleiding is wél zwaar (elke afgesloten kwartaalstand + de pias en de
// awards per kwartaal), dus GroupDetail hangt de tab achter dezelfde lazy-poort
// als de Stand-tab (#674 C2) en dit component rekent in useMemo.
//
// Vormgeving: alles wat aanklikbaar is, is een héle rij of tegel — nooit een
// los onderstreept woord. Dat volgt de rest van de app (podium__spot,
// person-row, stat-tegels) en houdt de galerij een galerij in plaats van een
// lijst hyperlinks. Acties staan als knoppen onderaan de seizoenskaart.

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "@/ui/Avatar";
import { displayName } from "@/features/profiles/api";
import { ShareChampion } from "@/features/standings/components/ShareChampion";
import { ShareAwards } from "@/features/seizoen/components/ShareAwards";
import { eregalerij } from "@/features/seizoen/eregalerij";
import { groepsRecords } from "@/features/seizoen/records";
import type { MatchRatings } from "@/features/groups/maandpias";
import type { Match, PlayerStanding, Profile, RatingPoint, Team } from "@/types";
import "./Eregalerij.css";

/** 🥇🥈🥉 voor de eerste drie; daarna geen medaille meer. */
const MEDAILLES = ["🥇", "🥈", "🥉"];
/** Plaats-label naast de medaille, voor wie de emoji niet ziet. */
const PLAATSEN = ["Kampioen", "Tweede", "Derde"];

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
  histories,
  groepsnaam,
  myId,
  now,
  seizoenId,
}: {
  /** Alle matches van de groep (ruwe lijst; niet-afgeronde vallen zelf weg). */
  matches: Match[];
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  /** Pre-match ratings voor de choke-detectie van de pias (optioneel). */
  ratingsByMatch?: Map<string, MatchRatings>;
  /** Rating-historie per speler; voedt twee awards (#713). */
  histories?: Record<string, RatingPoint[]>;
  /** Groepsnaam op de gala-poster. */
  groepsnaam: string;
  myId: string;
  /** Injecteerbaar voor tests; anders de klok. */
  now?: Date;
  /**
   * Eén seizoen tonen in plaats van de hele galerij (#1216).
   *
   * Sinds de eregalerij op de Stand-tab woont, hoort wat eronder staat bij de
   * stand die je gekozen hebt: zeven seizoenskaarten onder één eindstand zou
   * over iets anders gaan dan de tabel erboven. Zonder deze prop blijft het de
   * volledige galerij — dezelfde component, twee plekken.
   */
  seizoenId?: string;
}) {
  const alleSeizoenen = useMemo(
    () => eregalerij({ matches, teams, profiles, ratingsByMatch, histories, now }),
    [matches, teams, profiles, ratingsByMatch, histories, now],
  );
  const seizoenen = useMemo(
    () =>
      seizoenId
        ? alleSeizoenen.filter((s) => s.season.id === seizoenId)
        : alleSeizoenen,
    [alleSeizoenen, seizoenId],
  );
  const records = useMemo(
    () => groepsRecords(matches, teams, profiles),
    [matches, teams, profiles],
  );

  const naamVan = (id: string) => displayName(profiles[id]);
  /** Speelde de kijker mee in dit kwartaal? Gate voor de Wrapped-knop (#712).
   *  Gemeten binnen déze groep — buiten de groep kunnen er meer matches zijn,
   *  maar dan is de ingang hoogstens ergens anders óók te vinden. */
  const ikSpeeldeIn = (standings: PlayerStanding[]) =>
    standings.some((p) => p.player_id === myId);

  return (
    <div className="eregalerij">
      {seizoenen.length === 0 ? (
        <section className="card">
          <h2 className="card__title">🏆 Eregalerij</h2>
          <p className="empty">
            {seizoenId
              ? "In dit seizoen is er niet gespeeld, dus er valt niets te vieren."
              : "Nog geen afgesloten seizoen. Zodra het kwartaal om is, komt de kampioen hier voor altijd te staan."}
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
                <h2 className="card__title card__title--tight">{s.naam.label}</h2>
                <span className="badge eregalerij-seizoen__meta">
                  {s.season.label} ·{" "}
                  {s.gespeeld === 1 ? "1 match" : `${s.gespeeld} matches`}
                </span>
              </div>

              <ol className="eregalerij-podium">
                {podium.map((p, i) => (
                  <li key={p.player_id}>
                    {/* De héle rij is de link, zoals podium__spot — geen los
                        onderstreept woord in een galerij. */}
                    <Link
                      className={`eregalerij-podium__rij${i === 0 ? " eregalerij-podium__rij--kampioen" : ""}`}
                      to={`/spelers/${p.player_id}`}
                    >
                      <span className="eregalerij-podium__medaille" aria-hidden="true">
                        {MEDAILLES[i]}
                      </span>
                      <Avatar
                        profile={profiles[p.player_id] ?? p}
                        size={i === 0 ? 44 : 36}
                      />
                      <span className="eregalerij-podium__body">
                        <span className="eregalerij-podium__naam">
                          {naamVan(p.player_id)}
                          {p.player_id === myId && (
                            <span className="badge badge--accent">jij</span>
                          )}
                        </span>
                        <span className="eregalerij-podium__plaats">
                          {PLAATSEN[i]}
                        </span>
                      </span>
                      <span className="eregalerij-podium__punten">
                        <span className="eregalerij-podium__punten-getal">
                          {p.points}
                        </span>
                        <span className="eregalerij-podium__punten-label">ptn</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>

              {pias && (
                <Link
                  className={`eregalerij-pias${beschermd ? " eregalerij-pias--schild" : ""}`}
                  to={`/spelers/${pias.playerId}`}
                >
                  <span className="eregalerij-pias__emoji" aria-hidden="true">
                    {beschermd ? "📊" : "🤡"}
                  </span>
                  <Avatar profile={profiles[pias.playerId]} size={36} />
                  <span className="eregalerij-pias__body">
                    <span className="eregalerij-pias__label">
                      {beschermd ? "Opvallend seizoen" : "Pias van het seizoen"}
                    </span>
                    <span className="eregalerij-pias__naam">
                      {naamVan(pias.playerId)}
                    </span>
                    <span className="eregalerij-pias__detail">
                      {beschermd
                        ? "Geen roast: het roast-schild staat aan."
                        : pias.detail}
                    </span>
                  </span>
                </Link>
              )}

              {s.awards.length > 0 && (
                <div className="eregalerij-awards">
                  <h3 className="eregalerij-kop">🏅 Uitreiking</h3>
                  <ul className="eregalerij-awards__lijst">
                    {s.awards.map((a) => (
                      <li key={a.id}>
                        <Link
                          className={`eregalerij-award${a.id === "pias" ? " eregalerij-award--schande" : ""}`}
                          to={`/spelers/${a.playerId}`}
                        >
                          <span className="eregalerij-award__emoji" aria-hidden="true">
                            {a.emoji}
                          </span>
                          <span className="eregalerij-award__body">
                            <span className="eregalerij-award__titel">{a.titel}</span>
                            <span className="eregalerij-award__naam">
                              {naamVan(a.playerId)}
                            </span>
                            <span className="eregalerij-award__detail">
                              {a.detail}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Acties als knoppen onderaan de kaart: delen en het
                  persoonlijke kwartaal-Wrapped (#712), dat op je eigen profiel
                  opent omdat het over ál je matches gaat — niet enkel die van
                  deze groep. */}
              <div className="eregalerij-acties">
                {ikSpeeldeIn(s.standings) && (
                  <Link
                    className="btn btn--sm"
                    to={`/spelers/${myId}?wrapped=${s.season.id}`}
                  >
                    🎬 Jouw {s.naam.naam} Wrapped
                  </Link>
                )}
                <ShareChampion
                  seasonLabel={s.naam.titel}
                  rows={s.standings.map((p: PlayerStanding) => ({
                    name: naamVan(p.player_id),
                    points: p.points,
                  }))}
                />
                {s.awards.length > 0 && (
                  <ShareAwards
                    groepsnaam={groepsnaam}
                    seizoen={s.naam.label}
                    awards={s.awards}
                    naam={naamVan}
                  />
                )}
              </div>
            </section>
          );
        })
      )}

      {records.length > 0 && (
        <section className="card">
          <div className="card__head">
            <h2 className="card__title card__title--tight">📖 Recordboek</h2>
            <span className="badge">alle seizoenen</span>
          </div>
          <ul className="eregalerij-records">
            {records.map((r) => {
              const datum = recordDatum(r.datum);
              const houders = r.houders.map(naamVan).join(" & ");
              // De tegel linkt naar de match die het record vestigde; de
              // houders staan als tekst (de spelers zijn via podium en
              // uitreiking al aanklikbaar).
              const inhoud = (
                <>
                  <span className="eregalerij-record__label">
                    <span aria-hidden="true">{r.emoji}</span> {r.titel}
                  </span>
                  <span className="eregalerij-record__waarde">{r.detail}</span>
                  <span className="eregalerij-record__houder">
                    {houders}
                    {datum && (
                      <span className="eregalerij-record__datum"> · {datum}</span>
                    )}
                  </span>
                </>
              );
              return (
                <li key={r.id}>
                  {r.matchId ? (
                    <Link className="eregalerij-record" to={`/matches/${r.matchId}`}>
                      {inhoud}
                    </Link>
                  ) : (
                    <div className="eregalerij-record">{inhoud}</div>
                  )}
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
