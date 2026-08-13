import { CoachAvatar, type CoachMood } from "@/features/coach/components/CoachAvatar";
import { COMMENTATOR } from "@/features/coach/roastTone";
import { CoachInfoButton } from "./CoachInfoButton";

/** Coach Rudy's commentaar onder een feed-item: een nette speech-bubble met
 *  zijn micro-avatar en naam. Rendert niets als hij bij dit item zwijgt.
 *
 *  `compact` laat de identiteitskop weg en houdt alleen de quip over (#1272).
 *  Die kop — avatar, naam, ⓘ — stond 34 keer op één pagina en voegde na de
 *  eerste keer niets meer toe; de feed las daardoor om de beurt als nieuws en
 *  dezelfde signatuur. Wie hier spreekt blijft aangekondigd via de kop die de
 *  eerste quip van het dagblok wél draagt, en voor wie de bladspiegel niet ziet
 *  staat de naam er nog steeds — alleen onzichtbaar. */
export function CoachComment({
  tekst,
  mood,
  onInfo,
  compact = false,
}: {
  tekst: string | null;
  mood: CoachMood;
  onInfo: () => void;
  compact?: boolean;
}) {
  if (!tekst) return null;
  if (compact) {
    return (
      <div className="coach-comment coach-comment--compact">
        <div className="coach-comment__bubble">
          <span className="coach-comment__text">
            <span className="sr-only">{COMMENTATOR.naam}: </span>
            {tekst}
          </span>
        </div>
      </div>
    );
  }
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
