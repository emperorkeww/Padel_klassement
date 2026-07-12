// Coach Rudy's jab als geattribueerde spreker (#287): een compacte speech-bubble
// met zijn handgetekende illustratie i.p.v. de losse 🎙️-emoji die vroeger vóór
// de sneer werd geplakt (sneerSuffix). Zo krijgt élk roast-oppervlak — pias,
// zwarte piet, pias-banner — hetzelfde herkenbare Coach Rudy-gezicht als de feed.

import { CoachAvatar } from "./CoachAvatar";
import { COMMENTATOR, coachSneer, type RoastCtx } from "../lib/roastTone";
import "./CoachSneer.css";

export function CoachSneer({
  ctx,
  seed,
  size = 30,
}: {
  /** Roast-context (toon + schild) van het doelwit. */
  ctx: RoastCtx;
  /** Deterministische seed → dezelfde burn voor de hele groep. */
  seed: number;
  /** Diameter van Coach Rudy's avatar in px. */
  size?: number;
}) {
  // Kále sneertekst; null bij roast-schild → dan zwijgt de coach volledig.
  const tekst = coachSneer(ctx, seed);
  if (!tekst) return null;
  // De illustratie-stemming volgt de hardheid van de sneer.
  return (
    <div className="coach-sneer">
      <CoachAvatar size={size} mood={ctx.intensiteit} className="coach-sneer__face" />
      <div className="coach-sneer__bubble">
        <span className="coach-sneer__name">{COMMENTATOR.naam}</span>
        <span className="coach-sneer__text">{tekst}</span>
      </div>
    </div>
  );
}

export default CoachSneer;
