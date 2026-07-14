import type { PollVoteStatus } from "@/features/groups/pollsApi";
import type { OptionState } from "@/features/groups/pollLogic";

// Gedeelde constants en pure helpers voor de Speeldag-poll (PlanPoll).

export const VOTE_SEGMENTS: { status: PollVoteStatus; icon: string; label: string }[] = [
  { status: "yes", icon: "✓", label: "Ik kan" },
  { status: "maybe", icon: "?", label: "Misschien" },
  { status: "no", icon: "✗", label: "Kan niet" },
];
export const STATE_ICON: Record<OptionState, string> = {
  haalbaar: "✓",
  krap: "⚠",
  onhaalbaar: "✕",
  onbekend: "?",
};
export const MAX_OPTIONS = 5;
export const DURATIONS = [60, 90, 120] as const;
/** Avonduren als standaardvenster in de wizard. */
export const EVENING_FROM = 17;

// 's Middags formatteren zodat DST de datum niet kantelt.
export function fmtDate(date: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("nl-BE", opts).format(new Date(`${date}T12:00:00`));
}
export const longDay = (date: string) =>
  fmtDate(date, { weekday: "long", day: "numeric", month: "long" });
export const shortDay = (date: string) =>
  fmtDate(date, { weekday: "short", day: "numeric", month: "short" });

/** "20:15" → "20:00": lookup-sleutel voor het halfuur-raster. */
export function floorHalfHour(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${String(h).padStart(2, "0")}:${m < 30 ? "00" : "30"}`;
}

export const optKey = (o: { date: string; startTime: string }) => `${o.date}|${o.startTime}`;