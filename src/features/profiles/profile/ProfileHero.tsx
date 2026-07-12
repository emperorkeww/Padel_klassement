import { Avatar } from "../../../components/Avatar";
import { CoachAvatar } from "../../../components/CoachAvatar";
import { COMMENTATOR } from "../../../lib/roastTone";
import { displayName } from "../api";
import type { ProfileData } from "./types";

// Vaste kop boven de tabs: avatar, naam (+ "jij"/streak) en @handle. Altijd
// zichtbaar, ongeacht welke tab open staat. De tier-pil hoort bij de
// rating-tegel (in de tabs), zodat de naam nooit dubbel als kop verschijnt.
export function ProfileHero({ d }: { d: ProfileData }) {
  const { p, isMe, streak, nick, roast, rank } = d;
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
        <p className="profile-hero__nick">“{nick}”</p>
        {roast && (
          <div className="profile-hero__coach" role="note">
            <CoachAvatar size={31} className="profile-hero__coach-face" />
            <p className="profile-hero__coach-text">
              <span className="profile-hero__coach-name">{COMMENTATOR.naam}:</span>{" "}
              {roast}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export default ProfileHero;
