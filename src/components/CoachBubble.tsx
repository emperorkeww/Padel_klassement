// Coach Rudy's speech-bubble als pure presentatie (#296): avatar + naam + één of
// meer tekstregels. Losgetrokken uit CoachSneer zodat élk Rudy-oppervlak — de
// sneer, maar ook de smoesjesmachine met een vrij excuus + jury-oordeel —
// dezelfde bubbel deelt. Genereert zélf geen tekst; de aanroeper levert de
// inhoud als children. Hergebruikt CoachSneer.css.

import type { ReactNode } from "react";
import { CoachAvatar } from "./CoachAvatar";
import { COMMENTATOR, type CoachMood } from "../lib/roastTone";
import "./CoachSneer.css";

export function CoachBubble({
  mood,
  size = 30,
  children,
}: {
  /** Stemming van Coach Rudy's illustratie. */
  mood: CoachMood;
  /** Diameter van de avatar in px. */
  size?: number;
  /** De bubbel-inhoud, bv. één of meer `.coach-sneer__text`-regels. */
  children: ReactNode;
}) {
  return (
    <div className="coach-sneer">
      <CoachAvatar size={size} mood={mood} className="coach-sneer__face" />
      <div className="coach-sneer__bubble">
        <span className="coach-sneer__name">{COMMENTATOR.naam}</span>
        {children}
      </div>
    </div>
  );
}

export default CoachBubble;
