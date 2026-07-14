// De Zwarte Piet-kaart (#185): wie het rondgaande schande-token 🃏 van de groep
// nú draagt, sinds wanneer en waarom. Rendert niets als de Piet vrij is. De
// commentator-sneer (#183) respecteert het roast-schild van de drager.

import { Link } from "react-router-dom";
import { Avatar } from "@/ui/Avatar";
import { CoachSneer } from "@/features/coach/components/CoachSneer";
import { roastCtx, roastSeed } from "@/features/coach/roastTone";
import type { Group, Profile } from "@/types";
import { displayName } from "@/features/profiles/api";
import type { ZwartePietHolder } from "@/features/groups/zwartePietApi";
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
  const beschermd = profiles[piet.holderId]?.roast_schild ?? false;
  // Coach Rudy als geattribueerde spreker (#287) i.p.v. de losse 🎙️-emoji.
  const ctx = roastCtx(group, profiles[piet.holderId]);
  const seed = roastSeed(piet.holderId, piet.since);
  const dagen = dagenSinds(piet.since);
  const sinds =
    dagen === 0 ? "sinds vandaag" : `al ${dagen} ${dagen === 1 ? "dag" : "dagen"}`;

  return (
    <section className="card pias-card pias-card--piet">
      <div className="card__head">
        <h2 className="card__title">
          {beschermd ? "📊 Schande-token" : "🃏 De Zwarte Piet"}
        </h2>
      </div>
      <p className="pias-card__lede">
        Het rondgaande schande-token. Blijft bij dezelfde speler tot die wint en
        het doorschuift — los van de maandelijkse Pias.
      </p>

      <Link className="pias-card__row" to={`/spelers/${piet.holderId}`}>
        <span className="pias-card__emoji" aria-hidden="true">
          {beschermd ? "📊" : "🃏"}
        </span>
        <Avatar profile={profiles[piet.holderId]} size={44} />
        <span className="pias-card__body">
          <span className="pias-card__name">
            {naam}
            <span className="pias-card__role pias-card__role--piet">Zwarte Piet</span>
          </span>
          <span className="pias-card__detail">{piet.detail}</span>
        </span>
      </Link>

      <CoachSneer ctx={ctx} seed={seed} />

      <p className="pias-card__meta">
        {beschermd
          ? `Draagt het schande-token van de groep ${sinds}. Geen roast: het roast-schild staat aan.`
          : `Draagt de schande van de groep ${sinds}. Winnen is de enige manier om 'm door te schuiven!`}
      </p>
    </section>
  );
}

export default ZwartePietCard;
