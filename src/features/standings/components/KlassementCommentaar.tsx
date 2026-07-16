// Coach Rudy over jóuw positie in het klassement (#411): een dunne wrapper om
// CoachBubble op de Leaderboard-pagina. De tekst en stemming komen kant-en-klaar
// uit coachKlassement/coachKlassementMood (klassementPraat.ts) — dit component
// presenteert alleen, net als CoachBubble zelf.

import { CoachBubble } from "@/features/coach/components/CoachBubble";
import type { CoachMood } from "@/features/coach/roastTone";

export function KlassementCommentaar({
  tekst,
  mood,
}: {
  tekst: string;
  mood: CoachMood;
}) {
  return (
    <div className="klassement-coach" role="status">
      <CoachBubble mood={mood}>
        <span className="coach-sneer__text">{tekst}</span>
      </CoachBubble>
    </div>
  );
}

export default KlassementCommentaar;
