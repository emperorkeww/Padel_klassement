import { useMemo, useRef, useState } from "react";
import { useToast } from "@/ui/ToastProvider";
import { Sheet } from "@/ui/Sheet";
import { errorMessage } from "@/lib/utils/errors";
import { sharePng } from "@/lib/utils/shareImage";
import { prefersReducedMotion } from "@/lib/utils/motion";
import { useAsync } from "@/lib/hooks/useAsync";
import { getCompletedMatchesBetween } from "@/features/matches/api";
import type { Match, Profile, RatingPoint, RoastIntensiteit, Team } from "@/types";
import { deriveWrapped } from "@/features/wrapped/wrapped";
import type { WrappedCard } from "@/features/wrapped/wrapped";
import { drawWrappedCard, posterLayout } from "@/features/wrapped/wrappedPoster";
import { coachEindoordeel, coachWrappedRegel } from "@/features/wrapped/coachWrapped";
import { CoachAvatar, type CoachMood } from "@/features/coach/components/CoachAvatar";
import { roastCtx, roastSeed } from "@/features/coach/roastTone";
import "@/features/wrapped/wrapped.css";

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
  intensiteit = "gemeen",
  onClose,
}: {
  jaar: number;
  playerId: string;
  naam: string;
  matches: Match[];
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  ratingHistory?: RatingPoint[];
  /** Roast-toon van de eigen groep; schild komt uit het eigen profiel (#295). */
  intensiteit?: RoastIntensiteit;
  onClose: () => void;
}) {
  const toast = useToast();
  const trackRef = useRef<HTMLDivElement | null>(null);
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
  const cards = useMemo(() => wrapped?.cards ?? [], [wrapped]);

  // Coach Rudy's regel + mood per kaart (#295). Eén gedeelde `gebruikt`-set over
  // het deck voorkomt dat dezelfde quip twee keer opduikt; schild komt uit het
  // eigen profiel. Index-gelijk aan `cards`.
  const coachPerKaart = useMemo<
    { mood: CoachMood; kop: string | null; regels: string[]; tekst: string | null }[]
  >(() => {
    const ctx = roastCtx({ roast_intensiteit: intensiteit }, profiles[playerId]);
    const gebruikt = new Set<string>();
    return cards.map((card) => {
      const seed = roastSeed("wrapped", playerId, String(jaar), card.kind);
      if (card.kind === "eindoordeel") {
        const eo = coachEindoordeel(card.stats, ctx, seed);
        return { mood: eo.mood, kop: eo.kop, regels: eo.regels, tekst: null };
      }
      const r = coachWrappedRegel(card, ctx, seed, gebruikt);
      return { mood: r.mood, kop: null, regels: [r.tekst], tekst: r.tekst };
    });
  }, [cards, profiles, playerId, jaar, intensiteit]);

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

  async function deel(card: WrappedCard, regels: string[]) {
    setBusyKind(card.kind);
    try {
      const outcome = await sharePng((ctx) => drawWrappedCard(ctx, card, naam, jaar, { regels }), {
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
    <Sheet
      open
      onClose={onClose}
      className="wrapped-sheet"
      title={`🎁 Wrapped ${jaar}`}
      ariaLabel={`Wrapped ${jaar}`}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") naar(actief + 1);
        if (e.key === "ArrowLeft") naar(actief - 1);
      }}
    >
        <div className="wrapped-track" ref={trackRef} onScroll={onScroll}>
          {cards.map((card, i) => {
            const l = posterLayout(card, naam, jaar);
            const coach = coachPerKaart[i];
            const isEind = card.kind === "eindoordeel";
            return (
              <article
                key={card.kind}
                className={`wrapped-card${isEind ? " wrapped-card--eindoordeel" : ""}`}
              >
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
                  {isEind ? (
                    <div className="wrapped-verdict">
                      <CoachAvatar
                        size={72}
                        mood={coach.mood}
                        className="wrapped-verdict__face"
                      />
                      {coach.kop && <p className="wrapped-verdict__kop">{coach.kop}</p>}
                      {coach.regels.map((r) => (
                        <p key={r} className="wrapped-verdict__regel">
                          {r}
                        </p>
                      ))}
                    </div>
                  ) : coach.tekst ? (
                    <div className="wrapped-coach">
                      <CoachAvatar
                        size={40}
                        mood={coach.mood}
                        className="wrapped-coach__face"
                      />
                      <p className="wrapped-coach__text">{coach.tekst}</p>
                    </div>
                  ) : null}
                </div>
                <button
                  className="btn btn--sm wrapped-card__share"
                  onClick={() => deel(card, coach.regels)}
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
    </Sheet>
  );
}

export default WrappedSheet;
