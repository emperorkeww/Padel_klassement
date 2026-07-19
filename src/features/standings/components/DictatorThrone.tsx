import { Link } from "react-router-dom";
import { Avatar, type AvatarSource } from "@/components/ui/Avatar";
import { TierBadge } from "@/features/rating/components/TierBadge";
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
}: DictatorThroneProps) {
  // Waarnemend (#530): Mbappé is geen clublid — geen rating-hoofdgetal, geen
  // ambtstermijn en géén link naar een spelerprofiel; wel een eigen label.
  const waarnemend = variant === "waarnemend";

  const frame = (
    <span className="dictator-throne__frame">
      <span className="dictator-throne__insig">
        {waarnemend ? "🐐 Generalissimo" : `🫡 ${DICTATOR_INSIGNE}`}
      </span>
      <span className="dictator-throne__portrait">
        {image ? (
          <img className="dictator-throne__img" src={image} alt="" />
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
      {link && !waarnemend ? (
        <Link className="dictator-throne__body" to={link}>
          {frame}
        </Link>
      ) : (
        <span className="dictator-throne__body">{frame}</span>
      )}
      {!waarnemend && (
        <span className="dictator-throne__rate">
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
