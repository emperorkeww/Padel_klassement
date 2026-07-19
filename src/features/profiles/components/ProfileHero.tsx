import type { ReactNode } from "react";
import { Avatar } from "@/ui/Avatar";
import { CoachBubble } from "@/features/coach/components/CoachBubble";
import { displayName } from "@/features/profiles/api";
import type { ProfileData } from "@/features/profiles/components/types";

// Vaste kop boven de tabs: avatar, naam (+ "jij"/streak) en @handle. Altijd
// zichtbaar, ongeacht welke tab open staat. De tier-pil hoort bij de
// rating-tegel (in de tabs), zodat de naam nooit dubbel als kop verschijnt.
// `action` is een optionele knop rechts van de identiteit (bv. een
// vriendverzoek op andermans profiel, #282).
export function ProfileHero({ d, action }: { d: ProfileData; action?: ReactNode }) {
  const { p, isMe, streak, nick, roast, rank } = d;
  // Bijnaam als door Coach Rudy uitgedeeld (#298): i.p.v. een kale regel deelt
  // hij de doopnaam zélf uit, in dezelfde bubbel als zijn eventuele oordeel.
  // Zo hoort de bijnaam bij zijn personage i.p.v. "uit de lucht te vallen".
  // Op je eigen profiel spreekt hij je aan met "je", elders noemt hij de naam.
  // Bij een roast-schild is `roast` null en `nick` neutraal (#183): dan blijft
  // enkel de rustige doopregel over, zonder plaag.
  const aanhef = isMe ? "je" : displayName(p);
  return (
    <section className="card profile-hero">
      {/* Zelfde view-transition-naam als de aangetikte klassement-avatar:
          de foto groeit vloeiend door naar deze grote variant. */}
      <span style={{ viewTransitionName: "player-avatar", display: "inline-flex" }}>
        <Avatar profile={p} size={72} />
      </span>
      <div className="profile-hero__body">
        <h1 className="profile-hero__name">
          {displayName(p)}
          {rank === 1 && (
            <span className="badge badge--bigdaddy">👑 Big Daddy</span>
          )}
          {isMe && <span className="badge badge--accent">jij</span>}
          {streak >= 2 && (
            <span className="badge badge--win">{streak} op rij 🔥</span>
          )}
        </h1>
        <p className="profile-hero__handle">@{p.username}</p>
        {action && <div className="profile-hero__action">{action}</div>}
        <div className="profile-hero__coach" role="note">
          <CoachBubble mood="portret" size={31}>
            <span className="coach-sneer__text">
              Ik doop {aanhef}:{" "}
              <strong className="profile-hero__dub-name">{nick}</strong>
            </span>
            {roast && <span className="coach-sneer__text">{roast}</span>}
          </CoachBubble>
        </div>
      </div>
    </section>
  );
}

export default ProfileHero;
