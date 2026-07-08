import { useMemo, useState } from "react";
import { useAsync } from "../../lib/useAsync";
import { useRealtime } from "../../lib/useRealtime";
import { useToast } from "../../components/ToastProvider";
import { errorMessage } from "../../lib/errors";
import { addDays, dateInZone } from "../../lib/time";
import { getWeekAvailability, bookingUrl, type WeekDay } from "../availability/api";
import { useClub } from "../availability/club";
import { displayName } from "../profiles/api";
import { shareOrCopyText } from "../../lib/shareText";
import {
  getGroupSlotVotes,
  setSlotVote,
  clearSlotVote,
  type SlotStatus,
  type SlotVote,
} from "./planApi";
import {
  buildPlanGrid,
  bestPlanMoments,
  cellKey,
  isFeasible,
  type PlanCell,
} from "./planGrid";
import type { GroupMember, Profile } from "../../lib/types";
import "./PlanTogether.css";

// "Plan samen": elk groepslid tikt per tijdslot aan of het kan; live gecombineerd
// met de vrije banen (Playtomic) wijst de app het beste moment aan om te boeken.

const DURATION_FILTERS = [null, 60, 90, 120] as const;

// 's Middags formatteren zodat DST de datum niet kantelt.
function fmtDate(date: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("nl-BE", opts).format(new Date(`${date}T12:00:00`));
}
const shortDay = (date: string) =>
  fmtDate(date, { weekday: "short", day: "numeric", month: "short" });

// Tint-klasse per aantal vrije banen (0..4+).
function heatClass(n: number): string {
  return `plan-cell--c${Math.min(n, 4)}`;
}

