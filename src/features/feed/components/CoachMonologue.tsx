import { CoachAvatar, type CoachMood } from "@/features/coach/components/CoachAvatar";
import { COMMENTATOR } from "@/features/coach/roastTone";
import { CoachInfoButton } from "./CoachInfoButton";

/** Coach Rudy's avondverslag (#204): dezelfde speech-bubble, maar met een korte
 *  monoloog van meerdere zinnen. Rendert niets zonder verslag. */
export function CoachMonologue({
  lines,
  mood,
  onInfo,
}: {
  lines: string[];
  mood: CoachMood;
  onInfo: () => void;
}) {
  if (lines.length === 0) return null;
  return (
    <div className="coach-comment">
      <CoachAvatar size={34} mood={mood} className="coach-comment__face" />
      <div className="coach-comment__bubble">
        <span className="coach-comment__head">
          <span className="coach-comment__name">
            {COMMENTATOR.naam} · avondverslag
          </span>
          <CoachInfoButton onInfo={onInfo} />
        </span>
        {lines.map((l, i) => (
          <span key={i} className="coach-comment__text">
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}
