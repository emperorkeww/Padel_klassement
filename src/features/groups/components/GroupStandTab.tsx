import { useMemo, useState } from "react";
import { useAsync } from "@/lib/hooks/useAsync";
import { Sparkline } from "@/features/rating/components/Sparkline";
import { BountyMark } from "@/features/rating/components/BountyMark";
import { bountiesVoor } from "@/features/rating/bounty";
import { getActiveBounties } from "@/features/standings/bountyApi";
import { Podium } from "@/features/standings/components/Podium";
import { PageTabs } from "@/ui/PageTabs";
import { deltaToday } from "@/features/standings/ratingDelta";
import { useClub } from "@/features/availability/club";
import { TierBadge } from "@/features/rating/components/TierBadge";
import { Avatar } from "@/ui/Avatar";
import { ShareChampion } from "@/features/standings/components/ShareChampion";
import { displayName } from "@/features/profiles/api";
import { groupRatingStandings, playedInGroup } from "../groupRating";
import { bepaalPias, type MatchRatings } from "../maandpias";
import { monthRange } from "@/features/dashboard/missions";
import type { ZwartePietHolder } from "../zwartePietApi";
import { RivalryCard } from "./RivalryCard";
import { PiasCard } from "./PiasCard";
import { ZwartePietCard } from "./ZwartePietCard";
import type { PredictionStanding } from "@/features/matches/predictions";
import { seizoenEinddag, type Season } from "@/features/rating/seasons";
import { matchesInSeason } from "@/features/rating/standings";
import type {
  Group,
  GroupMember,
  Match,
  PlayerRating,
  PlayerStanding,
  Profile,
  RatingPoint,
  Team,
} from "@/types";

type StandMode = "rating" | "punten" | "toto";

const WEERGAVEN: { id: StandMode; label: string }[] = [
  { id: "rating", label: "Rating" },
  { id: "punten", label: "Punten" },
  { id: "toto", label: "Toto" },
];

interface GroupStandTabProps {
  matches: Match[];
  completedMatches: Match[];
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  ratings: Record<string, PlayerRating>;
  /** De rating per speler aan het eind van een gekozen afgesloten seizoen
   *  (#1298). Null = het lopende seizoen of "Alle tijden": dan is de rating
   *  van nu het antwoord. */
  seizoenRatings: Record<string, number> | null;
  histories: Record<string, RatingPoint[]>;
  memberList: GroupMember[];
  myId: string;
  season: Season | null;
  setSeasonId: (sid: string) => void;
  seasons: Season[];
  shownStandings: PlayerStanding[];
  champion: PlayerStanding | null;
  shownPredictionStandings: PredictionStanding[];
  group: Group;
  piasRatings: Map<string, MatchRatings>;
  zwartePiet: ZwartePietHolder | null;
}

