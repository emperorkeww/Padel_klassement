import { Sheet } from "@/ui/Sheet";
import { Sparkline } from "@/features/rating/components/Sparkline";
import { tierFor } from "@/features/rating/tiers";
import type { Row } from "../leaderboardHelpers";
import {
  getNearestCompetitors,
  rankShiftLabel,
  type RacePack,
} from "../raceUtils";

// Spelersdetails op de race (#1241): het gedeelde Sheet-patroon in plaats van
// de oude CSS-tooltip — Escape, backdrop-tik, focus-terugkeer en omlaag vegen
// komen gratis mee. Zelfde inhoud als de tooltip, plus het ratingverloop.
export function RaceDetailSheet({
  row,
  pack,
  onClose,
}: {
  row: (Row & { rating: number }) | null;
  pack: RacePack | null;
  onClose: () => void;
}) {
  if (!row) return null;

  const tier = tierFor(row.rating);
  const latestDay = row.history
    .map((point) => point.played_at.slice(0, 10))
    .sort()
    .at(-1);
  const dayDelta = latestDay
    ? row.history
        .filter((point) => point.played_at.slice(0, 10) === latestDay)
        .reduce((sum, point) => sum + point.delta, 0)
    : null;
  const competitorAbove = getNearestCompetitors(pack?.rows ?? [row], row.key).above;
  const previousRank =
    typeof row.shift === "number" && row.rank != null ? row.rank + row.shift : null;
  const shiftLabel = rankShiftLabel(row, previousRank);
  const packGaps = pack
    ? pack.rows
        .filter((competitor) => competitor.key !== row.key && competitor.rating != null)
        .map(
          (competitor) =>
            `${Math.abs(row.rating - (competitor.rating ?? row.rating))} t.o.v. ${competitor.name}`,
        )
        .join(" · ")
    : null;

  return (
    <Sheet open onClose={onClose} title={row.name} compact className="race-detail">
      <div className="race-detail__body">
        <p className="race-detail__stand">
          <strong>#{row.rank}</strong> · {row.rating} rating
          {tier && (
            <>
              {" · "}
              {tier.emoji} {tier.label}
            </>
          )}
        </p>
        <ul className="race-detail__feiten">
          {dayDelta != null && dayDelta !== 0 && (
            <li>
              {dayDelta > 0 ? "+" : ""}
              {dayDelta} op de laatste speeldag
            </li>
          )}
          {shiftLabel && (
            <li>
              {previousRank != null && row.rank != null
                ? `Van #${previousRank} naar #${row.rank} sinds vorige speeldag`
                : `${shiftLabel} sinds vorige speeldag`}
            </li>
          )}
          {competitorAbove && (
            <li>
              {competitorAbove.gap} rating achter {competitorAbove.row.name}
            </li>
          )}
          {packGaps && (
            <li>
              Gevecht om plaats #{pack!.startRank}–#{pack!.endRank}: {packGaps}
            </li>
          )}
          {row.form.length > 0 && <li>Vorm: {row.form.join(" · ")}</li>}
        </ul>
        {row.history.length > 0 && (
          <div className="race-detail__verloop">
            <Sparkline history={row.history} name={row.name} />
          </div>
        )}
      </div>
    </Sheet>
  );
}
