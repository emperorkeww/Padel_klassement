import { useState } from "react";
import { CoachBubble } from "@/features/coach/components/CoachBubble";
import { coachEmptyState } from "@/features/coach/coachMoments";
import type { Profile } from "@/types";
import { readFlag, writeFlag } from "../flags";
import { OnboardStep } from "./OnboardStep";

// Onboarding-checklist van het overzicht. Uit Dashboard.tsx gelicht (#736); het
// weg-klik-geheugen hoort bij de kaart zelf, niet bij het scherm eromheen.

export function OnboardCard({
  myId,
  profile,
  hasFriend,
  hasGroup,
  hasPlayed,
  /** Kernbronnen nog onderweg: dan nog niets tonen, zodat de checklist niet
   *  even flitst voor een bestaande speler. */
  loading,
}: {
  myId: string;
  profile: Profile | undefined;
  hasFriend: boolean;
  hasGroup: boolean;
  hasPlayed: boolean;
  loading: boolean;
}) {
  const [dismissed, setDismissed] = useState(() => readFlag("onboarding-dismissed"));
  const dismiss = () => {
    setDismissed(true);
    writeFlag("onboarding-dismissed");
  };

  const toon = !loading && !dismissed && !(hasFriend && hasGroup && hasPlayed);
  if (!toon || !profile) return null;

  return (
    <section className="card onboard">
      <div className="card__head">
        <h2 className="card__title">Jouw weg naar de top</h2>
        <button
          className="onboard__dismiss"
          onClick={dismiss}
          aria-label="Verberg deze checklist"
        >
          ✕
        </button>
      </div>
      {/* Rudy's welkom hoort alleen bij echte nieuwkomers: wie al matches
          speelde maar bv. nog een groep mist, krijgt geen "speel je
          eerste match"-praatje (#301). */}
      {!hasPlayed && (
        <div className="onboard__coach">
          <CoachBubble mood="mild" size={24}>
            <span className="coach-sneer__text">
              {coachEmptyState({
                type: "dashboard",
                seed: `${myId}-onboard`,
                ctx: {
                  intensiteit: profile.roast_intensiteit ?? "gemeen",
                  schild: profile.roast_schild ?? false,
                },
              })}
            </span>
          </CoachBubble>
        </div>
      )}
      <ul className="onboard__list">
        <OnboardStep
          done={hasFriend}
          to="/vrienden"
          label="Speelmaten zoeken"
          hint="Zoek je vrienden op gebruikersnaam en daag ze direct uit."
        />
        <OnboardStep
          done={hasGroup}
          to="/groepen"
          label="Richt je eigen clubje op"
          hint="Verzamel al je speelmaatjes in een groep met een eigen, genadeloos klassement."
        />
        <OnboardStep
          done={hasPlayed}
          to="/matches"
          label="De kooi in!"
          hint="Log je eerste match of genereer direct evenwichtige teams om te knallen."
        />
      </ul>
    </section>
  );
}

export default OnboardCard;
