import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "../../components/ToastProvider";
import { errorMessage } from "../../lib/errors";
import { sharePng } from "../../lib/shareImage";
import { prefersReducedMotion } from "../../lib/motion";
import { useAsync } from "../../lib/useAsync";
import { getCompletedMatchesBetween } from "../matches/api";
import type { Match, Profile, RatingPoint, Team } from "../../lib/types";
import { deriveWrapped } from "./wrapped";
import type { WrappedCard } from "./wrapped";
import { drawWrappedCard, posterLayout } from "./wrappedPoster";
import "./wrapped.css";

// Padel Wrapped (#115): swipebaar jaaroverzicht in een sheet. De kaarten
// delen hun copy met de posters (posterLayout); elke kaart is los deelbaar
// als 1080×1350-afbeelding via de bestaande sharePng-flow.

const POSTER_W = 1080;
const POSTER_H = 1350;

export function WrappedSheet({
  jaar,
  playerId,
  naam,
  matches,
  teams,
  profiles,
  ratingHistory,
  onClose,
}: {
  jaar: number;
  playerId: string;
  naam: string;
  matches: Match[];
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  ratingHistory?: RatingPoint[];
  onClose: () => void;
}) {
  const toast = useToast();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [actief, setActief] = useState(0);
  const [busyKind, setBusyKind] = useState<string | null>(null);

  // Clubmatches van het jaar voor de zeldzaamste-badge-kaart; zonder deze
  // data valt alleen die kaart weg (graceful).
  const clubMatches = useAsync(
    () =>
      getCompletedMatchesBetween(
        new Date(jaar, 0, 1).toISOString(),
        new Date(jaar + 1, 0, 1).toISOString(),
      ),
    [jaar],
  );

  const wrapped = useMemo(
    () =>
      deriveWrapped({
        jaar,
        matches,
        teams,
        profiles,
        playerId,
        ratingHistory,
        clubMatches: clubMatches.data ?? undefined,
      }),
    [jaar, matches, teams, profiles, playerId, ratingHistory, clubMatches.data],
  );
  const cards = wrapped?.cards ?? [];

  // Focus in de dialoog bij openen; terug naar de opener bij sluiten.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  // Escape sluit; de pagina eronder scrollt niet mee.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const naar = (i: number) => {
    const track = trackRef.current;
    if (!track) return;
    const idx = Math.max(0, Math.min(cards.length - 1, i));
    track.scrollTo({
      left: idx * track.clientWidth,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
    setActief(idx);
  };

  const onScroll = () => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    setActief(Math.round(track.scrollLeft / track.clientWidth));
  };

  async function deel(card: WrappedCard) {
    setBusyKind(card.kind);
    try {
      const outcome = await sharePng((ctx) => drawWrappedCard(ctx, card, naam, jaar), {
        width: POSTER_W,
        height: POSTER_H,
        filename: `vamos-wrapped-${jaar}-${card.kind}.png`,
        title: `Wrapped ${jaar}`,
      });
      if (outcome === "clipboard") toast.success("Poster gekopieerd naar klembord.");
      if (outcome === "download") toast.success("Poster gedownload.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyKind(null);
    }
  }

  if (!wrapped) return null;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet wrapped-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`Wrapped ${jaar}`}
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") naar(actief + 1);
          if (e.key === "ArrowLeft") naar(actief - 1);
        }}
      >
        <div className="sheet__head">
          <h2 className="sheet__title">🎁 Wrapped {jaar}</h2>
          <button className="sheet__close" onClick={onClose} aria-label="Sluiten">
            ✕
          </button>
        </div>

        <div className="wrapped-track" ref={trackRef} onScroll={onScroll}>
          {cards.map((card) => {
            const l = posterLayout(card, naam, jaar);
            return (
              <article key={card.kind} className="wrapped-card">
                <div className="wrapped-card__body">
                  <p className="wrapped-card__kicker">{l.kicker}</p>
                  <p
                    className={`wrapped-card__hero ${l.heroKlein ? "wrapped-card__hero--klein" : ""}`}
                  >
                    {l.hero}
                  </p>
                  {l.sub.map((regel) => (
                    <p key={regel} className="wrapped-card__sub">
                      {regel}
                    </p>
                  ))}
                </div>
                <button
                  className="btn btn--sm wrapped-card__share"
                  onClick={() => deel(card)}
                  disabled={busyKind !== null}
                >
                  {busyKind === card.kind ? "Bezig…" : "↗ Deel"}
                </button>
              </article>
            );
          })}
        </div>

        <p className="sr-only" aria-live="polite">
          Kaart {actief + 1} van {cards.length}
        </p>

        <div className="wrapped-nav">
          <button
            className="btn btn--sm"
            onClick={() => naar(actief - 1)}
            disabled={actief === 0}
          >
            ‹ Vorige
          </button>
          <div className="wrapped-dots" role="tablist" aria-label="Kaarten">
            {cards.map((card, i) => (
              <button
                key={card.kind}
                className={`wrapped-dot ${i === actief ? "is-active" : ""}`}
                aria-label={`Kaart ${i + 1} van ${cards.length}`}
                aria-current={i === actief}
                onClick={() => naar(i)}
              />
            ))}
          </div>
          <button
            className="btn btn--sm"
            onClick={() => naar(actief + 1)}
            disabled={actief >= cards.length - 1}
          >
            Volgende ›
          </button>
        </div>
      </div>
    </div>
  );
}

export default WrappedSheet;
