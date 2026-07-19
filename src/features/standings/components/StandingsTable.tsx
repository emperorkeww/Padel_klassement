import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "@/ui/Avatar";
import { CountUp } from "@/ui/CountUp";
import { FormChips } from "@/features/rating/components/FormChips";
import { Sparkline } from "@/features/rating/components/Sparkline";
import { TierBadge } from "@/features/rating/components/TierBadge";
import { useFlip } from "@/lib/hooks/useFlip";
import { winRate } from "@/features/rating/results";
import { byRank } from "@/features/rating/standings";
import { THIN_GAMES } from "@/features/groups/groupRating";
import { ShiftBadge } from "./ShiftBadge";
import { SortableTh } from "./SortableTh";
import {
  primeAvatarMorph,
  sortValue,
  type Row,
  type SortKey,
  type SortState,
} from "../leaderboardHelpers";

export function StandingsTable({
  rows,
  showForm,
  meRef,
}: {
  rows: Row[];
  showForm: boolean;
  meRef?: React.Ref<HTMLTableRowElement>;
}) {
  // Sortering is client-side: de aangeleverde volgorde (spelers op rating,
  // teams op punten) is de standaard; klikken op een kolomkop hersorteert
  // lokaal, met de klassement-tie-break als tweede sleutel zodat gelijke
  // waarden hun canonieke volgorde houden.
  const [sort, setSort] = useState<SortState | null>(null);
  const onSort = (key: SortKey) =>
    setSort((s) =>
      s && s.key === key
        ? { key, dir: s.dir === "desc" ? "asc" : "desc" }
        : { key, dir: "desc" },
    );

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const factor = sort.dir === "asc" ? -1 : 1;
    return [...rows].sort((a, b) => {
      const diff = sortValue(b, sort.key) - sortValue(a, sort.key);
      const base =
        diff !== 0
          ? diff
          : byRank(
              { points: a.points, goal_diff: a.goalDiff, won: a.won },
              { points: b.points, goal_diff: b.goalDiff, won: b.won },
            );
      return factor * base;
    });
  }, [rows, sort]);

  const flipRef = useFlip<HTMLTableSectionElement>(
    sortedRows.map((r) => r.key).join("|"),
  );
  return (
    <div className="table-scroll leaderboard-table">
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: "2rem" }}>#</th>
            <th>Naam</th>
            {showForm && <th>Vorm</th>}
            <th className="num col-played">Gespeeld</th>
            <th className="num" aria-label="Winst · gelijk · verlies">
              W·G·V
            </th>
            <SortableTh
              label="Win%"
              sortKey="winrate"
              sort={sort}
              onSort={onSort}
              title="Winstpercentage"
            />
            <SortableTh
              label="Saldo"
              sortKey="saldo"
              sort={sort}
              onSort={onSort}
              className="col-saldo"
            />
            <SortableTh
              label="Punten"
              sortKey="points"
              sort={sort}
              onSort={onSort}
            />
            {showForm && (
              <SortableTh
                label="Rating"
                sortKey="rating"
                sort={sort}
                onSort={onSort}
                title="Elo-rating: iedereen start op 1000 en stijgt of daalt na elke match op basis van de sterkte van de tegenstander."
              />
            )}
          </tr>
        </thead>
        <tbody ref={flipRef}>
          {sortedRows.map((r, i) => {
            const rate = winRate(r.won, r.played);
            return (
              <tr
                key={r.key}
                data-flip-key={r.key}
                ref={r.isMe ? meRef : undefined}
                className={r.isMe ? "is-me" : ""}
              >
                <td>
                  <span className="rank-wrap">
                    <span className={`rank rank--${r.rank ?? i + 1}`}>
                      {r.rank ?? i + 1}
                    </span>
                    <ShiftBadge shift={r.shift} />
                  </span>
                </td>
                <td>
                  <span className="cell-player">
                    <Avatar profile={r.profile} name={r.name} size={26} />
                    {r.link ? (
                      <Link
                        className="profile-link"
                        to={r.link}
                        viewTransition
                        onClick={primeAvatarMorph}
                      >
                        {r.name}
                      </Link>
                    ) : (
                      r.name
                    )}
                    {r.isMe && <span className="badge badge--accent">jij</span>}
                  </span>
                </td>
                {showForm && (
                  <td>
                    {r.form.length > 0 ? (
                      <FormChips form={r.form} size="sm" />
                    ) : (
                      <span className="empty empty--bare">—</span>
                    )}
                  </td>
                )}
                <td className="num col-played">{r.played}</td>
                <td
                  className="num record-cell"
                  aria-label={`${r.won} winst, ${r.drawn} gelijk, ${r.lost} verlies`}
                >
                  <span className="record-cell__won">{r.won}</span>·{r.drawn}·
                  {r.lost}
                </td>
                <td className="num">
                  {rate != null ? (
                    <span className="winrate">
                      <span className="winrate__bar">
                        <span
                          className="winrate__fill"
                          style={{ width: `${rate}%` }}
                        />
                      </span>
                      {rate}%
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="num col-saldo">
                  {r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}
                </td>
                <td className="num">
                  <span className={showForm ? "pts-cell pts-cell--sub" : "pts-cell"}>
                    {showForm ? r.points : <CountUp value={r.points} />}
                  </span>
                </td>
                {showForm && (
                  <td className="num">
                    <span className="rating-wrap">
                      <TierBadge
                        rating={r.rating}
                        dimmed={r.games > 0 && r.games < THIN_GAMES}
                        size="sm"
                        capDictator
                      />
                      {r.rating != null ? (
                        <span className="rating-cell rating-cell--lead">
                          <CountUp value={r.rating} />
                        </span>
                      ) : (
                        "—"
                      )}
                      {r.history.length > 0 && (
                        <Sparkline history={r.history} name={r.name} />
                      )}
                    </span>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}