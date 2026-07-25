import { Link } from "react-router-dom";
import { Avatar, type AvatarSource } from "@/components/ui/Avatar";
import { CoachSneer } from "@/features/coach/components/CoachSneer";
import type { RoastCtx } from "@/features/coach/roastTone";
import { formatDate } from "@/lib/utils/format";
import "./Schandpaal.css";

// De Schandpaal (#682): de tegenhanger van De Troon (#528/#545). De troon staat
// bóven het volk met een groot portret en één groot getal (de rating); de
// schandpaal staat eronder met een even groot portret en bewust géén getal — de
// reden-regel uit piasDetail draagt de kaart alleen (zie schandpaal.ts).
// De skin hergebruikt het kraftkarton-palet van de 🤡-FUT-editie (#631): mat,
// geen shimmer, geen metaal — schande glimt niet. Coach Rudy's sneer eronder
// vervult dezelfde rol als de propaganda-bubbel onder de troon.

export interface SchandpaalProps {
  name: string;
  profile: AvatarSource | null;
  /** De reden als één regel, uit piasDetail (bv. "kreeg een bagel om de oren"). */
  detail: string;
  /** Maandag van de ISO-week — currentPias valt terug op vorige week, en dat
   *  mag je zien, zodat een oude afgang niet als deze week leest. */
  weekStart: string;
  link?: string;
  isMe?: boolean;
  /** AI-hofnar-portret (#682) i.p.v. de gewone avatar, zodra het klaar is.
   *  Ontbreekt het, dan staat de gewone avatar er — geen skeleton-flits (#555). */
  image?: string;
  /** Roast-context van de pias; bij een schild zwijgt CoachSneer volledig. */
  ctx: RoastCtx;
  seed: number;
}

export function Schandpaal({
  name,
  profile,
  detail,
  weekStart,
  link,
  isMe,
  image,
  ctx,
  seed,
}: SchandpaalProps) {
  const frame = (
    <span className="schandpaal__frame">
      <span className="schandpaal__portrait">
        {image ? (
          <img className="schandpaal__img" src={image} alt="" />
        ) : (
          <Avatar profile={profile} name={name} size={148} />
        )}
      </span>
      <span className="schandpaal__plate">
        {/* Naam en "jij"-badge als aparte kinderen van één rij: de naam mag
            clampen op twee regels, en een badge binnen dat -webkit-box-clamp
            zou als box-kind samengeknepen worden. */}
        <span className="schandpaal__naamrij">
          <span className="schandpaal__name">{name}</span>
          {isMe && <span className="badge badge--accent">jij</span>}
        </span>
        <span className="schandpaal__week">week van {formatDate(weekStart)}</span>
      </span>
    </span>
  );

  return (
    <section
      className="schandpaal"
      aria-label={`De schandpaal — ${name}, pias van de club`}
    >
      <span className="schandpaal__topline">
        <span className="schandpaal__insig">🤡 Pias van de club</span>
      </span>
      {link ? (
        <Link className="schandpaal__body" to={link}>
          {frame}
        </Link>
      ) : (
        <span className="schandpaal__body">{frame}</span>
      )}
      <p className="schandpaal__reden">{detail}</p>
      <CoachSneer ctx={ctx} seed={seed} size={30} />
    </section>
  );
}

export default Schandpaal;
