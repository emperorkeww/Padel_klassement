import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar, type AvatarSource } from "@/components/ui/Avatar";
import { CoachSneer } from "@/features/coach/components/CoachSneer";
import type { RoastCtx } from "@/features/coach/roastTone";
import { formatDate } from "@/lib/utils/format";
import {
  PiasBadgeIcoon,
  PiasChevrons,
  PiasKaartDecor,
  PiasMaskerMedaillon,
  PiasNarrenkap,
  PiasWatermerk,
} from "./piasOrnamenten";
import "./Schandpaal.css";

// De Schandpaal (#682, hertekend in #770): de tegenhanger van De Troon
// (#528/#545). De troon staat bóven het volk met een groot portret en één groot
// getal (de rating); de schandpaal staat eronder met een even groot portret en
// bewust géén getal — de reden-regel uit piasDetail draagt de kaart alleen (zie
// schandpaal.ts).
//
// #770 maakt er een verweerd theateraffiche van: perkament met harlekijnruiten,
// links het gegenereerde portret in een dubbele lijst met een narrenkap aan de
// bovenrand en een gebarsten maskermedaillon in de onderhoek, rechts een
// verhaalpaneel met titelbadge, incident en Coach Rudy's oordeel. Het materiaal
// blijft dat van de 🤡-FUT-editie (#631/#705/#710): mat kraftkarton, geen
// shimmer, geen metaal — schande glimt niet, en er is dus ook geen animatie die
// `prefers-reduced-motion` moet dempen.
//
// De ornamenten komen letterlijk uit ornamentenPias.ts (zie piasOrnamenten.tsx):
// dezelfde kap, belletjes, maskers en ruiten als de FUT-kaart, zodat kaart en
// poster één speler in één register blijven.

/** Wat het beeldvak links op dit moment toont. De AI-afbeelding wordt buiten
 *  deze component gegenereerd (edge function → `pias_avatar_url`) en is dus een
 *  vervangbare, dynamische bron: de kaart mag nooit aannemen dat hij er ís,
 *  laadt of lukt. */
type PortretStatus = "geen" | "laadt" | "klaar" | "fout";

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
   *  Ontbreekt het of laadt het niet, dan staat de gewone avatar er — geen
   *  skeleton-flits (#555). */
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
  // Eén status i.p.v. losse booleans: "geen bron", "aan het laden", "gelukt" en
  // "mislukt" zijn vier verschillende dingen op de kaart, en alleen bij de
  // laatste twee mag het beeldvak van uiterlijk veranderen.
  const [status, setStatus] = useState<PortretStatus>(image ? "laadt" : "geen");
  // Een nieuw portret (fotowissel, andere pias) begint weer bij nul; zonder dit
  // zou een eerdere `fout` de nieuwe bron meteen wegdrukken.
  useEffect(() => setStatus(image ? "laadt" : "geen"), [image]);

  const toonPortret = image != null && status !== "fout";

  const frame = (
    <span className="schandpaal__frame">
      <span className="schandpaal__portrait" data-portret={status}>
        {toonPortret ? (
          // Net als de troon boven de vouw: wel async decoderen, niet uitstellen.
          // De alt-tekst benoemt wie er staat én waaróm — de afbeelding zelf
          // draagt geen tekst, dus dit is de enige plek waar dat kan.
          <img
            className="schandpaal__img"
            src={image}
            alt={`${name}, uitgebeeld als de pias van de club`}
            decoding="async"
            onLoad={() => setStatus("klaar")}
            onError={() => setStatus("fout")}
          />
        ) : (
          <Avatar profile={profile} name={name} size={148} />
        )}
      </span>
      <PiasNarrenkap className="schandpaal__kap" />
      <PiasMaskerMedaillon className="schandpaal__medaillon" />
    </span>
  );

  const plaat = (
    // De metadata staat buiten het beeldvak, niet als overlay: het portret is
    // een vervangbare bron met een onbekende compositie, dus tekst erop is een
    // gok. Op een plaat eronder is ze altijd leesbaar.
    <span className="schandpaal__plate">
      {/* Naam en "jij"-badge als aparte kinderen van één rij, zodat de badge
          niet als flex-kind wordt samengeknepen door een lange naam. */}
      <span className="schandpaal__naamrij">
        <span className="schandpaal__name">{name}</span>
        {isMe && <span className="badge badge--accent">jij</span>}
      </span>
      <span className="schandpaal__week">week van {formatDate(weekStart)}</span>
    </span>
  );

  return (
    <section
      className="schandpaal"
      aria-label={`De schandpaal — ${name}, pias van de club`}
    >
      <PiasKaartDecor className="schandpaal__decor" />
      {link ? (
        <Link className="schandpaal__body" to={link}>
          {frame}
          {plaat}
        </Link>
      ) : (
        <span className="schandpaal__body">
          {frame}
          {plaat}
        </span>
      )}
      <div className="schandpaal__verhaal">
        <PiasWatermerk className="schandpaal__watermerk" />
        {/* De status staat als tekst op de kaart en niet alleen in het rood en
            de ornamenten — kleur is hier sfeer, geen betekenisdrager. */}
        <p className="schandpaal__topline">
          <span className="schandpaal__insig">
            <PiasBadgeIcoon className="schandpaal__insig-icoon" />
            Pias van de club
          </span>
        </p>
        {/* De reden is het enige inhoudelijke veld: waar de troon één groot
            getal draagt, draagt de schandpaal bewust géén cijfer. */}
        <p className="schandpaal__reden">{detail}</p>
        <span className="schandpaal__scheiding" aria-hidden="true" />
        <CoachSneer ctx={ctx} seed={seed} size={44} />
        <PiasChevrons className="schandpaal__chevrons" />
      </div>
    </section>
  );
}

export default Schandpaal;
