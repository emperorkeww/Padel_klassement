import type { Shift } from "@/features/rating/rankShift";

/** ▲2 / ▼1 / "nieuw" onder het rangnummer; niets bij een gelijke positie. */
export function ShiftBadge({ shift }: { shift?: Shift }) {
  if (shift == null || shift === 0) return null;
  if (shift === "nieuw")
    return <span className="rankshift rankshift--new">nieuw</span>;
  return (
    <span className={`rankshift ${shift > 0 ? "is-up" : "is-down"}`}>
      {shift > 0 ? `▲${shift}` : `▼${-shift}`}
    </span>
  );
}