export function PlanTogether({
  groupId,
  members,
  profiles,
  myId,
}: {
  groupId: string;
  members: GroupMember[];
  profiles: Record<string, Profile>;
  myId: string;
}) {
  const club = useClub();
  const today = dateInZone(club.timezone);
  const toast = useToast();

  const [weekStart, setWeekStart] = useState(today);
  const [duration, setDuration] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const week = useAsync<WeekDay[]>(
    () => getWeekAvailability(weekStart),
    [weekStart, club.id],
  );
  const votes = useAsync<SlotVote[]>(
    () => getGroupSlotVotes(groupId, weekStart),
    [groupId, weekStart],
  );
  // Live: een stem van een ander lid werkt het raster meteen bij.
  useRealtime("slot_availability", votes.reload, `group_id=eq.${groupId}`);

  const grid = useMemo(
    () => buildPlanGrid(week.data ?? [], votes.data ?? [], duration),
    [week.data, votes.data, duration],
  );
  const best = useMemo(() => bestPlanMoments(grid, 3), [grid]);

  // Mijn eigen status per slot, om het snel in het raster te markeren.
  const myStatus = useMemo(() => {
    const map = new Map<string, SlotStatus>();
    for (const v of votes.data ?? []) {
      if (v.player_id === myId) map.set(cellKey(v.date, v.start_time), v.status);
    }
    return map;
  }, [votes.data, myId]);

  const name = (id: string) => displayName(profiles[id]);
  const memberCount = members.length;

  function shiftWeek(days: number) {
    const next = addDays(weekStart, days);
    setWeekStart(next < today ? today : next);
    setSelected(null);
  }

  async function vote(cell: PlanCell, status: SlotStatus | null) {
    setSaving(true);
    try {
      if (status === null) {
        await clearSlotVote(groupId, myId, cell.date, cell.time);
      } else {
        await setSlotVote(groupId, myId, cell.date, cell.time, status);
      }
      votes.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function sharePlan() {
    const lines = [`🎾 Plan volgende week — ${club.name}`, ""];
    if (best.length === 0) {
      lines.push("Nog geen beschikbaarheid ingevuld — geef aan wanneer je kan!");
    } else {
      lines.push("🏆 Beste momenten:");
      best.forEach((c, i) => {
        lines.push(
          `${i + 1}) ${shortDay(c.date)} ${c.time} — ${c.yes.length} kunnen · ${c.courtsFree} ${c.courtsFree === 1 ? "baan" : "banen"} vrij`,
        );
      });
    }
    try {
      const outcome = await shareOrCopyText({
        title: `Plan — ${club.name}`,
        text: lines.join("\n"),
      });
      if (outcome === "clipboard") toast.success("Tekst gekopieerd naar klembord.");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error(errorMessage(err));
    }
  }

  const selectedCell = selected ? (grid.cells.get(selected) ?? null) : null;
  const bestKeys = new Set(
    best.filter(isFeasible).map((c) => cellKey(c.date, c.time)),
  );

  return (
    <section className="card plan">
      <div className="plan__head">
        <h2 className="card__title card__title--tight">Plan samen</h2>
        <button type="button" className="btn btn--sm" onClick={sharePlan}>
          ↗ Deel
        </button>
      </div>
      <p className="card__subtitle">
        Tik aan wanneer je kan; het raster combineert dat live met de vrije banen
        bij <strong>{club.name}</strong>. Bovenaan: het beste moment om te boeken.
      </p>

      <div className="plan__controls">
        <div className="avail-quick">
          <button
            type="button"
            className="btn btn--sm"
            disabled={weekStart === today}
            onClick={() => shiftWeek(-7)}
          >
            ← Vorige 7 dagen
          </button>
          <button type="button" className="btn btn--sm" onClick={() => shiftWeek(7)}>
            Volgende 7 dagen →
          </button>
        </div>
        <div className="tabs">
          {DURATION_FILTERS.map((d) => (
            <button
              key={d ?? "alle"}
              type="button"
              className={`tab ${duration === d ? "is-active" : ""}`}
              onClick={() => setDuration(d)}
            >
              {d == null ? "Alle" : `${d}m`}
            </button>
          ))}
        </div>
      </div>

      {/* Aanbevelingsbalk. */}
      {best.length > 0 && (
        <div className="plan-reco">
          {best.map((c) => {
            const feasible = isFeasible(c);
            return (
              <button
                key={cellKey(c.date, c.time)}
                type="button"
                className={`plan-reco__chip ${feasible ? "is-feasible" : ""}`}
                onClick={() => setSelected(cellKey(c.date, c.time))}
              >
                <span className="plan-reco__when">
                  {feasible ? "🏆 " : ""}
                  {shortDay(c.date)} {c.time}
                </span>
                <span className="plan-reco__meta">
                  {c.yes.length} kan · {c.courtsFree} {c.courtsFree === 1 ? "baan" : "banen"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {week.loading || votes.loading ? (
        <p className="empty">Beschikbaarheid laden…</p>
      ) : grid.times.length === 0 ? (
        <p className="empty">
          Geen vrije banen gevonden in deze week bij {club.name}.
        </p>
      ) : (
        <div className="plan-scroll">
          <div
            className="plan-grid"
            style={{ gridTemplateColumns: `auto repeat(${grid.days.length}, 1fr)` }}
          >
            <div className="plan-grid__corner" />
            {grid.days.map((d) => (
              <div key={d.date} className="plan-grid__dayhead">
                <span>{fmtDate(d.date, { weekday: "short" })}</span>
                <span className="plan-grid__daynum">
                  {fmtDate(d.date, { day: "numeric", month: "numeric" })}
                </span>
              </div>
            ))}

            {grid.times.map((t) => (
              <div key={t} className="plan-grid__row" style={{ display: "contents" }}>
                <div className="plan-grid__time">{t}</div>
                {grid.days.map((d) => {
                  const k = cellKey(d.date, t);
                  const cell = grid.cells.get(k);
                  if (!cell) {
                    return <div key={k} className="plan-cell plan-cell--none" />;
                  }
                  const mine = myStatus.get(k);
                  const classes = [
                    "plan-cell",
                    heatClass(cell.courtsFree),
                    isFeasible(cell) ? "plan-cell--feasible" : "",
                    bestKeys.has(k) ? "plan-cell--best" : "",
                    selected === k ? "plan-cell--selected" : "",
                    mine ? `plan-cell--mine-${mine}` : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <button
                      key={k}
                      type="button"
                      className={classes}
                      onClick={() => setSelected(k)}
                      aria-label={`${shortDay(d.date)} ${t}: ${cell.yes.length} kunnen, ${cell.courtsFree} banen vrij`}
                    >
                      <span className="plan-cell__people">{cell.yes.length}</span>
                      <span className="plan-cell__courts">🎾{cell.courtsFree}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="plan-legend">
        Groot getal = leden die kunnen (van {memberCount}) · 🎾 = vrije banen ·
        groen omrand = genoeg spelers én baan · goud = beste moment
      </p>

      {/* Detailpaneel voor het gekozen slot. */}
      {selectedCell && (
        <div className="plan-detail" role="group">
          <div className="plan-detail__head">
            <strong>
              {shortDay(selectedCell.date)} · {selectedCell.time}
            </strong>
            <span className="plan-detail__stat">
              {selectedCell.courtsFree} {selectedCell.courtsFree === 1 ? "baan" : "banen"} vrij ·{" "}
              {selectedCell.yes.length} kunnen
              {selectedCell.maybe.length > 0 && ` · ${selectedCell.maybe.length} misschien`}
            </span>
          </div>

          {(selectedCell.yes.length > 0 || selectedCell.maybe.length > 0) && (
            <div className="plan-detail__roster">
              {selectedCell.yes.map((id) => (
                <span key={id} className="plan-chip plan-chip--yes">
                  ✓ {name(id)}
                </span>
              ))}
              {selectedCell.maybe.map((id) => (
                <span key={id} className="plan-chip plan-chip--maybe">
                  ? {name(id)}
                </span>
              ))}
            </div>
          )}

          <div className="plan-vote">
            {(["yes", "maybe", "no"] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={`btn btn--sm ${myStatus.get(selected!) === s ? "btn--primary" : ""}`}
                disabled={saving}
                onClick={() => vote(selectedCell, s)}
              >
                {s === "yes" ? "✓ Ik kan" : s === "maybe" ? "? Misschien" : "✗ Niet"}
              </button>
            ))}
            {myStatus.get(selected!) && (
              <button
                type="button"
                className="btn btn--sm"
                disabled={saving}
                onClick={() => vote(selectedCell, null)}
              >
                Wissen
              </button>
            )}
          </div>

          <a
            className="btn btn--primary plan-detail__book"
            href={bookingUrl(selectedCell.date)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Reserveer op Playtomic
          </a>
        </div>
      )}
    </section>
  );
}

export default PlanTogether;
