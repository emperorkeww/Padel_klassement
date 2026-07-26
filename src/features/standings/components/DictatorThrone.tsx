import { Link } from "react-router-dom";
import { Avatar, type AvatarSource } from "@/components/ui/Avatar";
import { TierBadge } from "@/features/rating/components/TierBadge";
import { formatDate } from "@/lib/utils/format";
import {
  DICTATOR_INSIGNE,
  DEFAULT_DICTATOR_LABEL,
  DEFAULT_DICTATOR_PROPAGANDA,
  dictatorPropaganda,
} from "@/features/dashboard/dictator";
import "./DictatorThrone.css";

// De Troon (#528 + #530): El Padelissimo — een gekwalificeerde dictator-#1 (tier
// `dictator`, rating 1600+ uit #527) — of, zolang niemand kwalificeert, Kylian
// Mbappé bij verstek (#530). Hij staat níet op het gedeelde podium tussen het
// volk, maar op een eigen "lof"-kaart erboven: een groot portret als een
// personencultus-poster, met minimale randtekst. De propaganda-toon zelf komt
// van Coach Rudy's bubbel direct onder de kaart (Leaderboard.tsx), dus de kaart
// blijft schoon. De rangnaam-badge komt uit TierBadge ("🫡 El Padelissimo").

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
}: DictatorThroneProps) {
  // Waarnemend (#530): Mbappé is geen clublid — geen rating-hoofdgetal, geen
  // ambtstermijn en géén link naar een spelerprofiel; wel een eigen label.
  const waarnemend = variant === "waarnemend";

  const frame = (
    <span className="dictator-throne__frame">
      <span className="dictator-throne__portrait">
        {image ? (
          // Geen loading="lazy": de troon staat bovenaan het klassement, dus
          // uitstellen maakt 'm juist later zichtbaar (#732).
          <img className="dictator-throne__img" src={image} alt="" decoding="async" />
        ) : waarnemend ? (
          // Waarnemend Mbappé (#530): z'n portret laadt lui (~70 KB, #536), dus bij
          // een refresh is `image` er nog niet. NIET terugvallen op de Avatar —
          // die zou de grote "KM"-initialenbadge tonen tot de foto binnen is en
          // dan zichtbaar naar het portret swappen (#555). Het portret-kader heeft
          // al een donkere verloop-achtergrond, dus een leeg kader oogt bewust en
          // vult zich gewoon zodra de foto er is — geen KM-flits.
          null
        ) : (
          <Avatar profile={profile} name={name} size={200} />
        )}
        <span className="dictator-throne__plate">
          <span className="dictator-throne__name">
            {name}
            {isMe && !waarnemend && (
              <span className="badge badge--accent">jij</span>
            )}
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
      <span className="dictator-throne__beam" aria-hidden="true" />
      {/* Topline (#609): insigne en volkslied-knop delen één grid-regel boven
          het portret — het insigne zweeft niet langer over het kader en kan
          per constructie niet meer met de knop botsen. */}
      <span className="dictator-throne__topline">
        <span className="dictator-throne__insig">
          {waarnemend ? "🐐 Generalissimo" : `🫡 ${DICTATOR_INSIGNE}`}
        </span>
        {anthem &&
          (anthem.blocked ? (
            <button
              type="button"
              className="dictator-throne__anthem"
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
      {link && !waarnemend ? (
        <Link className="dictator-throne__body" to={link}>
          {frame}
        </Link>
      ) : (
        <span className="dictator-throne__body">{frame}</span>
      )}
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
      {/* Eén korte slogan — de volle propaganda-toon staat in Coach Rudy's
          bubbel eronder, dus de kaart blijft een "lof"-poster. */}
      <p className="dictator-throne__prop">
        {waarnemend ? DEFAULT_DICTATOR_PROPAGANDA : dictatorPropaganda(seed)}
      </p>
    </section>
  );
}

export default DictatorThrone;
