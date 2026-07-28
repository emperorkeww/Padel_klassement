import { useState } from "react";
import { Link } from "react-router-dom";
import { Avatar, type AvatarSource } from "@/components/ui/Avatar";
import { TierBadge } from "@/features/rating/components/TierBadge";
import { BountyMark } from "@/features/rating/components/BountyMark";
import { formatDate } from "@/lib/utils/format";
import {
  DICTATOR_INSIGNE,
  DEFAULT_DICTATOR_LABEL,
  DEFAULT_DICTATOR_PROPAGANDA,
  dictatorPropaganda,
} from "@/features/dashboard/dictator";
import {
  DictatorEmbleem,
  DictatorFiligraan,
  DictatorGoudDefs,
  DictatorKaderHoek,
  DictatorKroonCrest,
  DictatorRandRuit,
  DictatorWatermerk,
  DictatorZegel,
} from "./dictatorOrnamenten";
import "./DictatorThrone.css";

// De Troon (#528 + #530): El Padelissimo — een gekwalificeerde dictator-#1 (tier
// `dictator`, rating 1600+ uit #527) — of, zolang niemand kwalificeert, Kylian
// Mbappé bij verstek (#530). Hij staat níet op het gedeelde podium tussen het
// volk, maar op een eigen "lof"-kaart erboven. De propaganda-toon zelf komt van
// Coach Rudy's bubbel direct onder de kaart (Leaderboard.tsx), dus de kaart
// blijft schoon.
//
// Commandodossier (#769): de kaart is hertekend naar een breed, ceremonieel
// dossier — staatsportret links, informatiepaneel rechts, met een gouden
// titelplaquette en een lakzegel. De decoratie is volledig CSS-gradient + SVG
// (dictatorOrnamenten.tsx): het staatsportret is de énige afbeelding die de
// kaart laadt, zodat er geen extra requests of rasterachtergronden bijkomen.
// Het portret zelf blijft van buiten komen (AI-portret uit #554/#682, of het
// vaste portret van de waarnemend dictator uit #530) — deze component levert
// alleen het kader, de ornamenten en de informatielagen.

export interface DictatorThroneProps {
  /** Echt clublid dat kwalificeerde (#528), of Kylian Mbappé bij verstek (#530). */
  variant?: "echt" | "waarnemend";
  /** Speler-key — link-fallback / stabiele identiteit. */
  seed: string;
  name: string;
  profile: AvatarSource | null;
  rating: number | null;
  link?: string;
  isMe?: boolean;
  /** Dag-cumulatieve ELO-beweging (▲/▼), net als op het podium (0/null = geen). */
  delta?: number | null;
  /** Vast portret i.p.v. de speler-avatar — voor de waarnemend dictator (#530). */
  image?: string;
  /** Volkslied-bediening (#535): alleen aanwezig zolang Mbappé regeert. Toont een
   *  demp-toggle, of een tap-to-play als de browser autoplay blokkeerde. */
  anthem?: {
    playing: boolean;
    blocked: boolean;
    muted: boolean;
    onToggleMute: () => void;
    onStart: () => void;
  };
  /** Begin van de lopende ambtstermijn (ISO) — voedt "regeert sinds …" (#545).
   *  Alleen voor een echte dictator; null bij de waarnemend variant. */
  sinds?: string | null;
  /** Wat er op zijn hoofd staat (#805); null = geen bounty. Een waarnemend
   *  dictator speelt niet mee en draagt er dus nooit een. */
  bounty?: number | null;
}

