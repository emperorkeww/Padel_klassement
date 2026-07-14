// Coach Rudy's jab als geattribueerde spreker (#287): een compacte speech-bubble
// met zijn handgetekende illustratie i.p.v. de losse 🎙️-emoji die vroeger vóór
// de sneer werd geplakt (sneerSuffix). Zo krijgt élk roast-oppervlak — pias,
// zwarte piet, pias-banner — hetzelfde herkenbare Coach Rudy-gezicht als de feed.

import { CoachBubble } from "@/features/coach/components/CoachBubble";
import { coachSneer, type RoastCtx } from "@/features/coach/roastTone";

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
    <CoachBubble mood={ctx.intensiteit} size={size}>
      <span className="coach-sneer__text">{tekst}</span>
    </CoachBubble>
  );
}

export default CoachSneer;
