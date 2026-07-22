import { useEffect, useRef, useState, type ReactNode } from "react";
import { prefersReducedMotion } from "@/lib/utils/motion";
import { BADGE_CONFETTI, celebrate } from "@/lib/utils/confetti";
import { winPulse } from "@/lib/utils/haptics";
import { CoachBubble } from "@/features/coach/components/CoachBubble";
import {
  FutKaart,
  FutKaartDefs,
  FutKaartVoorkant,
  MAX_PLAYSTYLES,
  type FutPlaystyle,
} from "@/features/rating/components/FutKaart";
import type { Tier, TierWissel } from "@/features/rating/tiers";
import "./PackOpening.css";

// Pack-opening (#500): een hoofdtier-promotie verschijnt als FUT-pack — tik en
// de geüpgradede kaart springt eruit, met Rudy's oordeel eronder. Vervangt de
// kale promotie-toast uit useTierAnnouncement; degradaties blijven een toast.
// Sinds #615 opent ook een zeldzame badge een pack: paarse foil, en de nieuwe
// badge pulseert als PlayStyle-chip op de kaart.

/** Goud pack: een hoofdtier-promotie (#500). */
export interface PromotiePack {
  soort: "promotie";
  wissel: TierWissel;
  /** De rating ná de promotie — het Elo-getal op de kaart. */
  rating: number;
  /** Rudy's promotie-quip, dezelfde tekst die eerst de toast vulde. */
  quip: string;
}

/** Paars pack: een zojuist behaalde zeldzame badge (#615). */
export interface BadgePack {
  soort: "badge";
  badge: FutPlaystyle;
  /** Huidige rating/tier — de kaart toont de bestaande divisie, niet een wissel. */
  rating: number | null;
  tier: Tier | null;
  quip: string;
}

/** Wat het pack te vieren heeft; null = geen pack open. */
export type PackData = PromotiePack | BadgePack;

type Fase = "pack" | "openen" | "kaart";

export function PackOpening({
  pack,
  naam,
  avatar,
  playstyles,
  onClose,
}: {
  pack: PackData | null;
  naam: string;
  avatar: ReactNode;
  /** Uitgelichte badges van de speler — de chip-rij op de badge-pack-kaart. */
  playstyles?: FutPlaystyle[];
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
  const isBadge = pack.soort === "badge";
  // Bij een badge-pack toont de kaart de bestaande divisie; de nieuwe badge
  // komt vooraan in de chip-rij (gededupliceerd als hij al uitgelicht was).
  const kaartTier = pack.soort === "badge" ? pack.tier : pack.wissel.naar;
  const chips =
    pack.soort === "badge"
      ? [
          pack.badge,
          ...(playstyles ?? []).filter((p) => p.id !== pack.badge.id),
        ].slice(0, MAX_PLAYSTYLES)
      : undefined;

  const open = () => {
    if (fase !== "pack") return;
    setFase("openen");
    celebrate(isBadge ? BADGE_CONFETTI : undefined);
    winPulse();
    timer.current = setTimeout(() => setFase("kaart"), 550);
  };

  return (
    <div
      className={`pack-opening${isBadge ? " pack-opening--badge" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={
        pack.soort === "badge"
          ? `Zeldzame badge: ${pack.badge.naam}`
          : `Promotie naar ${pack.wissel.naar.naam}`
      }
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
          <span className="pack-opening__sub">
            {isBadge ? "Zeldzame badge" : "Promotie"}
          </span>
        </button>
      ) : (
        <div
          className="pack-opening__resultaat"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="pack-opening__banner">
            {pack.soort === "badge" ? (
              <>
                Zeldzame badge · {pack.badge.emoji} {pack.badge.naam}
              </>
            ) : (
              <>
                Promotie! {pack.wissel.van.naam} → {pack.wissel.naar.naam}{" "}
                {pack.wissel.naar.emoji}
              </>
            )}
          </p>
          <FutKaart
            tier={kaartTier}
            className="pack-opening__kaart"
            voor={
              <FutKaartVoorkant
                elo={pack.rating}
                tier={kaartTier}
                naam={naam}
                avatar={avatar}
                playstyles={chips}
                nieuwPlaystyleId={
                  pack.soort === "badge" ? pack.badge.id : undefined
                }
              />
            }
          />
          <div className="pack-opening__coach" role="note">
            <CoachBubble mood="portret" size={31}>
              <span className="coach-sneer__text">{pack.quip}</span>
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