export function GroupStandTab({
  matches,
  completedMatches,
  teams,
  profiles,
  ratings,
  seizoenRatings,
  histories,
  memberList,
  myId,
  season,
  setSeasonId,
  seasons,
  shownStandings,
  champion,
  shownPredictionStandings,
  group,
  piasRatings,
  zwartePiet,
}: GroupStandTabProps) {
  // Stand-tab: rating is de standaard (#52); de punten-weergave blijft als
  // toggle tot eendaagse tornooien (#124) die rol overnemen — dan kan hij weg.
  // "toto" = het voorspellersklassement (#116).
  const [standMode, setStandMode] = useState<StandMode>("rating");
  const club = useClub();

  // De Pias van de lopende maand (#167) — zelfde client-side afleiding als de
  // PiasCard, zodat 🤡 naast de naam en de kaart hetzelfde slachtoffer aanwijzen.
  const pias = useMemo(
    () => bepaalPias(completedMatches, teams, monthRange(new Date()), piasRatings),
    [completedMatches, teams, piasRatings],
  );

  // Bounty's (#805): de kroon van déze groep plus de troon (die geldt overal).
  // De waarde komt uit dezelfde view die de databank straks uitkeert, zodat het
  // getal naast de naam klopt met wat een claim oplevert.
  const bounties = useAsync(getActiveBounties, []);
  const bountyPools = useMemo(
    () => bountiesVoor(bounties.data ?? [], group.id),
    [bounties.data, group.id],
  );

  // Kijk je naar een afgesloten kwartaal, dan is de ratingstand die van tóén
  // (#1298). Eén variabele voor "welk seizoen kijken we terug", zodat de
  // renderkant niet twee dingen tegelijk hoeft te controleren.
  const toenSeizoen = season && seizoenRatings ? season : null;
  // Zelfde vorm als `ratings`, zodat groupRatingStandings er niets van hoeft te
  // weten. `games` blijft 0: hoeveel matches iemand tóén op de teller had staat
  // niet in deze bron, en een gok zou de gedimde ratings laten liegen. Gevolg:
  // in het historische beeld dimt niets en breekt de gelijkstand op naam.
  const toenRatings = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(seizoenRatings ?? {}).map(([pid, rating]) => [
          pid,
          { player_id: pid, rating, games: 0, updated_at: "" } as PlayerRating,
        ]),
      ),
    [seizoenRatings],
  );

  // Tekentjes naast de naam (#523, #805): enkel de emoji, betekenis via `title`.
  const marksFor = (playerId: string) => (
    <StandMarks
      piet={zwartePiet?.holderId === playerId}
      pias={pias?.playerId === playerId}
      bounty={bountyPools[playerId] ?? null}
    />
  );

  return (
    <>
      {/* Klassementtabel eerst; de roast/rivaliteit-kaarten staan eronder
          zodat de eigenlijke stand niet wegzakt onder gamification (#276). */}
      <section className="card">
        <div className="card__head">
          <h2 className="card__title card__title--tight">Groepsklassement</h2>
          {/* De seizoenskiezer stond binnen de punten- en toto-weergave, dus wie
              op de standaardweergave (rating) bleef, zag nooit dat er iets te
              bladeren viel — en de eregalerij eronder was daarmee onbereikbaar
              (#1298). Hij hoort boven de weergavekeuze: hij zegt wélke periode
              je bekijkt, de knoppenrij zegt hóe. */}
          {seasons.length > 0 && (
            <div className="stand-season">
              <select
                className="select select--filter"
                aria-label="Seizoen"
                value={season?.id ?? ""}
                onChange={(e) => setSeasonId(e.target.value)}
              >
                <option value="">Alle tijden</option>
                {season && !seasons.some((s) => s.id === season.id) && (
                  <option value={season.id}>{season.label}</option>
                )}
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Zag eruit als een tabbalk, gedroeg zich als een knoppenrij: geen
            aria-selected, geen pijltjestoetsen (#1298). PageTabs doet sinds
            #674 B2 precies dit, met `variant="segment"` sinds #1089. */}
        <PageTabs
          tabs={WEERGAVEN}
          value={standMode}
          onChange={setStandMode}
          ariaLabel="Standweergave"
          variant="segment"
        />

        {standMode === "rating" && (
          <>
            <p className="card__subtitle">
              {toenSeizoen ? (
                <>
                  Eindstand van <strong>{toenSeizoen.label}</strong> — de rating
                  zoals hij op {seizoenEinddag(toenSeizoen)} stond, en de
                  matches uit dat kwartaal.
                </>
              ) : (
                <>
                  Gesorteerd op rating — hoe vaak iemand speelt telt niet mee.
                  Gedimde ratings zijn op minder dan 3 matches gebouwd.
                </>
              )}
            </p>
            {(() => {
              // Een afgesloten seizoen toont de stand van tóén: de ratings van
              // de laatste dag van dat kwartaal, geteld over de matches uit dat
              // kwartaal (#1298). Zonder seizoen is de rating van nu het
              // antwoord — die loopt gewoon door.
              const played = playedInGroup(
                toenSeizoen
                  ? matchesInSeason(completedMatches, toenSeizoen)
                  : matches,
                teams,
              );
              const rows = groupRatingStandings(
                memberList.map((m) => m.player_id),
                toenSeizoen ? toenRatings : ratings,
                played,
                (pid) => displayName(profiles[pid]),
              );
              // Dag-cumulatieve ELO-beweging (#352), niet de laatste match. In
              // een afgesloten seizoen zegt "vandaag" niets over die stand, dus
              // dan geen pijltje en geen sparkline: die lopen door tot nu.
              const dayDelta = (pid: string) =>
                toenSeizoen ? null : deltaToday(histories[pid] ?? [], club.timezone);
              // Top 3 met rating op het podium; de tabel begint vanaf #4.
              const podium = rows.filter((r) => r.rating != null).slice(0, 3);
              const rest = rows.slice(podium.length);
              return (
                <>
                  <Podium
                    entries={podium.map((r) => ({
                      key: r.playerId,
                      name: displayName(profiles[r.playerId]),
                      markers: marksFor(r.playerId),
                      profile: profiles[r.playerId] ?? null,
                      link: `/spelers/${r.playerId}`,
                      isMe: r.playerId === myId,
                      rating: r.rating,
                      delta: dayDelta(r.playerId),
                      dimmed: r.thin,
                      tier: true,
                      // "18× in deze groep" wrapte in een podiumkolom van
                      // ~110px, en dan lijnden de drie tegels onderling niet
                      // meer uit (#1298). Kort genoeg voor één regel — dat je
                      // in deze groep kijkt, zegt de pagina al.
                      sub: `${r.playedInGroup}× gespeeld`,
                    }))}
                  />
                  {rest.length > 0 && (
                    <div className="table-scroll stand-tabel--rating">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Speler</th>
                            <th className="num">Rating</th>
                            <th className="num">Δ</th>
                            <th className="num">G</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rest.map((r, i) => {
                            const rank = i + 1 + podium.length;
                            const hist = histories[r.playerId] ?? [];
                            const delta = dayDelta(r.playerId);
                            return (
                              <tr
                                key={r.playerId}
                                className={`${r.playerId === myId ? "is-me" : ""}${r.thin ? " rating-thin" : ""}`}
                              >
                                <td>
                                  <span className="cell-player">
                                    <span className={`rank rank--${rank}`}>
                                      {rank}
                                    </span>
                                    <Avatar profile={profiles[r.playerId]} size={24} />
                                    {displayName(profiles[r.playerId])}
                                    {marksFor(r.playerId)}
                                  </span>
                                </td>
                                <td className="num">
                                  {r.rating != null ? (
                                    <span className="rating-wrap">
                                      <TierBadge
                                        rating={r.rating}
                                        dimmed={r.thin}
                                        size="sm"
                                      />
                                      <span className="rating-cell">
                                        <strong>{r.rating}</strong>
                                      </span>
                                      {!toenSeizoen && hist.length > 0 && (
                                        <Sparkline
                                          history={hist}
                                          name={displayName(profiles[r.playerId])}
                                        />
                                      )}
                                    </span>
                                  ) : (
                                    <span className="rating-none">
                                      nog geen matches
                                    </span>
                                  )}
                                </td>
                                <td className="num">
                                  {delta != null && delta !== 0 && (
                                    <span
                                      className={`stat__delta ${delta > 0 ? "is-up" : "is-down"}`}
                                    >
                                      {delta > 0 ? "▲" : "▼"}
                                      {Math.abs(delta)}
                                    </span>
                                  )}
                                </td>
                                <td className="num">{r.playedInGroup}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              );
            })()}
          </>
        )}

        {standMode === "punten" && champion && season && (
          <p className="champion-banner" role="status">
            <span className="champion-banner__cup" aria-hidden="true">
              🏆
            </span>
            <span>
              Kampioen {season.label}:{" "}
              <strong>{displayName(champion)}</strong>
            </span>
            <ShareChampion
              seasonLabel={season.label}
              rows={shownStandings.map((p) => ({
                name: displayName(p),
                points: p.points,
              }))}
            />
          </p>
        )}

        {standMode === "punten" && shownStandings.length === 0 && (
          <p className="empty">
            {season
              ? "Geen matches in dit seizoen."
              : "Nog geen afgeronde matches in deze groep."}
          </p>
        )}
        {standMode === "punten" && shownStandings.length > 0 && (
          <Podium
            entries={shownStandings.slice(0, 3).map((p) => ({
              key: p.player_id,
              name: displayName(p),
              markers: marksFor(p.player_id),
              profile: profiles[p.player_id] ?? p,
              link: `/spelers/${p.player_id}`,
              isMe: p.player_id === myId,
              rating: ratings[p.player_id]?.rating ?? null,
              dimmed:
                (ratings[p.player_id]?.games ?? 0) > 0 &&
                (ratings[p.player_id]?.games ?? 0) < 3,
              sub: `${p.points} ptn`,
              record: `${p.won}W · ${p.drawn ?? 0}G · ${p.lost}V`,
            }))}
          />
        )}
        {standMode === "punten" && shownStandings.length > 3 && (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Speler</th>
                  <th className="num">G</th>
                  <th className="num">W</th>
                  <th className="num">Saldo</th>
                  <th className="num">Ptn</th>
                </tr>
              </thead>
              <tbody>
                {shownStandings.slice(3).map((p, i) => (
                  <tr
                    key={p.player_id}
                    className={p.player_id === myId ? "is-me" : ""}
                  >
                    <td>
                      <span className="cell-player">
                        <span className={`rank rank--${i + 4}`}>{i + 4}</span>
                        <Avatar profile={profiles[p.player_id] ?? p} size={24} />
                        {displayName(p)}
                        {marksFor(p.player_id)}
                      </span>
                    </td>
                    <td className="num">{p.played}</td>
                    <td className="num">{p.won}</td>
                    <td className="num">
                      {p.goal_diff > 0 ? `+${p.goal_diff}` : p.goal_diff}
                    </td>
                    <td className="num">
                      <strong>{p.points}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {standMode === "toto" && (
          <>
            <p className="card__subtitle">
              Wie tipt de meeste winnaars? Een juiste tip levert 1–4 punten
              op — hoe kleiner de winkans, hoe meer punten.
            </p>
            {shownPredictionStandings.length === 0 && (
              <p className="empty">
                {season
                  ? "Geen beoordeelde tips in dit seizoen."
                  : "Nog geen tips in deze groep. Tip de winnaar op een geplande match!"}
              </p>
            )}
            {shownPredictionStandings.length > 0 && (
              <Podium
                entries={shownPredictionStandings.slice(0, 3).map((p) => ({
                  key: p.player_id,
                  name: displayName(p),
                  markers: marksFor(p.player_id),
                  profile: profiles[p.player_id] ?? p,
                  link: `/spelers/${p.player_id}`,
                  isMe: p.player_id === myId,
                  rating: p.points,
                  sub: `${p.correct}/${p.predicted} juist`,
                }))}
              />
            )}
            {shownPredictionStandings.length > 3 && (
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Speler</th>
                      <th className="num">Getipt</th>
                      <th className="num">Juist</th>
                      <th className="num">Ptn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownPredictionStandings.slice(3).map((p, i) => (
                      <tr
                        key={p.player_id}
                        className={p.player_id === myId ? "is-me" : ""}
                      >
                        <td>
                          <span className="cell-player">
                            <span className={`rank rank--${i + 4}`}>{i + 4}</span>
                            <Avatar profile={profiles[p.player_id] ?? p} size={24} />
                            {displayName(p)}
                            {marksFor(p.player_id)}
                          </span>
                        </td>
                        <td className="num">{p.predicted}</td>
                        <td className="num">{p.correct}</td>
                        <td className="num">
                          <strong>{p.points}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      {/* Vendetta's staan sinds #524 bij het spelen zelf (Vandaag-tab). */}
      <RivalryCard
        matches={matches}
        teams={teams}
        profiles={profiles}
      />
      <PiasCard
        matches={completedMatches}
        teams={teams}
        profiles={profiles}
        ratingsByMatch={piasRatings}
        intensiteit={group.roast_intensiteit ?? "radioactief"}
      />
      <ZwartePietCard piet={zwartePiet} group={group} profiles={profiles} />
    </>
  );
}

/** 🃏 Zwarte Piet-drager, 🤡 Pias en/of 🎯 bounty naast een naam (#523, #805).
 *  Enkel het tekentje; de betekenis zit in het `title`. */
function StandMarks({
  piet,
  pias,
  bounty,
}: {
  piet: boolean;
  pias: boolean;
  /** Wat er op het hoofd van deze speler staat; null = geen bounty. */
  bounty: number | null;
}) {
  if (!piet && !pias && bounty == null) return null;
  return (
    <>
      <BountyMark pool={bounty} />
      {piet && (
        <span className="stand-mark" title="Draagt de Zwarte Piet" aria-hidden="true">
          🃏
        </span>
      )}
      {pias && (
        <span className="stand-mark" title="Pias van de maand" aria-hidden="true">
          🤡
        </span>
      )}
    </>
  );
}
