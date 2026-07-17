import { useState } from "react";
import { Sparkline } from "@/features/rating/components/Sparkline";
import { Podium } from "@/features/standings/components/Podium";
import { deltaToday } from "@/features/standings/ratingDelta";
import { useClub } from "@/features/availability/club";
import { TierBadge } from "@/features/rating/components/TierBadge";
import { Avatar } from "@/ui/Avatar";
import { ShareChampion } from "@/features/standings/components/ShareChampion";
import { displayName } from "@/features/profiles/api";
import { groupRatingStandings, playedInGroup } from "../groupRating";
import type { MatchRatings } from "../maandpias";
import type { ZwartePietHolder } from "../zwartePietApi";
import { RivalryCard } from "./RivalryCard";
import { VendettaCard } from "./VendettaCard";
import { PiasCard } from "./PiasCard";
import { ZwartePietCard } from "./ZwartePietCard";
import type { PredictionStanding } from "@/features/matches/predictions";
import type { Season } from "@/features/rating/seasons";
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

interface GroupStandTabProps {
  matches: Match[];
  completedMatches: Match[];
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  ratings: Record<string, PlayerRating>;
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
  const [standMode, setStandMode] = useState<"rating" | "punten" | "toto">(
    "rating",
  );
  const club = useClub();

  return (
    <>
      {/* Klassementtabel eerst; de roast/rivaliteit-kaarten staan eronder
          zodat de eigenlijke stand niet wegzakt onder gamification (#276). */}
      <section className="card">
        <div className="card__head">
          <h2 className="card__title card__title--tight">Groepsklassement</h2>
          <div className="tabs tabs--head" role="group" aria-label="Klassement-weergave">
            <button
              className={`tab ${standMode === "rating" ? "is-active" : ""}`}
              onClick={() => setStandMode("rating")}
            >
              Rating
            </button>
            <button
              className={`tab ${standMode === "punten" ? "is-active" : ""}`}
              onClick={() => setStandMode("punten")}
            >
              Punten
            </button>
            <button
              className={`tab ${standMode === "toto" ? "is-active" : ""}`}
              onClick={() => setStandMode("toto")}
            >
              Toto
            </button>
          </div>
        </div>

        {standMode === "rating" && (
          <>
            <p className="card__subtitle">
              Gesorteerd op rating — hoe vaak iemand speelt telt niet mee.
              Gedimde ratings zijn op minder dan 3 matches gebouwd.
            </p>
            {(() => {
              const played = playedInGroup(matches, teams);
              const rows = groupRatingStandings(
                memberList.map((m) => m.player_id),
                ratings,
                played,
                (pid) => displayName(profiles[pid]),
              );
              // Dag-cumulatieve ELO-beweging (#352), niet de laatste match.
              const dayDelta = (pid: string) =>
                deltaToday(histories[pid] ?? [], club.timezone);
              // Top 3 met rating op het podium; de tabel begint vanaf #4.
              const podium = rows.filter((r) => r.rating != null).slice(0, 3);
              const rest = rows.slice(podium.length);
              return (
                <>
                  <Podium
                    entries={podium.map((r) => ({
                      key: r.playerId,
                      name: displayName(profiles[r.playerId]),
                      profile: profiles[r.playerId] ?? null,
                      link: `/spelers/${r.playerId}`,
                      isMe: r.playerId === myId,
                      rating: r.rating,
                      delta: dayDelta(r.playerId),
                      dimmed: r.thin,
                      tier: true,
                      sub: `${r.playedInGroup}× in deze groep`,
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
                                      {hist.length > 0 && (
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
                                  {delta !== 0 && (
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

        {standMode !== "rating" && seasons.length > 0 && (
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

      <VendettaCard
        group={group}
        matches={matches}
        teams={teams}
        profiles={profiles}
        memberList={memberList}
        myId={myId}
      />
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
        intensiteit={group.roast_intensiteit ?? "gemeen"}
      />
      {zwartePiet && (
        <ZwartePietCard piet={zwartePiet} group={group} profiles={profiles} />
      )}
    </>
  );
}