export function DictatorThrone({
  variant = "echt",
  seed,
  name,
  profile,
  rating,
  link,
  isMe,
  delta,
  image,
  anthem,
  sinds,
  bounty,
}: DictatorThroneProps) {
  // Waarnemend (#530): Mbappé is geen clublid — geen rating-hoofdgetal, geen
  // ambtstermijn en géén link naar een spelerprofiel; wel een eigen label.
  const waarnemend = variant === "waarnemend";

  // Laadstatus van het staatsportret (#769). Bewust géén effect maar twee
  // "welke src is klaar/stuk"-waarden: wisselt `image` (portret komt later
  // binnen, #536/#554), dan klopt de afgeleide status meteen weer — zonder
  // extra render of een stale skeleton over een al zichtbare foto.
  const [geladen, setGeladen] = useState<string | null>(null);
  const [mislukt, setMislukt] = useState<string | null>(null);
  const portretLaadt = !!image && geladen !== image && mislukt !== image;
  const portretStuk = !!image && mislukt === image;
  const toonPortret = !!image && !portretStuk;

  const titel = waarnemend ? "Generalissimo" : DICTATOR_INSIGNE;

  const frame = (
    <span className="dictator-throne__frame">
      {/* Krooncrest boven het kader: hoort bij de framevorm, dus hij zit ín de
          frame-laag en niet los over het portret. */}
      <DictatorKroonCrest className="dictator-throne__crest" />
      <span
        className="dictator-throne__portrait"
        data-status={portretStuk ? "fout" : portretLaadt ? "laadt" : "klaar"}
      >
        {toonPortret ? (
          // Geen loading="lazy": de troon staat bovenaan het klassement, dus
          // uitstellen maakt 'm juist later zichtbaar (#732).
          <img
            className="dictator-throne__img"
            src={image}
            alt={`Staatsportret van ${name}`}
            decoding="async"
            onLoad={() => setGeladen(image)}
            onError={() => setMislukt(image)}
          />
        ) : waarnemend || portretStuk ? (
          // Fallback zonder identiteitsruis: géén Avatar met initialen. Die zou
          // bij de waarnemend dictator de grote "KM"-badge tonen tot de foto
          // binnen is en dan zichtbaar naar het portret swappen (#555), en bij
          // een kapotte URL een gezicht suggereren dat er niet is. Het embleem
          // leest als een leeg staatsportret-kader — bewust, niet stuk.
          <span className="dictator-throne__leeg">
            <DictatorEmbleem className="dictator-throne__leeg-embleem" />
          </span>
        ) : (
          // Bewust kleiner dan het kader: het initialen-schijfje is een
          // noodoplossing en moet niet de plek van een staatsportret innemen.
          <Avatar profile={profile} name={name} size={130} />
        )}
        {/* Skeleton over het kader zolang de foto onderweg is: het kader heeft
            al zijn definitieve hoogte (vaste aspect-ratio), dus dit verschuift
            niets — het maakt alleen zichtbaar dát er iets komt. */}
        {portretLaadt && (
          <span className="dictator-throne__skelet" aria-hidden="true" />
        )}
        {portretStuk && (
          <span className="sr-only" role="status">
            Staatsportret kon niet geladen worden
          </span>
        )}
        <span className="dictator-throne__plate">
          <span className="dictator-throne__name">
            {name}
            {isMe && !waarnemend && (
              <span className="badge badge--accent">jij</span>
            )}
            {!waarnemend && <BountyMark pool={bounty} />}
          </span>
          {waarnemend ? (
            <span className="dictator-throne__verstek">
              {DEFAULT_DICTATOR_LABEL}
            </span>
          ) : (
            <TierBadge rating={rating} size="sm" />
          )}
        </span>
      </span>
      {/* Lauwerdetail in de vier hoeken van het kader — één vorm, in CSS naar
          de andere drie hoeken gespiegeld. */}
      {["lb", "rb", "lo", "ro"].map((hoek) => (
        <DictatorKaderHoek
          key={hoek}
          className={`dictator-throne__kaderhoek dictator-throne__kaderhoek--${hoek}`}
        />
      ))}
    </span>
  );

  return (
    <section
      className={`dictator-throne${waarnemend ? " dictator-throne--waarnemend" : ""}`}
      aria-label={
        waarnemend
          ? `De troon — ${name}, Madrid-Dictator`
          : `De troon — ${name}, El Padelissimo`
      }
    >
      <DictatorGoudDefs />
      {/* Decoratieve lagen (laagvolgorde uit #769): zonnestraal en brokaat op
          de achtergrond, dan de gouden filet en de gegraveerde hoeken. Alles
          pointer-events: none, zodat niets de link of de knop afvangt. */}
      <span className="dictator-throne__beam" aria-hidden="true" />
      <span className="dictator-throne__filet" aria-hidden="true" />
      <span className="dictator-throne__ornament" aria-hidden="true">
        {["lb", "rb", "lo", "ro"].map((hoek) => (
          <DictatorFiligraan
            key={hoek}
            className={`dictator-throne__filigraan dictator-throne__filigraan--${hoek}`}
          />
        ))}
        <DictatorRandRuit className="dictator-throne__ruit dictator-throne__ruit--boven" />
        <DictatorRandRuit className="dictator-throne__ruit dictator-throne__ruit--onder" />
      </span>

      {link && !waarnemend ? (
        <Link className="dictator-throne__body" to={link}>
          {frame}
        </Link>
      ) : (
        <span className="dictator-throne__body">{frame}</span>
      )}

      <div className="dictator-throne__panel">
        {/* Watermerk vóór de tekst in de DOM maar eronder in de stapeling —
            zo blijft de leesvolgorde portret → titel → omschrijving → actie. */}
        <DictatorWatermerk className="dictator-throne__watermerk" />
        {/* Topline (#609, hertekend in #769): titelplaquette links, actie- of
            statusknop rechts — één rij, dus ze kunnen elkaar per constructie
            niet overlappen, ook niet als de knop de brede tap-to-play is. */}
        <span className="dictator-throne__topline">
          <span className="dictator-throne__plaquette">
            <DictatorEmbleem className="dictator-throne__embleem" />
            <span className="dictator-throne__insig">{titel}</span>
            <DictatorZegel className="dictator-throne__lakzegel" />
          </span>
          {anthem &&
            (anthem.blocked ? (
              <button
                type="button"
                className="dictator-throne__anthem dictator-throne__anthem--breed"
                onClick={anthem.onStart}
                title="Speel het volkslied"
              >
                🔊 Volkslied
              </button>
            ) : (
              <button
                type="button"
                className="dictator-throne__anthem"
                onClick={anthem.onToggleMute}
                aria-pressed={anthem.muted}
                title={anthem.muted ? "Volkslied dempen staat aan" : "Volkslied dempen"}
              >
                {anthem.muted ? "🔇" : "🔊"}
              </button>
            ))}
        </span>

        {/* Eén korte slogan — de volle propaganda-toon staat in Coach Rudy's
            bubbel eronder, dus de kaart blijft een "lof"-poster. */}
        <p className="dictator-throne__prop">
          {waarnemend ? DEFAULT_DICTATOR_PROPAGANDA : dictatorPropaganda(seed)}
        </p>

        {/* Gouden haarlijn met sluitruit — sluit het paneel af, ook bij de
            waarnemend variant die geen ratingblok heeft. */}
        <span className="dictator-throne__scheiding" aria-hidden="true">
          <DictatorRandRuit className="dictator-throne__scheiding-ruit" />
        </span>

        {!waarnemend && (
          <span className="dictator-throne__rate">
            <span className="dictator-throne__score">
              <span className="dictator-throne__rating">
                {rating ?? "—"}
                {delta != null && delta !== 0 && (
                  <span
                    className={`stat__delta ${delta > 0 ? "is-up" : "is-down"}`}
                  >
                    {delta > 0 ? "▲" : "▼"}
                    {Math.abs(delta)}
                  </span>
                )}
              </span>
              <span className="dictator-throne__rate-label">rating</span>
            </span>
            {/* "regeert sinds" (#545) — sinds #609 hier als meta naast de rating,
                zodat de nameplate op het portret niet dichtslibt. */}
            {sinds && (
              <span className="dictator-throne__sinds">
                regeert sinds {formatDate(sinds)}
              </span>
            )}
          </span>
        )}
      </div>
    </section>
  );
}

export default DictatorThrone;
