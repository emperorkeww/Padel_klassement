import { CoachSneer } from "@/features/coach/components/CoachSneer";
import type { RoastCtx } from "@/features/coach/roastTone";

/** Pias van de week: de speler die als grootste favoriet toch verloor. Alleen
 *  zichtbaar wanneer een groep gekozen is en die groep deze/vorige week een
 *  choke had. */
export function PiasBanner({
  pias,
}: {
  pias: { naam: string; winChance: number; beschermd: boolean; ctx: RoastCtx; seed: number };
}) {
  return (
    <div className="pias-banner" role="status">
      <p className="pias-banner__line">
        <span className="pias-banner__nose" aria-hidden="true">
          {pias.beschermd ? "📊" : "🤡"}
        </span>
        <span>
          {pias.beschermd ? "Opvallende week" : "Pias van de week"}:{" "}
          <strong>{pias.naam}</strong> — verloor als{" "}
          {pias.beschermd ? "favoriet" : "torenhoge favoriet"} (
          {Math.round(pias.winChance * 100)}%).
        </span>
      </p>
      <CoachSneer ctx={pias.ctx} seed={pias.seed} size={26} />
    </div>
  );
}
