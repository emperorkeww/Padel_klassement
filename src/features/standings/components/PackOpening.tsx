import { useEffect, useRef, useState, type ReactNode } from "react";
import { prefersReducedMotion } from "@/lib/utils/motion";
import { celebrate } from "@/lib/utils/confetti";
import { winPulse } from "@/lib/utils/haptics";
import { CoachBubble } from "@/features/coach/components/CoachBubble";
import {
  FutKaart,
  FutKaartDefs,
  FutKaartVoorkant,
} from "@/features/rating/components/FutKaart";
import type { TierWissel } from "@/features/rating/tiers";
import "./PackOpening.css";

// Pack-opening (#500): een hoofdtier-promotie verschijnt als FUT-pack — tik en
// de geüpgradede kaart springt eruit, met Rudy's oordeel eronder. Vervangt de
// kale promotie-toast uit useTierAnnouncement; degradaties blijven een toast.

/** Wat het pack te vieren heeft; null = geen pack open. */
export interface PackData {
  wissel: TierWissel;
  /** De rating ná de promotie — het Elo-getal op de kaart. */
  rating: number;
  /** Rudy's promotie-quip, dezelfde tekst die eerst de toast vulde. */
  quip: string;
}

type Fase = "pack" | "openen" | "kaart";

export function PackOpening({
  pack,
  naam,
  avatar,
  onClose,
}: {
  pack: PackData | null;
  naam: string;
  avatar: ReactNode;
  onClose: () => void;
}) {
  // Bij verminderde beweging slaan we het pack over: de kaart staat er direct.
  const [fase, setFase] = useState<Fase>(() =>
    prefersReducedMotion() ? "kaart" : "pack",
  );
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const packRef = useRef<HTMLButtonElement>(null);

  // Nieuw pack → fase resetten; lopende reveal-timer altijd opruimen.
  useEffect(() => {
    if (pack) setFase(prefersReducedMotion() ? "kaart" : "pack");
    return () => clearTimeout(timer.current);
  }, [pack]);

  // Focus op het pack bij openen, terug naar de opener bij sluiten; Escape
  // sluit en de pagina eronder scrolt niet mee (zelfde patroon als de
  // AvatarLightbox/Sheet).
  useEffect(() => {
    if (!pack) return;
    const opener = document.activeElement as HTMLElement | null;
    packRef.current?.focus?.();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      opener?.focus?.();
    };
  }, [pack, onClose]);

  if (!pack) return null;
  const { wissel, rating, quip } = pack;

  const open = () => {
    if (fase !== "pack") return;
    setFase("openen");
    celebrate();
    winPulse();
    timer.current = setTimeout(() => setFase("kaart"), 550);
  };

  return (
    <div
      className="pack-opening"
      role="dialog"
      aria-modal="true"
      aria-label={`Promotie naar ${wissel.naar.naam}`}
      onClick={() => {
        // Backdrop-tik sluit pas als de kaart er staat; ervoor is elke tik
        // "open het pack" en die knop vangt zijn eigen kliks al af.
        if (fase === "kaart") onClose();
      }}
    >
      <FutKaartDefs />
      {fase !== "kaart" ? (
        <button
          type="button"
          ref={packRef}
          className={`pack-opening__pack${fase === "openen" ? " is-open" : ""}`}
          aria-label="Open het pack"
          onClick={(e) => {
            e.stopPropagation();
            open();
          }}
        >
          <span className="pack-opening__zegel" aria-hidden="true">
            🎾
          </span>
          <span className="pack-opening__titel">Padel Pack</span>
          <span className="pack-opening__sub">Promotie</span>
        </button>
      ) : (
        <div
          className="pack-opening__resultaat"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="pack-opening__banner">
            Promotie! {wissel.van.naam} → {wissel.naar.naam} {wissel.naar.emoji}
          </p>
          <FutKaart
            tier={wissel.naar}
            className="pack-opening__kaart"
            voor={
              <FutKaartVoorkant
                elo={rating}
                tier={wissel.naar}
                naam={naam}
                avatar={avatar}
              />
            }
          />
          <div className="pack-opening__coach" role="note">
            <CoachBubble mood="portret" size={31}>
              <span className="coach-sneer__text">{quip}</span>
            </CoachBubble>
          </div>
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Verder
          </button>
        </div>
      )}
    </div>
  );
}

export default PackOpening;