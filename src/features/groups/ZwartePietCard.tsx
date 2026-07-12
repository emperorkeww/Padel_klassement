// De Zwarte Piet-kaart (#185): wie het rondgaande schande-token 🃏 van de groep
// nú draagt, sinds wanneer en waarom. Rendert niets als de Piet vrij is. De
// commentator-sneer (#183) respecteert het roast-schild van de drager.

import { Link } from "react-router-dom";
import { Avatar } from "../../components/Avatar";
import { roastCtx, roastSeed, sneerSuffix } from "../../lib/roastTone";
import type { Group, Profile } from "../../lib/types";
import { displayName } from "../profiles/api";
import type { ZwartePietHolder } from "./zwartePietApi";
import "./PiasCard.css";

/** Hele dagen sinds `since` (YYYY-MM-DD), in UTC zodat het stabiel is. */
function dagenSinds(since: string, now: Date = new Date()): number {
  const d = Date.parse(`${since}T00:00:00Z`);
  const t = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.round((t - d) / 86_400_000));
}

export function ZwartePietCard({
  piet,
  group,
  profiles,
}: {
  piet: ZwartePietHolder;
  group: Pick<Group, "roast_intensiteit"> | null | undefined;
  profiles: Record<string, Profile>;
}) {
  const naam = displayName(profiles[piet.holderId]);
  const sneer = sneerSuffix(
    roastCtx(group, profiles[piet.holderId]),
    roastSeed(piet.holderId, piet.since),
  );
  const dagen = dagenSinds(piet.since);
  const sinds =
    dagen === 0 ? "sinds vandaag" : `al ${dagen} ${dagen === 1 ? "dag" : "dagen"}`;

  return (
    <section className="card pias-card">
      <div className="card__head">
        <h2 className="card__title">🃏 De Zwarte Piet</h2>
      </div>

      <Link className="pias-card__row" to={`/spelers/${piet.holderId}`}>
        <span className="pias-card__emoji" aria-hidden="true">
          🃏
        </span>
        <Avatar profile={profiles[piet.holderId]} size={44} />
        <span className="pias-card__body">
          <span className="pias-card__name">{naam}</span>
          <span className="pias-card__detail">
            {piet.detail}
            {sneer}
          </span>
        </span>
      </Link>

      <p className="pias-card__meta">
        Draagt de schande van de groep {sinds}. Winnen is de enige manier om 'm door te schuiven!
      </p>
    </section>
  );
}

export default ZwartePietCard;
