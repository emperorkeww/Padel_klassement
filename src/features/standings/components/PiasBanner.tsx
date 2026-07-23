import { CoachSneer } from "@/features/coach/components/CoachSneer";
import { piasDetail, type PiasReden } from "@/features/groups/maandpias";
import type { RoastCtx } from "@/features/coach/roastTone";

/** Pias van de week: de anti-MVP van de groep (#643 — bagel, afdroging,
 *  zwarte reeks of choke, zelfde regels als bepaalPias). Alleen zichtbaar
 *  wanneer een groep gekozen is en die groep deze/vorige week een pias had. */
export function PiasBanner({
  pias,
}: {
  pias: {
    naam: string;
    reden: PiasReden;
    waarde: number;
    beschermd: boolean;
    ctx: RoastCtx;
    seed: number;
  };
}) {
  return (
    <div className="pias-banner" role="status">
      <p className="pias-banner__line">
        <span className="pias-banner__nose" aria-hidden="true">
          {pias.beschermd ? "📊" : "🤡"}
        </span>
        <span>
          {pias.beschermd ? "Opvallende week" : "Pias van de week"}:{" "}
          <strong>{pias.naam}</strong> —{" "}
          {pias.beschermd
            ? "had een week om snel te vergeten."
            : `${piasDetail(pias.reden, pias.waarde)}.`}
        </span>
      </p>
      <CoachSneer ctx={pias.ctx} seed={pias.seed} size={26} />
    </div>
  );
}
