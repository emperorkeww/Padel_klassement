import { CoachAvatar, type CoachMood } from "@/features/coach/components/CoachAvatar";
import { COMMENTATOR } from "@/features/coach/roastTone";
import { CoachInfoButton } from "./CoachInfoButton";

/** Coach Rudy's commentaar onder een feed-item: een nette speech-bubble met
 *  zijn micro-avatar en naam. Rendert niets als hij bij dit item zwijgt. */
export function CoachComment({
  tekst,
  mood,
  onInfo,
}: {
  tekst: string | null;
  mood: CoachMood;
  onInfo: () => void;
}) {
  if (!tekst) return null;
  return (
    <div className="coach-comment">
      <CoachAvatar size={34} mood={mood} className="coach-comment__face" />
      <div className="coach-comment__bubble">
        <span className="coach-comment__head">
          <span className="coach-comment__name">{COMMENTATOR.naam}</span>
          <CoachInfoButton onInfo={onInfo} />
        </span>
        <span className="coach-comment__text">{tekst}</span>
      </div>
    </div>
  );
}
